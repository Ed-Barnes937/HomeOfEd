// The chat SSE wire contract + the browser client that reads it. Pure/browser-
// safe: shared between features/chat/useChat (the reader) and the server
// pipeline client (server/pipeline — same chunk shape on the wire). The SSE
// route is NOT tRPC, so this is the app's one hand-rolled transport (plan §5.4).
import { readSseStream } from './sseFrames.ts'

/** A guardrail event the pipeline emits for the web app to persist + surface
 * (mirrors the pipeline's `FlagEvent`). Pipeline flags are never 'reported' —
 * that type is child-initiated and written via the flags.create procedure. */
export interface PipelineFlag {
  type: 'sensitive' | 'blocked' | 'validation-failed'
  reason: string
  topics?: string[]
  childMessage: string
  aiResponse?: string
}

/** One decoded frame from `/api/chat/stream`. */
export type ChatStreamChunk = { token: string } | { flag: PipelineFlag } | { error: string }

/** The request body the browser POSTs. Carries only message CONTENT — never
 * identity or guardrail config: the SSE route derives childId from the signed
 * cookie and loads sliders/preset/calibration server-side (#34/#35/#36). */
export interface ChatStreamRequest {
  message: string
  history: { role: string; content: string }[]
  conversationId?: string
  /** Device-reputation signal only (not identity). */
  deviceToken?: string
}

function toChunk(value: unknown): ChatStreamChunk | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record.token === 'string') return { token: record.token }
  if (typeof record.error === 'string') return { error: record.error }
  if (record.flag && typeof record.flag === 'object') return { flag: record.flag as PipelineFlag }
  return null
}

/**
 * POST to the chat SSE route and yield decoded chunks. Same-origin, so the
 * signed child-session cookie rides along automatically. A non-OK response
 * (e.g. a 429 behavioural throttle or a 401) yields a single `error` chunk.
 */
export async function* streamChat(
  body: ChatStreamRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamChunk, void, void> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    yield { error: 'Failed to get response' }
    return
  }

  for await (const value of readSseStream(res.body)) {
    const chunk = toChunk(value)
    if (chunk) yield chunk
  }
}
