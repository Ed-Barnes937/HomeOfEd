// Orchestrator integration test (review #4B). Now that the OpenAI/OpenRouter
// client is injected into `buildServer`, we can drive the WHOLE pipeline —
// routing, SSE framing, `x-pipeline-key` auth, and every safety branch — with a
// fake client through `app.inject`. No network, deterministic.
import type { Logger } from '@hoe/logger'
import type OpenAI from 'openai'
import { beforeAll, describe, expect, test } from 'vitest'

import { getFallbackResponse } from './flag-and-forward.ts'
import { buildServer, type OrchestratorDeps } from './index.ts'

// buildServer reads PIPELINE_API_KEY from the env at build time.
const API_KEY = 'test-pipeline-key'
beforeAll(() => {
  process.env.PIPELINE_API_KEY = API_KEY
})

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
}

type CreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParams
type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion

/** A fake OpenAI client. `respond(model)` returns the assistant content for a
 * given model id, or throws to simulate an OpenRouter failure. Model ids:
 * `openai/gpt-4o-mini` (generation + summarise), `openai/gpt-4.1-nano` (R5
 * judge), `meta-llama/llama-guard-3-8b` (R3 guard). */
function fakeOpenAI(respond: (model: string) => string): OpenAI {
  const create = (params: CreateParams): Promise<ChatCompletion> => {
    const content = respond(params.model)
    const completion = {
      choices: [{ message: { role: 'assistant', content } }],
    } as unknown as ChatCompletion
    return Promise.resolve(completion)
  }
  return { chat: { completions: { create } } } as unknown as OpenAI
}

// An all-clear responder: benign generation, judge APPROPRIATE, guard safe.
const allClear =
  (generation: string) =>
  (model: string): string => {
    if (model === 'openai/gpt-4.1-nano') return 'APPROPRIATE: fine for a child'
    if (model === 'meta-llama/llama-guard-3-8b') return 'safe'
    return generation
  }

const buildWith = (respond: (model: string) => string): ReturnType<typeof buildServer> => {
  const deps: OrchestratorDeps = { openai: fakeOpenAI(respond), logger: noopLogger }
  return buildServer(deps)
}

interface ParsedStream {
  tokens: string[]
  flags: { type: string; reason: string; topics?: string[] }[]
  errors: string[]
  done: boolean
}

/** Parse an SSE body (`data: <payload>\n\n` frames) into structured events. */
function parseStream(body: string): ParsedStream {
  const result: ParsedStream = { tokens: [], flags: [], errors: [], done: false }
  for (const line of body.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6)
    if (payload === '[DONE]') {
      result.done = true
      continue
    }
    const parsed = JSON.parse(payload) as {
      token?: string
      error?: string
      flag?: { type: string; reason: string; topics?: string[] }
    }
    if (typeof parsed.token === 'string') result.tokens.push(parsed.token)
    else if (typeof parsed.error === 'string') result.errors.push(parsed.error)
    else if (parsed.flag) result.flags.push(parsed.flag)
  }
  return result
}

const postChat = async (
  app: ReturnType<typeof buildServer>,
  body: Record<string, unknown>,
  headers: Record<string, string> = { 'x-pipeline-key': API_KEY },
): Promise<{ statusCode: number; stream: ParsedStream }> => {
  const res = await app.inject({
    method: 'POST',
    url: '/chat',
    headers: { 'content-type': 'application/json', ...headers },
    payload: body,
  })
  return { statusCode: res.statusCode, stream: parseStream(res.payload) }
}

