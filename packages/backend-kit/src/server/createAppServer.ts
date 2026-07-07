// The prod transport: one Fastify process serving the built SPA bundle,
// the app's tRPC router, and the deep /health route. Node-only — exported
// via the '@hoe/backend-kit/server' subpath so it never enters browser
// bundles (mirrors './simulator').
//
// WS escalation (ADR 0001 §3): when an app outgrows this, @fastify/websocket
// is the documented path — wired per app then, not here.
import fastifyStatic from '@fastify/static'
import type { AnyTRPCRouter } from '@trpc/server'
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

import type { AppContext } from '../context.ts'
import type { Logger } from '../logger.ts'

const TRPC_ENDPOINT = '/api/trpc'
const API_PREFIX = '/api'

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

/**
 * Build the configured Fastify instance without listening. Exported so tests
 * can drive it with `fastify.inject()`; apps use `createAppServer` below.
 */
export async function buildAppServer(opts: CreateAppServerOpts): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(fastifyTRPCPlugin, {
    prefix: TRPC_ENDPOINT,
    trpcOptions: {
      router: opts.router,
      createContext: ({ req }) => opts.createContext(toFetchRequest(req)),
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
  app.setNotFoundHandler((req, reply) => {
    const isRead = req.method === 'GET' || req.method === 'HEAD'
    if (isRead && !req.url.startsWith(API_PREFIX)) {
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
