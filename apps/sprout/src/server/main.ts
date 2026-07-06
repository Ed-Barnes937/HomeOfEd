// Production entrypoint: `node src/server/main.ts` (native Node runs the TS
// source — ADR 0004). The same router + handlers as dev/.iwft; only the
// injected persistence differs (real Postgres via DATABASE_URL — plan §6).
import { fileURLToPath } from 'node:url'

import { createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { createAppServer } from '@hoe/backend-kit/server'
import { createDbClient } from '@hoe/db'
import { loadDbEnv } from '@hoe/db/env'
import { createLogger, requestLogger } from '@hoe/logger'

import { childAuthProvider } from './auth/index.ts'
import { appRouter } from './router.ts'
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

const makeContext = createContext({
  store,
  blobs: new InMemoryBlobStore(),
  logger,
  // The child AuthProvider fits the synchronous `auth` seam directly: it reads
  // the signed child-session cookie and verifies its HMAC (plan §5.2, #34).
  auth: childAuthProvider(childSessionSecret),
})

// TODO(P5/D9): mount the parent auth path. It needs the additive
// `registerRoutes?(app)` hook on `createAppServer` (D9), which does not exist
// yet — do NOT fork buildAppServer to add it here. When the hook lands, P5 must:
//   1. `const auth = createSproutAuth(db)` and register `auth.handler` as a
//      Fastify route at `/api/auth/*` (verbatim forward of req → Response).
//   2. Resolve the Better Auth cookie session per request (async) — e.g. an
//      onRequest hook calling `resolveParentUser(auth, req)` — and select the
//      parent provider (`fixedAuthProvider(parentUser)`) for parent-scoped
//      routers, keeping the child provider above for child-scoped routers.
//      Provider selection is per-router and is finalised in P3/P5.
//   3. Set `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` from the environment.

const server = createAppServer({
  router: appRouter,
  createContext: (req) => ({ ...makeContext(req), logger: requestLogger(logger, req) }),
  staticDir: fileURLToPath(new URL('../../dist', import.meta.url)),
  logger,
  // Deep health: a real Store round-trip to Postgres, not just "process is up".
  healthCheck: async () => {
    await store.ping()
    return { ok: true }
  },
})

const port = Number(process.env.PORT ?? 8080)
await server.listen(port)
