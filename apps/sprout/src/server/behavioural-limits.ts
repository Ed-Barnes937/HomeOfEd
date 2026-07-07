// Behavioural signals + rate limiting (plan §13 — ports nearly unchanged).
//
// The PURE decision logic (`decideChatThrottle`, `decidePinLock`,
// `BEHAVIOURAL_LIMITS`) is ported verbatim and is unit-tested without a DB.
// The DB-access helpers are the one deliberate change: the source ran raw
// Drizzle queries against a `PostgresJsDatabase`; here they go through the
// injected `SproutStore` (HomeOfEd rule: handlers/domain depend on the Store
// interface, never a concrete driver). Each also takes an optional `now` seam
// so callers can pass `ctx.now` for deterministic tests.
//
// Consumers (all P3b / P5 / P9): childAuth.loginPin (PIN lockout), flags.create
// (probe signal), the chat SSE path (velocity/probe/reputation gate), and the
// retention worker (pruning).
import type { SproutStore } from './store.ts'

const numEnv = (key: string, fallback: number): number => {
  const raw = process.env[key]
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const BEHAVIOURAL_LIMITS = {
  // Session velocity: a single child sending messages too fast.
  velocityWindowSeconds: numEnv('RATE_LIMIT_VELOCITY_WINDOW_S', 60),
  maxMessagesPerWindow: numEnv('RATE_LIMIT_MAX_MESSAGES', 20),
  // Repeated-probe: a single child repeatedly tripping the guardrails.
  probeWindowSeconds: numEnv('RATE_LIMIT_PROBE_WINDOW_S', 300),
  maxProbesPerWindow: numEnv('RATE_LIMIT_MAX_PROBES', 4),
  // Device reputation: probes accumulated across a device (any child on it).
  reputationWindowSeconds: numEnv('RATE_LIMIT_REPUTATION_WINDOW_S', 3600),
  deviceProbeStrikeLimit: numEnv('RATE_LIMIT_DEVICE_PROBE_STRIKES', 8),
  // PIN brute-force (the retained minimum carried forward from plan item 9.5).
  pinWindowSeconds: numEnv('RATE_LIMIT_PIN_WINDOW_S', 900),
  maxPinFailures: numEnv('RATE_LIMIT_MAX_PIN_FAILURES', 5),
  // How long signals are retained before pruning. Must be >= every window
  // above so a prune never drops a row a check still needs.
  retentionSeconds: numEnv('RATE_LIMIT_RETENTION_S', 86400),
} as const

export type BehaviouralLimits = typeof BEHAVIOURAL_LIMITS

export type EventKind = 'message' | 'probe' | 'rate_violation' | 'pin_fail'

// --- Pure decision logic (unit-tested without a database) ---

export type ThrottleReason = 'rate' | 'probe' | 'reputation'

export interface ChatSignalCounts {
  messageCount: number
  sessionProbeCount: number
  deviceProbeCount: number
}

export type ChatVerdict =
  | { throttled: false }
  | {
      throttled: true
      reason: ThrottleReason
      retryAfterSeconds: number
      message: string
    }

const THROTTLE_MESSAGE =
  "You're sending messages very quickly. Take a short break and try again in a little while."

export const decideChatThrottle = (
  counts: ChatSignalCounts,
  limits: BehaviouralLimits,
): ChatVerdict => {
  if (counts.messageCount >= limits.maxMessagesPerWindow) {
    return {
      throttled: true,
      reason: 'rate',
      retryAfterSeconds: limits.velocityWindowSeconds,
      message: THROTTLE_MESSAGE,
    }
  }
  if (counts.sessionProbeCount >= limits.maxProbesPerWindow) {
    return {
      throttled: true,
      reason: 'probe',
      retryAfterSeconds: limits.probeWindowSeconds,
      message: THROTTLE_MESSAGE,
    }
  }
  if (counts.deviceProbeCount >= limits.deviceProbeStrikeLimit) {
    return {
      throttled: true,
      reason: 'reputation',
      retryAfterSeconds: limits.reputationWindowSeconds,
      message: THROTTLE_MESSAGE,
    }
  }
  return { throttled: false }
}

export type PinVerdict = { locked: false } | { locked: true; retryAfterSeconds: number }

export const decidePinLock = (failCount: number, limits: BehaviouralLimits): PinVerdict =>
  failCount >= limits.maxPinFailures
    ? { locked: true, retryAfterSeconds: limits.pinWindowSeconds }
    : { locked: false }

// --- Store-backed access (was raw drizzle in the source) ---

/** The slice of the Store the behavioural layer needs. */
export type BehaviouralStore = Pick<
  SproutStore,
  'recordBehaviouralEvent' | 'countBehaviouralEvents' | 'pruneBehaviouralEvents'
>

export const recordEvent = async (
  store: BehaviouralStore,
  event: { kind: EventKind; childId?: string; deviceToken?: string },
): Promise<void> => {
  await store.recordBehaviouralEvent({
    kind: event.kind,
    childId: event.childId ?? null,
    deviceToken: event.deviceToken ?? null,
  })
}

// Keep the table bounded: drop this child's / device's signals older than the
// retention window. Cheap (indexed) and runs on the chat write path.
export const pruneOldEvents = async (
  store: BehaviouralStore,
  key: { childId?: string; deviceToken?: string },
  now: () => Date = () => new Date(),
): Promise<void> => {
  const before = new Date(now().getTime() - BEHAVIOURAL_LIMITS.retentionSeconds * 1000)
  if (key.childId) await store.pruneBehaviouralEvents({ childId: key.childId, before })
  if (key.deviceToken) await store.pruneBehaviouralEvents({ deviceToken: key.deviceToken, before })
}

// Read-only: does this chat request trip a velocity / probe / reputation limit?
export const evaluateChatRequest = async (
  store: BehaviouralStore,
  key: { childId: string; deviceToken?: string },
  now: () => Date = () => new Date(),
): Promise<ChatVerdict> => {
  const limits = BEHAVIOURAL_LIMITS
  const nowMs = now().getTime()
  const since = (windowSeconds: number): Date => new Date(nowMs - windowSeconds * 1000)
  const [messageCount, sessionProbeCount, deviceProbeCount] = await Promise.all([
    store.countBehaviouralEvents({
      kind: 'message',
      since: since(limits.velocityWindowSeconds),
      childId: key.childId,
    }),
    store.countBehaviouralEvents({
      kind: 'probe',
      since: since(limits.probeWindowSeconds),
      childId: key.childId,
    }),
    key.deviceToken
      ? store.countBehaviouralEvents({
          kind: 'probe',
          since: since(limits.reputationWindowSeconds),
          deviceToken: key.deviceToken,
        })
      : Promise.resolve(0),
  ])

  return decideChatThrottle({ messageCount, sessionProbeCount, deviceProbeCount }, limits)
}

// Read-only: is PIN entry for this child currently locked out?
export const evaluatePinAttempt = async (
  store: BehaviouralStore,
  key: { childId: string },
  now: () => Date = () => new Date(),
): Promise<PinVerdict> => {
  const since = new Date(now().getTime() - BEHAVIOURAL_LIMITS.pinWindowSeconds * 1000)
  const failCount = await store.countBehaviouralEvents({
    kind: 'pin_fail',
    since,
    childId: key.childId,
  })
  return decidePinLock(failCount, BEHAVIOURAL_LIMITS)
}
