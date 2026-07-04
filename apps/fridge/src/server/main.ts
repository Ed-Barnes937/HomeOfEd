// Production entrypoint: `node src/server/main.ts` (native Node runs the TS
// source — ADR 0004). The same router + handlers as dev/.iwft; only the
// injected persistence differs (real Postgres via DATABASE_URL — ADR 0010).
import { fileURLToPath } from 'node:url'

import { createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { createAppServer } from '@hoe/backend-kit/server'
import { createDbClient } from '@hoe/db'
import { loadDbEnv } from '@hoe/db/env'
import { createLogger, requestLogger } from '@hoe/logger'

import { appRouter } from './router.ts'
import { fridgeSchema } from './schema.ts'
import { DrizzleFridgeStore } from './store.ts'

const logger = createLogger().child({ app: 'fridge' })
const env = loadDbEnv()

const db = await createDbClient({ driver: 'postgres', schema: fridgeSchema, url: env.DATABASE_URL })
const store = new DrizzleFridgeStore(db)

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
  // Deep health: a real Store round-trip to Postgres, not just "process is up".
  healthCheck: async () => {
    await store.ping()
    return { ok: true }
  },
})

const port = Number(process.env.PORT ?? 8080)
await server.listen(port)
