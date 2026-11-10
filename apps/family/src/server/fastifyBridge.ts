// Fastify request → WHATWG fetch bridge (prod transport only). backend-kit
// bridges tRPC requests itself, but family mounts Better Auth, whose
// `handler(Request)` needs the BODY too - Fastify has already parsed it, so it
// is re-serialised here. Node-only; erasable TS (ADR 0004) since main.ts runs
// the source directly. Copied from sprout, the first consumer of this pattern.
import type { FastifyRequest } from '@hoe/backend-kit/server'

/** Copy Fastify's incoming headers into a case-insensitive fetch Headers. */
export function toFetchHeaders(req: FastifyRequest): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) for (const v of value) headers.append(key, v)
  }
  return headers
}

export function toFetchRequest(req: FastifyRequest): Request {
  const headers = toFetchHeaders(req)
  const host = req.headers.host ?? 'localhost'
  const url = `${req.protocol}://${host}${req.url}`
  const method = req.method
  const carriesBody = method !== 'GET' && method !== 'HEAD' && req.body !== undefined
  let body: string | undefined
  if (carriesBody) {
    if (typeof req.body === 'string') {
      body = req.body
    } else {
      body = JSON.stringify(req.body)
      if (!headers.has('content-type')) headers.set('content-type', 'application/json')
    }
  }
  return new Request(url, { method, headers, body })
}
