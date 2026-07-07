import { describe, expect, it } from 'vitest'

import { parseSseData, readSseStream } from './sseFrames.ts'

// Build a ReadableStream that emits the given string pieces as separate chunks
// — this is how we reproduce the frame-boundary bug: the split points fall
// wherever we choose, including in the middle of a `data:` frame.
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]))
        i += 1
      } else {
        controller.close()
      }
    },
  })
}

async function collect(chunks: string[]): Promise<unknown[]> {
  const out: unknown[] = []
  for await (const value of readSseStream(streamOf(chunks))) out.push(value)
  return out
}

const frame = (obj: unknown): string => `data: ${JSON.stringify(obj)}\n\n`

describe('parseSseData', () => {
  it('parses a data: JSON payload', () => {
    expect(parseSseData('data: {"token":"hi"}')).toEqual({ token: 'hi' })
  })

  it('ignores the [DONE] sentinel, blank lines, and non-data lines', () => {
    expect(parseSseData('data: [DONE]')).toBeNull()
    expect(parseSseData('')).toBeNull()
    expect(parseSseData(': keep-alive')).toBeNull()
  })

  it('tolerates a trailing CR and unparseable payloads', () => {
    expect(parseSseData('data: {"token":"x"}\r')).toEqual({ token: 'x' })
    expect(parseSseData('data: not json')).toBeNull()
  })
})

describe('readSseStream frame buffering', () => {
  it('yields every token when frames arrive one chunk each', async () => {
    const out = await collect([frame({ token: 'a' }), frame({ token: 'b' }), 'data: [DONE]\n\n'])
    expect(out).toEqual([{ token: 'a' }, { token: 'b' }])
  })

  it('does NOT drop a token when a frame is split across two reads (the bug)', async () => {
    // 'data: {"token":"hello"}\n\n' split mid-JSON. The old per-chunk splitter
    // parsed 'data: {"tok' and 'en":"hello"}' separately and dropped it.
    const whole = frame({ token: 'hello' })
    const cut = 12 // inside the JSON object
    const out = await collect([whole.slice(0, cut), whole.slice(cut), 'data: [DONE]\n\n'])
    expect(out).toEqual([{ token: 'hello' }])
  })

  it('reassembles many tokens across arbitrary byte boundaries', async () => {
    const tokens = ['The ', 'quick ', 'brown ', 'fox']
    const full = tokens.map((t) => frame({ token: t })).join('') + 'data: [DONE]\n\n'
    // Re-chunk into fixed 7-byte slices so most frames straddle a boundary.
    const chunks: string[] = []
    for (let i = 0; i < full.length; i += 7) chunks.push(full.slice(i, i + 7))
    const out = await collect(chunks)
    expect(out).toEqual(tokens.map((t) => ({ token: t })))
  })

  it('surfaces flag and error frames alongside tokens', async () => {
    const out = await collect([
      frame({ flag: { type: 'sensitive', reason: 'topic', childMessage: 'q' } }),
      frame({ token: 'safe answer' }),
      frame({ error: 'boom' }),
      'data: [DONE]\n\n',
    ])
    expect(out).toEqual([
      { flag: { type: 'sensitive', reason: 'topic', childMessage: 'q' } },
      { token: 'safe answer' },
      { error: 'boom' },
    ])
  })

  it('flushes a final frame that has no trailing newline', async () => {
    const out = await collect(['data: {"token":"tail"}'])
    expect(out).toEqual([{ token: 'tail' }])
  })
})
