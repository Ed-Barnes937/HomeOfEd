// Retention/purge worker (plan §9.2 / D8) — the repo's FIRST background
// process. Runs as the `worker` process group in the `hoe-sprout` Fly app
// (`[processes] worker = node src/server/worker.ts`, wired in P8), sharing the
// image + `DATABASE_URL` with `web`. It periodically:
//
//   a. summarises + purges conversations past the retention window (the same
//      list-messages -> summarise -> summariseAndPurgeConversation flow as
//      SummariseAndPurgeHandler, minus the ownership check — the worker is
//      system-scoped), reusing the INJECTED `Summariser` seam so the pipeline
//      HTTP call (createHttpSummariser) is never duplicated here; and
//   b. prunes behavioural_events past their window (a global compliance sweep).
//
// D8 keeps it minimal: a `setInterval` loop in a min-1 process, not a bespoke
// scheduler. `runRetentionSweep` is a pure-ish, timer-free core (deps injected)
// so it is unit-tested over PGlite without Docker (worker.test.ts); the
// entrypoint just wires real deps + the interval and is guarded so importing
// this module in tests does not start the timer (mirrors sprout-pipeline/index).
import { fileURLToPath } from 'node:url'

import type { Logger } from '@hoe/backend-kit'
import { createDbClient } from '@hoe/db'
import { loadDbEnv } from '@hoe/db/env'
import { createLogger } from '@hoe/logger'

import { createHttpSummariser } from './pipeline/pipelineClient.ts'
import type { Summariser } from './router/deps.ts'
import { sproutSchema } from './schema.ts'
import { DrizzleSproutStore, type SproutStore } from './store.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** The slice of the Store the sweep needs (Store interface, never a concrete driver). */
type RetentionStore = Pick<
  SproutStore,
  | 'listConversationsForRetention'
  | 'listMessages'
  | 'summariseAndPurgeConversation'
  | 'pruneBehaviouralEventsBefore'
>

export interface RetentionDeps {
  store: RetentionStore
  /** The pipeline summariser seam (createHttpSummariser in prod) — never a raw HTTP call. */
  summarise: Summariser
  now: () => Date
  logger: Logger
  /** Conversations idle (by `updatedAt`) longer than this are summarised + purged. */
  retentionDays: number
  /** behavioural_events older than this are pruned. */
  behaviouralEventRetentionDays: number
}

export interface RetentionSweepResult {
  conversationsScanned: number
  conversationsSummarised: number
  conversationsFailed: number
}

/**
 * One retention pass. Fail-safe: a summariser error on one conversation is
 * logged and the sweep continues with the rest; the behavioural-events prune
 * runs regardless. Returns per-conversation counts (for logging + tests).
 */
export const runRetentionSweep = async (deps: RetentionDeps): Promise<RetentionSweepResult> => {
  const now = deps.now()
  const convoCutoff = new Date(now.getTime() - deps.retentionDays * DAY_MS)
  const eventCutoff = new Date(now.getTime() - deps.behaviouralEventRetentionDays * DAY_MS)

  const due = await deps.store.listConversationsForRetention(convoCutoff)
  let summarised = 0
  let failed = 0

  for (const convo of due) {
    try {
      const messages = await deps.store.listMessages(convo.id)
      if (messages.length === 0) continue
      const summary = await deps.summarise(
        messages.map((m) => ({ role: m.role, content: m.content })),
      )
      await deps.store.summariseAndPurgeConversation(convo.id, summary)
      summarised += 1
    } catch (err) {
      failed += 1
      deps.logger.error('retention: summarise+purge failed for conversation', {
        conversationId: convo.id,
        err: String(err),
      })
    }
  }

  try {
    await deps.store.pruneBehaviouralEventsBefore(eventCutoff)
  } catch (err) {
    deps.logger.error('retention: behavioural-events prune failed', { err: String(err) })
  }

  deps.logger.info('retention sweep complete', {
    scanned: due.length,
    summarised,
    failed,
    convoCutoff: convoCutoff.toISOString(),
    eventCutoff: eventCutoff.toISOString(),
  })

  return { conversationsScanned: due.length, conversationsSummarised: summarised, conversationsFailed: failed }
}

export interface WorkerConfig {
  intervalMs: number
  retentionDays: number
  behaviouralEventRetentionDays: number
}

const numEnv = (key: string, fallback: number): number => {
  const raw = process.env[key]
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Env-configurable interval + windows, with sane defaults (docs say 30–90d, then purge). */
export const resolveWorkerConfig = (): WorkerConfig => ({
  intervalMs: numEnv('WORKER_INTERVAL_MS', 60 * 60 * 1000), // hourly
  retentionDays: numEnv('RETENTION_DAYS', 30),
  behaviouralEventRetentionDays: numEnv('BEHAVIOURAL_EVENT_RETENTION_DAYS', 30),
})

/**
 * Starts the interval loop. Guards against overlapping runs (a slow sweep never
 * stacks) and against a throwing sweep killing the process (belt-and-braces on
 * top of runRetentionSweep's own per-item try/catch). Runs once immediately.
 * Returns the timer so callers can clear it (unref keeps it from pinning exit).
 */
export const startRetentionWorker = (deps: RetentionDeps, intervalMs: number): NodeJS.Timeout => {
  let running = false
  const tick = async (): Promise<void> => {
    if (running) {
      deps.logger.warn('retention sweep still running; skipping this tick')
      return
    }
    running = true
    try {
      await runRetentionSweep(deps)
    } catch (err) {
      deps.logger.error('retention sweep threw', { err: String(err) })
    } finally {
      running = false
    }
  }
  void tick()
  return setInterval(() => void tick(), intervalMs)
}

// Start the loop only when run as the entrypoint (`node src/server/worker.ts`),
// not when imported by tests (mirrors sprout-pipeline/index.ts). Wires the REAL
// Postgres Store + HTTP pipeline summariser, exactly as main.ts composes them.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const logger = createLogger().child({ app: 'sprout', process: 'worker' })
  const env = loadDbEnv()
  const db = await createDbClient({
    driver: 'postgres',
    schema: sproutSchema,
    url: env.DATABASE_URL,
  })
  const store = new DrizzleSproutStore(db)

  // Same pipeline wiring as main.ts: private-network base + x-pipeline-key.
  const pipelineApiKey = process.env.PIPELINE_API_KEY
  if (!pipelineApiKey && process.env.NODE_ENV === 'production') {
    throw new Error('PIPELINE_API_KEY is required in production')
  }
  const summarise = createHttpSummariser({
    baseUrl: process.env.PIPELINE_URL ?? 'http://hoe-sprout-pipeline.flycast:8080',
    apiKey: pipelineApiKey ?? 'dev-pipeline-key',
  })

  const config = resolveWorkerConfig()
  logger.info('retention worker starting', {
    intervalMs: config.intervalMs,
    retentionDays: config.retentionDays,
    behaviouralEventRetentionDays: config.behaviouralEventRetentionDays,
  })

  startRetentionWorker(
    {
      store,
      summarise,
      now: () => new Date(),
      logger,
      retentionDays: config.retentionDays,
      behaviouralEventRetentionDays: config.behaviouralEventRetentionDays,
    },
    config.intervalMs,
  )
}
