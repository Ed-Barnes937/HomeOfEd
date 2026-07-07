// A frame-boundary-safe reader for a `text/event-stream` body. Pure and
// isomorphic (uses only ReadableStream + TextDecoder, global in Node 22 and the
// browser), so BOTH the browser chat client (features/chat) and the Node
// pipeline HTTP client (server/pipeline) parse SSE the same way.
//
// FIX (P5 — the prior review's frame-boundary bug): the source reader did
//   const lines = decoder.decode(value).split('\n')
// per `reader.read()` chunk with NO buffer carried across reads. A `data: {…}`
// frame that spanned two network chunks was split down the middle: the tail of
// one chunk and the head of the next never re-joined, so that token (or whole
// flag event) was silently dropped. Here we accumulate into `buffer`, emit only
// COMPLETE lines (up to each '\n'), and keep the trailing partial line for the
// next read — no frame is ever cut in half.

/** Parse one SSE line's `data:` payload. Returns the decoded JSON value, or
 * `null` for non-data lines, the `[DONE]` sentinel, and unparseable payloads. */
export function parseSseData(line: string): unknown {
  const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line
  if (!trimmed.startsWith('data: ')) return null
  const payload = trimmed.slice(6)
  if (payload === '[DONE]') return null
  try {
    return JSON.parse(payload) as unknown
  } catch {
    return null
  }
}

/**
 * Yield each parsed `data:` payload from an event-stream body, buffering across
 * `read()` boundaries so a frame split mid-line is never dropped.
 */
export async function* readSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown, void, void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        const parsed = parseSseData(line)
        if (parsed !== null) yield parsed
        newline = buffer.indexOf('\n')
      }
    }
    // Flush a trailing line with no final newline (a stream that ends mid-frame
    // still surfaces its last complete `data:` payload).
    const parsed = parseSseData(buffer)
    if (parsed !== null) yield parsed
  } finally {
    reader.releaseLock()
  }
}
