// The prod transport: one Fastify process serving the built SPA bundle,
// the app's tRPC router, and the deep /health route. Node-only — exported
// via the '@hoe/backend-kit/server' subpath so it never enters browser
// bundles (mirrors './simulator').
//
// WS escalation (ADR 0001 §3): when an app outgrows this, @fastify/websocket
// is the documented path — wired per app then, not here.
import path from 'node:path'

import fastifyStatic from '@fastify/static'
import type { AnyTRPCRouter } from '@trpc/server'
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

import type { AppContext } from '../context.ts'
import type { Logger } from '../logger.ts'

const TRPC_ENDPOINT = '/api/trpc'
const API_PREFIX = '/api'
const HEALTH_PATH = '/health'

export interface CreateAppServerOpts {
  router: AnyTRPCRouter
  createContext: (req: Request) => AppContext<unknown>
  staticDir: string
  logger: Logger
  /** Deep health: the app closes this over its own Store (real round-trip). */
  healthCheck: () => Promise<{ ok: true }>
  /**
   * Optional route-registration hook (ADR D9 — sprout migration plan §5.4).
   * Called with the configured Fastify instance AFTER the tRPC plugin + /health
   * but BEFORE @fastify/static and the SPA notFound fallback, so app-owned
   * routes (e.g. a plain SSE stream at `/api/chat/stream`, a Better Auth handler
   * at `/api/auth/*`) win over the SPA catch-all. Purely additive: apps that
   * omit it get the exact same pipeline as before. Apps type this with the
   * `FastifyInstance` re-exported below (so they need no direct `fastify` dep).
   */
  registerRoutes?: (app: FastifyInstance) => void | Promise<void>
  /**
   * Cap on how many procedures one batched tRPC call may fan out to. tRPC's own
   * default is unlimited, so an app serving database-backed procedures sets
   * this to bound the work a single request can ask for.
   */
  maxBatchSize?: number
  /**
   * Gates document requests (GET/HEAD, not `/api`, not `/health`, no file
   * extension but `.html`) behind a 302, ahead of static files and the SPA
   * fallback (ADR 0093). Omitted, the pipeline is unchanged.
   */
  documentGate?: DocumentGate
}

export interface DocumentGate {
  /** Path prefixes, matched on whole segments, that skip the gate. */
  publicPaths: readonly string[]
  /** null = let it through; a string = the absolute URL to 302 to. */
  redirectFor: (req: { host: string; url: string; cookie: string | null }) => string | null
}

// Re-exported so consumers can type their `registerRoutes` hook (and the routes
// it registers) without adding a direct `fastify` dependency.
export type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/** The app's per-request context factory takes a fetch Request; Fastify hands
 * us its own request type — bridge the headers/method/url across. (The body
 * is not carried: context derivation reads the request envelope, tRPC's own
 * adapter consumes the body.) */
function toFetchRequest(req: FastifyRequest): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) for (const v of value) headers.append(key, v)
  }
  const host = req.headers.host ?? 'localhost'
  return new Request(`${req.protocol}://${host}${req.url}`, { method: req.method, headers })
}

// The path @fastify/static would resolve: decoded, dot segments collapsed, so
// `/shared/..%2Findex.html` is classified as `/index.html`.
function pathnameOf(req: FastifyRequest): string {
  const query = req.url.indexOf('?')
  const raw = query === -1 ? req.url : req.url.slice(0, query)
  try {
    return path.posix.normalize(decodeURIComponent(raw))
  } catch {
    return path.posix.normalize(raw)
  }
}

function isDocumentRequest(req: FastifyRequest): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  const pathname = pathnameOf(req)
  if (pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)) return false
  if (pathname === HEALTH_PATH) return false
  const ext = path.posix.extname(pathname).toLowerCase()
  return ext === '' || ext === '.html'
}

function isPublicPath(pathname: string, publicPaths: readonly string[]): boolean {
  return publicPaths.some((prefix) =>
    prefix.endsWith('/')
      ? pathname.startsWith(prefix)
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function isGatedDocument(req: FastifyRequest, gate: DocumentGate): boolean {
  return isDocumentRequest(req) && !isPublicPath(pathnameOf(req), gate.publicPaths)
}

/**
 * Build the configured Fastify instance without listening. Exported so tests
 * can drive it with `fastify.inject()`; apps use `createAppServer` below.
 */
export async function buildAppServer(opts: CreateAppServerOpts): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  const gate = opts.documentGate
  if (gate) {
    app.addHook('onRequest', (req, reply, done) => {
      if (!isGatedDocument(req, gate)) return done()
      const target = gate.redirectFor({
        host: req.headers.host ?? '',
        url: req.url,
        cookie: req.headers.cookie ?? null,
      })
      if (target === null) return done()
      void reply.header('cache-control', 'no-store').redirect(target, 302)
    })
    // onSend, because @fastify/static sets its own Cache-Control after onRequest.
    app.addHook('onSend', (req, reply, _payload, done) => {
      if (isGatedDocument(req, gate)) void reply.header('cache-control', 'no-store')
      done()
    })
  }

  await app.register(fastifyTRPCPlugin, {
    prefix: TRPC_ENDPOINT,
    trpcOptions: {
      router: opts.router,
      createContext: ({ req }) => opts.createContext(toFetchRequest(req)),
      maxBatchSize: opts.maxBatchSize,
      onError: ({ error, path }) => {
        opts.logger.error('trpc request failed', {
          path,
          code: error.code,
          message: error.message,
        })
      },
    } satisfies FastifyTRPCPluginOptions<AnyTRPCRouter>['trpcOptions'],
  })

  app.get('/health', async (_req, reply) => {
    try {
      return await opts.healthCheck()
    } catch (err) {
      opts.logger.error('health check failed', { error: String(err) })
      return reply.status(503).send({ ok: false })
    }
  })

  // App-owned routes (D9): mounted here so they take precedence over the static
  // handler and the SPA notFound fallback registered below.
  await opts.registerRoutes?.(app)

  await app.register(fastifyStatic, { root: opts.staticDir })

  // SPA fallback: unknown non-API GET/HEAD → index.html (client-side routing).
  // With a gate, only document requests (which have passed it) fall back to
  // index.html; otherwise `/missing.js` would serve the app ungated.
  app.setNotFoundHandler((req, reply) => {
    const isRead = req.method === 'GET' || req.method === 'HEAD'
    const fallsBack = gate ? isDocumentRequest(req) : isRead && !req.url.startsWith(API_PREFIX)
    if (fallsBack) {
      return reply.sendFile('index.html')
    }
    return reply.status(404).send({ error: 'Not Found' })
  })

  return app
}

/**
 * The prod server factory (signature frozen in T1.1). `close()` is an
 * additive extra for tests and graceful shutdown — not part of the frozen
 * contract.
 */
export function createAppServer(opts: CreateAppServerOpts): {
  listen(port: number): Promise<void>
  close(): Promise<void>
} {
  let app: FastifyInstance | undefined
  return {
    async listen(port: number): Promise<void> {
      app = await buildAppServer(opts)
      await app.listen({ port, host: '0.0.0.0' })
      opts.logger.info('server listening', { port })
    },
    async close(): Promise<void> {
      await app?.close()
    },
  }
}
