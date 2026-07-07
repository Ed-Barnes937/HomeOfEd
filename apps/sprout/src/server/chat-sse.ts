// The chat SSE route (plan §5.4 / D3): a plain `text/event-stream` Fastify
// route mounted via the D9 `registerRoutes` hook. This is the repo's FIRST
// streaming transport — everything else is buffered tRPC. Node-only; erasable
// TS (ADR 0004).
//
// Request path (one HTTP request per child message):
//   1. Authenticate the CHILD from the signed cookie (never the body — #34/#35).
//   2. Behavioural gate: velocity / probe / device-reputation throttle (6.5.6).
//   3. Load guardrail config (sliders/preset/calibration) from the Store by the
//      authenticated childId (#36) — the client no longer sends it.
//   4. Call the pipeline over the injected seam, stream tokens to the browser,
//      and PERSIST each `flag` event to the DB as it arrives (the pipeline is
//      DB-less). The child + AI MESSAGES are persisted by the client via tRPC
//      (conversations.saveMessage) — this route owns only the stream + flags.
import type { FastifyInstance, FastifyReply, FastifyRequest } from '@hoe/backend-kit/server'
import { z } from 'zod'

import type { Logger } from '@hoe/logger'

import type { ChildUser } from './auth/providers.ts'
import { evaluateChatRequest, pruneOldEvents, recordEvent } from './behavioural-limits.ts'
import { loadChildConfig } from './handlers/children/loadChildConfig.ts'
import type { PipelineClient } from './pipeline/pipelineClient.ts'
import type { SproutStore } from './store.ts'
import type { PresetName } from './domain/presets.ts'
import type { PipelineFlag } from '../lib/chatStream.ts'

export const chatStreamBodySchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(z.object({ role: z.string(), content: z.string() })).default([]),
  conversationId: z.string().uuid().optional(),
  // Device-reputation signal only — never identity.
  deviceToken: z.string().optional(),
})
export type ChatStreamBody = z.infer<typeof chatStreamBodySchema>

export interface ChatSseDeps {
  store: SproutStore
  pipeline: PipelineClient
  /** Resolve the authenticated child from the request cookie (main.ts closes
   * the child `AuthProvider` over CHILD_SESSION_SECRET; tests pass a fake). */
  resolveChild: (req: FastifyRequest) => ChildUser | null
  logger: Logger
  now?: () => Date
}

/** Persist a pipeline flag exactly as flags.create would (reuses the Store +
 * the probe behavioural signal), keyed to the authenticated child. */
async function persistFlag(
  deps: ChatSseDeps,
  child: ChildUser,
  conversationId: string | undefined,
  flag: PipelineFlag,
): Promise<void> {
  await deps.store.createFlag({
    childId: child.id,
    conversationId: conversationId ?? null,
    messageId: null,
    type: flag.type,
    reason: flag.reason,
    childMessage: flag.childMessage,
    aiResponse: flag.aiResponse ?? null,
    topics: flag.topics ? JSON.stringify(flag.topics) : null,
  })
  // Pipeline flags are guardrail trips (never 'reported'), so each is a probe
  // signal for repeated-probe / device-reputation tracking (6.5.6).
  await recordEvent(deps.store, { kind: 'probe', childId: child.id })
}

/** Register `POST /api/chat/stream`. Mounted via the D9 hook so it precedes the
 * SPA notFound fallback. */
export function registerChatSseRoute(app: FastifyInstance, deps: ChatSseDeps): void {
  const now = deps.now ?? (() => new Date())

  app.post('/api/chat/stream', async (req: FastifyRequest, reply: FastifyReply) => {
    const child = deps.resolveChild(req)
    if (!child) return reply.status(401).send({ error: 'Unauthorized' })

    const parsed = chatStreamBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request' })
    const body = parsed.data

    // Behavioural velocity / probe / device-reputation gate (6.5.6). Keyed on
    // the authenticated child; a throttle is a JSON 429 (with Retry-After) so
    // the client surfaces it rather than seeing a broken stream.
    const verdict = await evaluateChatRequest(
      deps.store,
      { childId: child.id, deviceToken: body.deviceToken },
      now,
    )
    if (verdict.throttled) {
      await recordEvent(deps.store, {
        kind: 'rate_violation',
        childId: child.id,
        deviceToken: body.deviceToken,
      })
      return reply
        .status(429)
        .header('Retry-After', String(verdict.retryAfterSeconds))
        .send({ error: verdict.message })
    }
    await recordEvent(deps.store, {
      kind: 'message',
      childId: child.id,
      deviceToken: body.deviceToken,
    })
    await pruneOldEvents(deps.store, { childId: child.id, deviceToken: body.deviceToken }, now)

    // presetName comes from the child ROW (server-side), not the body (#36).
    const childRow = await deps.store.getChild(child.id)
    if (!childRow) return reply.status(401).send({ error: 'Unauthorized' })
    const config = await loadChildConfig(deps.store, child.id)

    // Take over the socket: from here we own the raw response (SSE).
    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const send = (payload: unknown): void => {
      raw.write(`data: ${JSON.stringify(payload)}\n\n`)
    }

    try {
      for await (const chunk of deps.pipeline.streamChat({
        message: body.message,
        presetName: childRow.presetName as PresetName,
        sliders: config.sliders,
        calibrationAnswers: config.calibrationAnswers,
        history: body.history,
      })) {
        if ('flag' in chunk) {
          await persistFlag(deps, child, body.conversationId, chunk.flag)
          send({ flag: chunk.flag })
        } else if ('token' in chunk) {
          send({ token: chunk.token })
        } else {
          send({ error: chunk.error })
        }
      }
    } catch (err) {
      deps.logger.error('chat stream failed', { error: String(err), childId: child.id })
      send({ error: 'Failed to get response' })
    } finally {
      raw.write('data: [DONE]\n\n')
      raw.end()
    }
  })
}
