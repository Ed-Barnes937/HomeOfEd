import { fileURLToPath } from 'node:url'

import { mintFamilyToken } from '@hoe/accounts/server'
import { createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { createAppServer, type FastifyInstance } from '@hoe/backend-kit/server'
import { createDbClient } from '@hoe/db'
import { loadDbEnv } from '@hoe/db/env'
import { createLogger, requestLogger } from '@hoe/logger'

import { createFamilyAuth } from './auth/betterAuth.ts'
import { familySeam, publicKeyFromPrivateKey } from './auth/familySeam.ts'
import { registerParentSessionBridge } from './auth/parentSessionBridge.ts'
import { identityAllowedOrigins, registerCors, saveAllowedOrigins } from './cors.ts'
import { loadFamilyEnv } from './env.ts'
import { toFetchRequest } from './fastifyBridge.ts'
import { createAppRouter } from './router.ts'
import { familySchema } from './schema.ts'
import { DrizzleFamilyStore } from './store.ts'

const logger = createLogger().child({ app: 'family' })
const dbEnv = loadDbEnv()
const env = loadFamilyEnv()

const db = await createDbClient({
  driver: 'postgres',
  schema: familySchema,
  url: dbEnv.DATABASE_URL,
})
const store = new DrizzleFamilyStore(db)

// Two tiers, because the two routers answer to different credentials: identity
// and /api/auth/* are the hub account UI alone, the save router also serves
// onboarded app origins (ADR 0079).
const origins = identityAllowedOrigins(process.env.NODE_ENV)
const corsTiers = { identity: origins, save: saveAllowedOrigins(process.env.NODE_ENV) }

const auth = createFamilyAuth(db, {
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  inviteCode: env.REGISTRATION_INVITE_CODE,
  trustedOrigins: origins,
})

const makeContext = createContext({
  store,
  blobs: new InMemoryBlobStore(),
  logger,
  auth: familySeam(publicKeyFromPrivateKey(env.FAMILY_TOKEN_PRIVATE_KEY)),
})

const registerRoutes = (app: FastifyInstance): void => {
  registerCors(app, corsTiers)
  registerParentSessionBridge(app, auth)

  // Better Auth's own endpoints: sign-up (invite-gated), sign-in, sign-out,
  // get-session. Multiple Set-Cookie headers must survive the relay.
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
}

const server = createAppServer({
  router: createAppRouter({
    mintToken: (input) => mintFamilyToken(input, env.FAMILY_TOKEN_PRIVATE_KEY),
  }),
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
