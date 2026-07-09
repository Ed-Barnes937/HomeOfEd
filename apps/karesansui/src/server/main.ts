// Production entrypoint: `node src/server/main.ts` (native Node runs the TS
// source — ADR 0004). The same router + handlers as dev/.iwft; karesansui has
// no database (ADR 0008), so the only "persistence" is the in-memory store.
import { fileURLToPath } from 'node:url'

import { createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { createAppServer } from '@hoe/backend-kit/server'
import { createLogger, requestLogger } from '@hoe/logger'

import { appRouter } from './router.ts'
import { InMemoryStatusStore } from './store.ts'

const logger = createLogger().child({ app: 'karesansui' })

const store = new InMemoryStatusStore()

const makeContext = createContext({
  store,
  blobs: new InMemoryBlobStore(),
  logger,
})

const server = createAppServer({
  router: appRouter,
  createContext: (req) => ({ ...makeContext(req), logger: requestLogger(logger, req) }),
  staticDir: fileURLToPath(new URL('../../dist', import.meta.url)),
  logger,
  // "process up + serving" — there is no database to round-trip (ADR 0008).
  healthCheck: async () => {
    await store.ping()
    return { ok: true }
  },
})

const port = Number(process.env.PORT ?? 8080)
await server.listen(port)