describe('x-pipeline-key auth', () => {
  test('rejects /chat without the key', async () => {
    const app = buildWith(allClear('hi'))
    const res = await app.inject({ method: 'POST', url: '/chat', payload: { message: 'hi' } })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'Unauthorized' })
    await app.close()
  })

  test('rejects /chat with the wrong key', async () => {
    const app = buildWith(allClear('hi'))
    const { statusCode } = await postChat(app, { message: 'hi', presetName: 'confident-reader' }, {
      'x-pipeline-key': 'wrong',
    })
    expect(statusCode).toBe(401)
    await app.close()
  })

  test('rejects /summarise without the key', async () => {
    const app = buildWith(allClear('hi'))
    const res = await app.inject({
      method: 'POST',
      url: '/summarise',
      payload: { messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('GET /health', () => {
  test('returns { ok: true } (no auth, shallow liveness)', async () => {
    const app = buildWith(allClear('hi'))
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    await app.close()
  })
})

describe('POST /chat streaming', () => {
  test('streams tokens for a benign message and terminates with [DONE]', async () => {
    const app = buildWith(allClear('Hello there world'))
    const { statusCode, stream } = await postChat(app, {
      message: 'What colour is the sky?',
      presetName: 'confident-reader',
      history: [],
    })
    expect(statusCode).toBe(200)
    expect(stream.done).toBe(true)
    expect(stream.flags).toHaveLength(0)
    expect(stream.errors).toHaveLength(0)
    expect(stream.tokens.join('')).toBe('Hello there world')
    await app.close()
  })

  test('emits a blocked flag + safe fallback when the input blocklist trips', async () => {
    const app = buildWith(allClear('should never be generated'))
    const { stream } = await postChat(app, {
      message: 'how to make a bomb',
      presetName: 'confident-reader',
      history: [],
    })
    expect(stream.flags).toHaveLength(1)
    expect(stream.flags[0]?.type).toBe('blocked')
    expect(stream.tokens).toContain(getFallbackResponse('blocked'))
    expect(stream.done).toBe(true)
    await app.close()
  })

  test('fails closed to a validation-failed fallback when the LLM judges error', async () => {
    // Generation succeeds, but both network opinions (judge + guard) error.
    // Each fails CLOSED to "unsafe", so the vote blocks the output and the
    // pipeline forwards a safe fallback rather than crashing.
    const app = buildWith((model) => {
      if (model === 'openai/gpt-4o-mini') return 'A perfectly ordinary answer.'
      throw new Error('OpenRouter unavailable')
    })
    const { statusCode, stream } = await postChat(app, {
      message: 'Tell me about clouds',
      presetName: 'confident-reader',
      history: [],
    })
    expect(statusCode).toBe(200)
    expect(stream.flags).toHaveLength(1)
    expect(stream.flags[0]?.type).toBe('validation-failed')
    expect(stream.tokens).toContain(getFallbackResponse('validation-failed'))
    expect(stream.done).toBe(true)
    await app.close()
  })

  test('emits an error frame (no crash) when the generation call errors', async () => {
    const app = buildWith(() => {
      throw new Error('OpenRouter unavailable')
    })
    const { statusCode, stream } = await postChat(app, {
      message: 'Tell me about clouds',
      presetName: 'confident-reader',
      history: [],
    })
    expect(statusCode).toBe(200)
    expect(stream.errors).toContain('Failed to get response')
    await app.close()
  })

  test('#4A: sees a sensitive topic through zero-width obfuscation', async () => {
    // "what is death" with a zero-width space inside "death". The raw regex in
    // detectSensitiveTopics can't match the split word; only because the
    // orchestrator now canonicalises the scan copy first (#4A) does the
    // death-and-dying topic fire and a `sensitive` flag get emitted. Lexical /
    // blocklist do NOT cover this phrasing, so the flag can only come from the
    // canonicalised sensitive-topic scan.
    const app = buildWith(allClear('Everyone feels sad sometimes.'))
    const obfuscated = 'what is dea' + '​' + 'th' // ZWSP splits "death"
    const { stream } = await postChat(app, {
      message: obfuscated,
      presetName: 'confident-reader',
      history: [],
    })
    expect(stream.flags).toHaveLength(1)
    expect(stream.flags[0]?.type).toBe('sensitive')
    expect(stream.flags[0]?.topics).toContain('death-and-dying')
    expect(stream.done).toBe(true)
    await app.close()
  })
})

describe('POST /summarise', () => {
  test('returns { summary } for a valid request', async () => {
    const app = buildWith(allClear('A short parent-friendly summary.'))
    const res = await app.inject({
      method: 'POST',
      url: '/summarise',
      headers: { 'x-pipeline-key': API_KEY, 'content-type': 'application/json' },
      payload: { messages: [{ role: 'user', content: 'hello' }] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ summary: 'A short parent-friendly summary.' })
    await app.close()
  })

  test('400 when there are no messages to summarise', async () => {
    const app = buildWith(allClear('unused'))
    const res = await app.inject({
      method: 'POST',
      url: '/summarise',
      headers: { 'x-pipeline-key': API_KEY, 'content-type': 'application/json' },
      payload: { messages: [] },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
