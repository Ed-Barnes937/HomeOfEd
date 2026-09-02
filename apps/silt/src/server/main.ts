// Production entrypoint: `node src/server/main.ts` (native Node runs the TS
// source — ADR 0004). The same router + handlers as dev/.iwft. A stateless app
// injects no Store (ADR 0008), so there is no DATABASE_URL and /health is a
// shallow liveness check.
import { fileURLToPath } from 'node:url'

import { createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { createAppServer } from '@hoe/backend-kit/server'
import { createLogger, requestLogger } from '@hoe/logger'

import { addCrossOriginIsolation } from './headers.ts'
import { appRouter } from './router.ts'

const logger = createLogger().child({ app: 'silt' })

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
  // COOP/COEP on every response — cross-origin isolation for the sim worker
  // (120fps ticket 02; see headers.ts).
  registerRoutes: addCrossOriginIsolation,
})

const port = Number(process.env.PORT ?? 8080)
await server.listen(port)
