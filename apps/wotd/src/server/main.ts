// Production entrypoint: `node src/server/main.ts` (native Node runs the TS
// source — ADR 0004). The same router + handlers as dev/.iwft; only the injected
// persistence (real Postgres) and generator (Anthropic) differ.
import { fileURLToPath } from 'node:url'

import { createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { createAppServer } from '@hoe/backend-kit/server'
import { createDbClient } from '@hoe/db'
import { loadDbEnv } from '@hoe/db/env'
import { createLogger, requestLogger } from '@hoe/logger'

import { AnthropicWordGenerator } from './anthropicWordGenerator.ts'
import { createAppRouter } from './router.ts'
import { wotdSchema } from './schema.ts'
import { DrizzleWotdStore } from './store.ts'

const logger = createLogger().child({ app: 'wotd' })
const env = loadDbEnv()

const db = await createDbClient({ driver: 'postgres', schema: wotdSchema, url: env.DATABASE_URL })
const store = new DrizzleWotdStore(db)
// The generator builds its Anthropic client lazily, so a missing key doesn't
// crash boot — only /wotd's lazy generation fails.
const generator = new AnthropicWordGenerator({ apiKey: process.env.ANTHROPIC_API_KEY })

const makeContext = createContext({
  store,
  blobs: new InMemoryBlobStore(),
  logger,
})

const server = createAppServer({
  router: createAppRouter(generator),
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
