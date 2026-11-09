import { fileURLToPath } from 'node:url'

import { createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { createAppServer } from '@hoe/backend-kit/server'
import { createDbClient } from '@hoe/db'
import { loadDbEnv } from '@hoe/db/env'
import { createLogger, requestLogger } from '@hoe/logger'

import { appRouter } from './router.ts'
import { familySchema } from './schema.ts'
import { DrizzleFamilyStore } from './store.ts'

const logger = createLogger().child({ app: 'family' })
const env = loadDbEnv()

const db = await createDbClient({ driver: 'postgres', schema: familySchema, url: env.DATABASE_URL })
const store = new DrizzleFamilyStore(db)

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
  // Deep health: a real Store round-trip to Postgres, not just "process is up".
  healthCheck: async () => {
    await store.ping()
    return { ok: true }
  },
})

const port = Number(process.env.PORT ?? 8080)
await server.listen(port)
