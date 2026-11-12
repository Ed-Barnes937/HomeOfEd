// Production entrypoint: `node src/server/main.ts` (native Node runs the TS
// source - ADR 0004). The same router + handlers as dev/.iwft. A stateless app
// injects no Store (ADR 0008), so there is no DATABASE_URL and /health is a
// shallow liveness check.
import { fileURLToPath } from 'node:url'

import { familyDocumentGateFromEnv } from '@hoe/accounts/server'
import { createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { createAppServer } from '@hoe/backend-kit/server'
import { createLogger, requestLogger } from '@hoe/logger'

import { appRouter } from './router.ts'

const logger = createLogger().child({ app: 'armoury' })

const makeContext = createContext<void>({
  store: undefined,
  blobs: new InMemoryBlobStore(),
  logger,
})

const server = createAppServer({
  router: appRouter,
  createContext: (req) => ({ ...makeContext(req), logger: requestLogger(logger, req) }),
  staticDir: fileURLToPath(new URL('../../dist', import.meta.url)),
  logger,
  // Shallow health: no Store, so just liveness (ADR 0008). A DB-backed app would
  // round-trip its Store here instead.
  healthCheck: () => Promise.resolve({ ok: true as const }),
  // On exactly when FAMILY_ACCOUNT_URL is set (ADR 0093); share links stay open at /shared.
  documentGate: familyDocumentGateFromEnv(process.env, { publicPaths: ['/shared'] }),
})

const port = Number(process.env.PORT ?? 8080)
await server.listen(port)
