// Fastify request → WHATWG fetch bridge (prod transport only). The backend-kit
// server bridges tRPC requests itself, but sprout mounts two extra Fastify
// routes whose collaborators speak fetch: Better Auth's `handler(Request)` and
// the child `AuthProvider` (which reads the cookie off a fetch Request). This
// carries method/url/headers — and, unlike the kit's internal bridge, the BODY
// — across so Better Auth can read POST payloads. Node-only; erasable TS
// (ADR 0004) since main.ts runs the source directly.
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

/**
 * Build a fetch Request from a Fastify request, including a JSON-serialised
 * body for non-GET/HEAD (Fastify has already parsed it into `req.body`). Used
 * for the Better Auth handler mount; header-only consumers can use
 * `toFetchHeaders` directly.
 */
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
