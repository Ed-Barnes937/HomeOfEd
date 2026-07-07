// Production entrypoint: `node src/server/main.ts` (native Node runs the TS
// source — ADR 0004). The same router + handlers as dev/.iwft; only the
// injected persistence differs (real Postgres via DATABASE_URL — plan §6).
import { fileURLToPath } from 'node:url'

import { createContext, InMemoryBlobStore, type AuthProvider } from '@hoe/backend-kit'
import { createAppServer, type FastifyInstance } from '@hoe/backend-kit/server'
import { createDbClient } from '@hoe/db'
import { loadDbEnv } from '@hoe/db/env'
import { createLogger, requestLogger } from '@hoe/logger'

import { childAuthProvider } from './auth/index.ts'
import { createSproutAuth } from './auth/betterAuth.ts'
import { fixedAuthProvider, resolveParentUser, type ChildUser } from './auth/providers.ts'
import { mintChildToken } from './auth/childToken.ts'
import { registerChatSseRoute } from './chat-sse.ts'
import { toFetchHeaders, toFetchRequest } from './fastifyBridge.ts'
import { createHttpPipelineClient, createHttpSummariser } from './pipeline/pipelineClient.ts'
import { scryptHasher } from './password.ts'
import { createAppRouter } from './router.ts'
import { sproutSchema } from './schema.ts'
import { DrizzleSproutStore } from './store.ts'

const logger = createLogger().child({ app: 'sprout' })
const env = loadDbEnv()

const db = await createDbClient({ driver: 'postgres', schema: sproutSchema, url: env.DATABASE_URL })
const store = new DrizzleSproutStore(db)

// Dedicated child-session signing secret (NOT BETTER_AUTH_SECRET — plan §5.2,
// blast-radius isolation). Required in prod; fail fast if missing.
const childSessionSecret = process.env.CHILD_SESSION_SECRET
if (!childSessionSecret) {
  throw new Error('CHILD_SESSION_SECRET is required')
}

// Pipeline over Fly's PRIVATE network (plan §3/§10): never a public URL. The
// real pipeline app is P6; this client is exercised end-to-end at P6 + deploy.
// PIPELINE_API_KEY must be set in prod — refuse an insecure default there.
const pipelineApiKey = process.env.PIPELINE_API_KEY
if (!pipelineApiKey && process.env.NODE_ENV === 'production') {
  throw new Error('PIPELINE_API_KEY is required in production')
}
const pipelineOpts = {
  baseUrl: process.env.PIPELINE_URL ?? 'http://hoe-sprout-pipeline.flycast:8080',
  apiKey: pipelineApiKey ?? 'dev-pipeline-key',
}
const pipeline = createHttpPipelineClient(pipelineOpts)

// Better Auth instance over the shared client — its handler is mounted at
// /api/auth/* below, and its session lookup backs parent resolution.
const auth = createSproutAuth(db)

// The child AuthProvider reads the signed child-session cookie + verifies its
// HMAC (plan §5.2, #34). Reused by both the tRPC auth seam and the SSE route.
const childProvider = childAuthProvider(childSessionSecret)

// A TRUSTED, server-stamped header carrying the resolved parent id. The
// onRequest hook (below) strips any client-supplied value and re-sets it only
// from a verified Better Auth session, so it cannot be spoofed.
const PARENT_HEADER = 'x-sprout-parent'

// The one auth seam: a request that carries the trusted parent header resolves
// to a parent (fixedAuthProvider); otherwise fall back to the child provider
// (the signed child cookie). Parent-scoped routers require the former, child-
// scoped the latter — chosen per-router by requireParent / requireChild.
const authSeam = (req: Request): AuthProvider => {
  const parentId = req.headers.get(PARENT_HEADER)
  if (parentId) return fixedAuthProvider({ id: parentId, role: 'parent' })
  return childProvider(req)
}

const makeContext = createContext({
  store,
  blobs: new InMemoryBlobStore(),
  logger,
  auth: authSeam,
})

const appRouter = createAppRouter({
  hasher: scryptHasher,
  // Real pipeline summariser (HTTP /summarise over the private network).
  summarise: createHttpSummariser(pipelineOpts),
  // Concrete Node minter, closed over the dedicated signing secret (plan §5.2).
  mintChildToken: (claims) => mintChildToken(claims, childSessionSecret),
})

// App-owned Fastify routes (D9), mounted ahead of the SPA fallback: parent
// session resolution + Better Auth handler + the chat SSE stream.
const registerRoutes = (app: FastifyInstance): void => {
  // Parent session resolution (discharges the P2 /api/auth TODO): resolve the
  // Better Auth cookie session per tRPC HTTP request (async) and stamp the
  // trusted PARENT_HEADER the auth seam reads. Strip any inbound value first —
  // a client must never be able to assert parenthood by sending the header.
  app.addHook('onRequest', async (req) => {
    delete req.headers[PARENT_HEADER]
    if (!req.url.startsWith('/api/trpc')) return
    const parent = await resolveParentUser(auth, new Request('http://localhost/', {
      headers: toFetchHeaders(req),
    }))
    if (parent) req.headers[PARENT_HEADER] = parent.id
  })

  // Better Auth handler: /api/auth/* — login / register / sign-out /
  // get-session. Forward the Fastify request (incl. body) to auth.handler and
  // relay its status/headers/body, preserving multiple Set-Cookie headers.
  app.all('/api/auth/*', async (req, reply) => {
    const response = await auth.handler(toFetchRequest(req))
    reply.status(response.status)
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') reply.header(key, value)
    })
    const setCookies = response.headers.getSetCookie()
    if (setCookies.length > 0) reply.header('set-cookie', setCookies)
    return reply.send(await response.text())
  })

  // Chat SSE stream: authenticates the child from the cookie via the same
  // child provider the auth seam uses.
  registerChatSseRoute(app, {
    store,
    pipeline,
    resolveChild: (req) =>
      childProvider(
        new Request('http://localhost/', { headers: toFetchHeaders(req) }),
      ).getUser() as ChildUser | null,
    logger,
  })
}

const server = createAppServer({
  router: appRouter,
  createContext: (req) => ({ ...makeContext(req), logger: requestLogger(logger, req) }),
  staticDir: fileURLToPath(new URL('../../dist', import.meta.url)),
  logger,
  registerRoutes,
  // Deep health: a real Store round-trip to Postgres, not just "process is up".
  healthCheck: async () => {
    await store.ping()
    return { ok: true }
  },
})

const port = Number(process.env.PORT ?? 8080)
await server.listen(port)
