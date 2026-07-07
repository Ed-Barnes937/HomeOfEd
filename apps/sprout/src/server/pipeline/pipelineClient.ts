// The pipeline seam (plan §3/§5.4). The chat SSE route depends on this
// interface, never a concrete HTTP client — exactly like the P3 `Summariser`.
//
//   - REAL impl: `createHttpPipelineClient` calls the headless safety service
//     over Fly's PRIVATE network (`hoe-sprout-pipeline.flycast`), authenticated
//     with the `x-pipeline-key` header. Injected in main.ts.
//   - FAKE impl: tests / the simulator inject a scripted async iterable.
//
// NB the pipeline APP is built in P6. This is only the sprout SIDE that calls
// it; the real call is exercised end-to-end once P6 + deploy land (a running
// `hoe-sprout-pipeline` reachable over flycast, PIPELINE_API_KEY set on both).
import type { CalibrationAnswer, PresetName, PresetSliders } from '@hoe/sprout-shared'

import type { Summariser } from '../router/deps.ts'
import { readSseStream } from '../../lib/sseFrames.ts'
import type { ChatStreamChunk, PipelineFlag } from '../../lib/chatStream.ts'

/** What the pipeline's `/chat` contract needs. Guardrail config is resolved
 * server-side by the SSE route (#36) and passed here — the browser never
 * supplies it. */
export interface PipelineChatInput {
  message: string
  presetName: PresetName
  sliders: PresetSliders
  calibrationAnswers: CalibrationAnswer[]
  history: { role: string; content: string }[]
}

export interface PipelineClient {
  streamChat(input: PipelineChatInput): AsyncIterable<ChatStreamChunk>
}

export interface HttpPipelineClientOpts {
  /** Private-network base, e.g. `http://hoe-sprout-pipeline.flycast:8080`. */
  baseUrl: string
  /** Service-to-service key, sent as `x-pipeline-key` (defence in depth). */
  apiKey: string
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
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
 * The real pipeline client: POST `/chat`, then stream its `text/event-stream`
 * response frame-by-frame (buffered — see lib/sseFrames). A non-OK response
 * (or the network being down — pipeline deployed after web, plan §12) yields a
 * single `error` chunk so the route fails closed to a safe message.
 */
export function createHttpPipelineClient(opts: HttpPipelineClientOpts): PipelineClient {
  const doFetch = opts.fetchImpl ?? fetch
  return {
    async *streamChat(input: PipelineChatInput): AsyncIterable<ChatStreamChunk> {
      let res: Response
      try {
        res = await doFetch(`${opts.baseUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-pipeline-key': opts.apiKey },
          body: JSON.stringify({
            message: input.message,
            presetName: input.presetName,
            sliders: input.sliders,
            calibrationAnswers: input.calibrationAnswers,
            history: input.history,
          }),
        })
      } catch {
        yield { error: 'Failed to get response' }
        return
      }

      if (!res.ok || !res.body) {
        yield { error: 'Failed to get response' }
        return
      }

      for await (const value of readSseStream(res.body)) {
        const chunk = toChunk(value)
        if (chunk) yield chunk
      }
    },
  }
}

/**
 * The real conversation summariser (conversations.summariseAndPurge + the P9
 * retention worker): POST `/summarise` on the same private-network pipeline.
 * Discharges the main.ts `TODO(P5)` summariser stub. Exercised for real once
 * P6 + deploy land.
 */
export function createHttpSummariser(opts: HttpPipelineClientOpts): Summariser {
  const doFetch = opts.fetchImpl ?? fetch
  return async (messages) => {
    const res = await doFetch(`${opts.baseUrl}/summarise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pipeline-key': opts.apiKey },
      body: JSON.stringify({ messages }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(
        `Pipeline summariser returned ${res.status}${detail ? `: ${detail}` : ''}`,
      )
    }
    const data = (await res.json()) as { summary: string }
    return data.summary
  }
}
