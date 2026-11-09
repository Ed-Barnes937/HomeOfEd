import { fileURLToPath } from 'node:url'

import { createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { createAppServer } from '@hoe/backend-kit/server'
import { createLogger, requestLogger } from '@hoe/logger'

import { appRouter } from './router.ts'

const logger = createLogger().child({ app: 'family' })

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
  // Liveness only; ticket 03 deepens this into a real Store round-trip.
  healthCheck: () => Promise.resolve({ ok: true as const }),
})

const port = Number(process.env.PORT ?? 8080)
await server.listen(port)
