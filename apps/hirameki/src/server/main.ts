// Production entrypoint: `node src/server/main.ts` (native Node runs the TS
// source — ADR 0004). The same router + handlers as dev/.iwft. A stateless app
// injects no Store (ADR 0008), so there is no DATABASE_URL and /health is a
// shallow liveness check.
import { fileURLToPath } from 'node:url'

import { createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { createAppServer } from '@hoe/backend-kit/server'
import { createLogger, requestLogger } from '@hoe/logger'

import { appRouter } from './router.ts'

const logger = createLogger().child({ app: 'hirameki' })

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
})

const port = Number(process.env.PORT ?? 8080)
await server.listen(port)
