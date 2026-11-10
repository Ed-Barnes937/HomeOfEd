// The estate gate (ADR 0093): document requests need the gate's say-so before
// @fastify/static or the SPA fallback answers them. Wired by buildAppServer.
import path from 'node:path'

import type { FastifyInstance, FastifyRequest } from 'fastify'

import type { Logger } from '../logger.ts'

export interface DocumentGate {
  /** Path prefixes, matched on whole segments, that skip the gate. */
  publicPaths: readonly string[]
  /** null = let it through; a string = the absolute URL to 302 to. */
  redirectFor: (req: { host: string; url: string; cookie: string | null }) => string | null
}

const API_PREFIX = '/api'
const HEALTH_PATH = '/health'

// A dot segment in any encoding, an encoded slash or backslash, or a literal
// backslash: the gate and @fastify/static could resolve these differently.
const AMBIGUOUS_PATH = /(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)|%2f|%5c|\\/i

/** `document` is a gated document the gate let through. */
type Verdict = 'document' | 'public' | 'api' | 'other'

type Decision = { kind: 'allow' } | { kind: 'redirect'; target: string } | { kind: 'error' }

/** Decoded exactly as @fastify/static decodes it, or null when ambiguous. */
function unambiguousPathname(url: string): string | null {
  const query = url.indexOf('?')
  const raw = query === -1 ? url : url.slice(0, query)
  if (!raw.startsWith('/') || AMBIGUOUS_PATH.test(raw)) return null
  try {
    return decodeURI(raw)
  } catch {
    return null
  }
}

function isPublicPath(pathname: string, publicPaths: readonly string[]): boolean {
  return publicPaths.some((prefix) =>
    prefix.endsWith('/')
      ? pathname.startsWith(prefix)
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function classify(method: string, pathname: string, gate: DocumentGate): Verdict {
  if (pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)) return 'api'
  if (method !== 'GET' && method !== 'HEAD') return 'other'
  if (pathname === HEALTH_PATH) return 'other'
  const ext = path.posix.extname(pathname).toLowerCase()
  if (ext !== '' && ext !== '.html') return 'other'
  return isPublicPath(pathname, gate.publicPaths) ? 'public' : 'document'
}

function isAbsoluteHttpUrl(target: string): boolean {
  try {
    const { protocol } = new URL(target)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

const REPLACED_HEADERS = [
  'content-type',
  'content-length',
  'content-encoding',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
]

/**
 * Adds the gate's hooks to `app` and returns the SPA fallback's rule: serve
 * index.html only to a request classified as an allowed or public document.
 */
export function installDocumentGate(
  app: FastifyInstance,
  gate: DocumentGate,
  logger: Logger,
): (req: FastifyRequest) => boolean {
  const verdicts = new WeakMap<FastifyRequest['raw'], Verdict>()

  function decide(req: FastifyRequest): Decision {
    let target: string | null
    try {
      target = gate.redirectFor({
        host: req.headers.host ?? '',
        url: req.url,
        cookie: req.headers.cookie ?? null,
      })
    } catch (err) {
      logger.error('document gate failed', { error: String(err) })
      return { kind: 'error' }
    }
    if (target === null) return { kind: 'allow' }
    if (!isAbsoluteHttpUrl(target)) {
      logger.error('document gate failed', { error: 'redirectFor returned a non-absolute URL' })
      return { kind: 'error' }
    }
    return { kind: 'redirect', target }
  }

  app.addHook('onRequest', (req, reply, done) => {
    const pathname = unambiguousPathname(req.url)
    if (pathname === null) return void reply.code(400).send({ error: 'Bad Request' })

    const verdict = classify(req.method, pathname, gate)
    if (verdict === 'document') {
      const decision = decide(req)
      if (decision.kind === 'error') {
        return void reply
          .code(500)
          .header('cache-control', 'no-store')
          .send({ error: 'Internal Server Error' })
      }
      if (decision.kind === 'redirect') {
        return void reply.header('cache-control', 'no-store').redirect(decision.target, 302)
      }
    }
    verdicts.set(req.raw, verdict)
    done()
  })

  // HTML is default-deny: whatever path produced it, it leaves only for a
  // request already let through, or after passing the gate here.
  app.addHook('onSend', (req, reply, payload, done) => {
    const verdict = verdicts.get(req.raw)
    if (verdict === 'public' || verdict === 'api') return done(null, payload)
    const isHtml = String(reply.getHeader('content-type') ?? '').startsWith('text/html')
    if (verdict !== 'document' && !isHtml) return done(null, payload)

    const decision: Decision = verdict === 'document' ? { kind: 'allow' } : decide(req)
    // Set here, not in onRequest, because @fastify/static writes its own later.
    void reply.header('cache-control', 'no-store')
    if (decision.kind === 'allow') return done(null, payload)

    if (payload && typeof (payload as NodeJS.ReadableStream).pipe === 'function') {
      ;(payload as { destroy?: () => void }).destroy?.()
    }
    for (const header of REPLACED_HEADERS) reply.removeHeader(header)
    if (decision.kind === 'redirect') {
      void reply.code(302).header('location', decision.target)
      return done(null, '')
    }
    void reply.code(500).header('content-type', 'application/json; charset=utf-8')
    done(null, JSON.stringify({ error: 'Internal Server Error' }))
  })

  return (req) => {
    const verdict = verdicts.get(req.raw)
    return verdict === 'document' || verdict === 'public'
  }
}
