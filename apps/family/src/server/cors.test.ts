import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConsoleLogger, createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { buildAppServer, type FastifyInstance } from '@hoe/backend-kit/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { identityAllowedOrigins, registerCors, saveAllowedOrigins, type CorsTiers } from './cors.ts'
import { onboardedAppOrigins } from './onboardedApps.ts'
import { createAppRouter } from './router.ts'

const ALLOWED = 'https://homeofed.com'
const APP_ORIGIN = 'https://boop.homeofed.com'
const ORIGINS = identityAllowedOrigins('production')

let app: FastifyInstance

async function buildServer(tiers: CorsTiers): Promise<FastifyInstance> {
  return buildAppServer({
    router: createAppRouter({
      mintToken: () => {
        throw new Error('not used')
      },
    }),
    // The store is irrelevant here: only `greeting` is called, and only for
    // its response headers.
    createContext: createContext<unknown>({
      store: undefined,
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger(),
    }),
    staticDir: await mkdtemp(join(tmpdir(), 'family-cors-')),
    logger: new ConsoleLogger(),
    healthCheck: () => Promise.resolve({ ok: true }),
    registerRoutes: (instance) => registerCors(instance, tiers),
  })
}

// The real pipeline: backend-kit registers the tRPC plugin BEFORE calling
// registerRoutes, so this is also the proof that a hook added there still
// reaches /api/trpc.
beforeEach(async () => {
  app = await buildServer({ identity: ORIGINS, save: saveAllowedOrigins('production') })
})

afterEach(async () => {
  await app.close()
})

describe('the CORS allowlist', () => {
  it('lets an allowlisted origin call the tRPC surface with credentials', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/trpc/greeting',
      headers: { origin: ALLOWED },
    })

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED)
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('answers an allowlisted preflight with the credentialled allow headers', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/trpc/identity.me',
      headers: { origin: ALLOWED, 'access-control-request-method': 'POST' },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED)
    expect(response.headers['access-control-allow-credentials']).toBe('true')
    expect(response.headers['access-control-allow-headers']).toBe('content-type')
  })

  it.each(['https://evil.example', 'https://boop.homeofed.com'])(
    'grants %s nothing, and never reflects it back',
    async (origin) => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/trpc/identity.me',
        headers: { origin, 'access-control-request-method': 'POST' },
      })

      expect(response.headers['access-control-allow-origin']).toBeUndefined()
      expect(response.headers['access-control-allow-credentials']).toBeUndefined()
    },
  )

  it('marks the preflight as varying by origin, so no cache crosses origins', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/trpc/identity.me',
      headers: { origin: ALLOWED, 'access-control-request-method': 'POST' },
    })

    expect(response.headers['vary']).toContain('Origin')
  })
})

describe('the save router CORS tier', () => {
  const preflight = (url: string, origin: string) =>
    app.inject({
      method: 'OPTIONS',
      url,
      headers: { origin, 'access-control-request-method': 'POST' },
    })

  it('lets an onboarded app origin call the save router with credentials', async () => {
    const response = await preflight('/api/trpc/save.put', APP_ORIGIN)

    expect(response.headers['access-control-allow-origin']).toBe(APP_ORIGIN)
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('still grants that origin nothing on the identity router', async () => {
    const response = await preflight('/api/trpc/identity.deleteAccount', APP_ORIGIN)

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('grants an origin that is not onboarded nothing on the save router', async () => {
    const response = await preflight('/api/trpc/save.put', 'https://evil.example')

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('serves the hub account UI on both tiers', async () => {
    const response = await preflight('/api/trpc/save.put', ALLOWED)

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED)
  })

  it('allows a batch of save procedures alone', async () => {
    const response = await preflight('/api/trpc/save.get,save.list?batch=1', APP_ORIGIN)

    expect(response.headers['access-control-allow-origin']).toBe(APP_ORIGIN)
  })

  // tRPC batches several procedures into one path, so anything but a pure save
  // batch falls back to the identity tier - otherwise an app origin could hide
  // identity.deleteAccount behind a save procedure and read the reply.
  it.each([
    '/api/trpc/save.get,identity.me?batch=1',
    '/api/trpc/identity.me,save.get?batch=1',
    '/api/trpc/save.get%2Cidentity.deleteAccount?batch=1',
    '/api/trpc/saveX.get',
    '/api/trpc/',
  ])('grants an app origin nothing on %s', async (url) => {
    const response = await preflight(url, APP_ORIGIN)

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('saveAllowedOrigins', () => {
  it('is never a wildcard', () => {
    expect(saveAllowedOrigins('production')).not.toContain('*')
    expect(saveAllowedOrigins(undefined)).not.toContain('*')
  })

  it('admits every onboarded app origin, and the identity tier with them', () => {
    const origins = saveAllowedOrigins('production')

    for (const origin of [...onboardedAppOrigins(), ...identityAllowedOrigins('production')]) {
      expect(origins).toContain(origin)
    }
  })

  it('admits no estate subdomain that is not an onboarded app', () => {
    const estate = saveAllowedOrigins('production').filter((origin) =>
      origin.endsWith('.homeofed.com'),
    )

    expect(estate).toEqual([...onboardedAppOrigins()])
  })

  it('adds the localhost dev servers only outside production', () => {
    expect(saveAllowedOrigins(undefined)).toContain('http://localhost:3008')
    expect(saveAllowedOrigins('production')).not.toContain('http://localhost:3008')
  })
})

describe('identityAllowedOrigins', () => {
  it('is never a wildcard', () => {
    expect(identityAllowedOrigins('production')).not.toContain('*')
    expect(identityAllowedOrigins(undefined)).not.toContain('*')
  })

  it('is the hub account UI alone in production', () => {
    expect(identityAllowedOrigins('production')).toEqual(['https://homeofed.com'])
  })

  it('adds the localhost dev servers only outside production', () => {
    expect(identityAllowedOrigins(undefined)).toContain('http://localhost:3000')
  })

  // The identity router is cookie-authorised and every estate subdomain is
  // same-site, so an app origin here would let an XSS in that app erase a
  // household. Onboarded apps get the save router's own list (ticket 05).
  it.each(['production', undefined])(
    'never admits an onboarded app origin, under NODE_ENV=%s',
    (nodeEnv) => {
      const origins = identityAllowedOrigins(nodeEnv)
      expect(origins).not.toContain('https://boop.homeofed.com')
      expect(origins.filter((origin) => origin.endsWith('.homeofed.com'))).toEqual([])
    },
  )
})

const DOCKER_STACK = { dockerStack: true }
const STACK_HUB = 'http://localhost:8080'
const STACK_BOOP = 'http://localhost:8088'
const STACK_BOIDS = 'http://localhost:8081'

describe('the docker-stack origins', () => {
  // Only the hub account UI, as in production: an app's compose origin here
  // would rehearse the very hole ADR 0078 decision 3 closes.
  it('add hub on its compose port to the identity tier, and nothing else', () => {
    expect(identityAllowedOrigins('production', DOCKER_STACK)).toEqual([
      'https://homeofed.com',
      STACK_HUB,
    ])
  })

  it('add the onboarded apps on their compose ports to the save tier alone', () => {
    const save = saveAllowedOrigins('production', DOCKER_STACK)

    expect(save).toContain(STACK_BOOP)
    expect(save).toContain(STACK_HUB)
    expect(save).not.toContain(STACK_BOIDS)
    expect(identityAllowedOrigins('production', DOCKER_STACK)).not.toContain(STACK_BOOP)
  })

  it('bring no Vite dev server with them', () => {
    expect(saveAllowedOrigins('production', DOCKER_STACK)).not.toContain('http://localhost:3008')
    expect(identityAllowedOrigins('production', DOCKER_STACK)).not.toContain(
      'http://localhost:3000',
    )
  })

  it('are absent from the production configuration, which admits no plain-http origin', () => {
    const plain = (origins: readonly string[]) => origins.filter((o) => o.startsWith('http:'))

    expect(plain(identityAllowedOrigins('production'))).toEqual([])
    expect(plain(saveAllowedOrigins('production'))).toEqual([])
  })
})

// Over a real socket: what a browser is told is a transport fact.
describe('a localhost origin over a real socket', () => {
  const servers: FastifyInstance[] = []

  async function listen(tiers: CorsTiers): Promise<string> {
    const server = await buildServer(tiers)
    servers.push(server)
    await server.listen({ port: 0, host: '127.0.0.1' })
    const address = server.server.address()
    if (address === null || typeof address === 'string') throw new Error('no port bound')
    return `http://127.0.0.1:${address.port}`
  }

  let production: string
  let dockerStack: string

  beforeAll(async () => {
    production = await listen({ identity: ORIGINS, save: saveAllowedOrigins('production') })
    dockerStack = await listen({
      identity: identityAllowedOrigins('production', DOCKER_STACK),
      save: saveAllowedOrigins('production', DOCKER_STACK),
    })
  })

  afterAll(async () => {
    await Promise.all(servers.map((server) => server.close()))
  })

  async function allowedOrigin(base: string, path: string, origin: string) {
    const response = await fetch(`${base}${path}`, {
      method: 'OPTIONS',
      headers: { origin, 'access-control-request-method': 'POST' },
    })
    return response.headers.get('access-control-allow-origin')
  }

  it.each([STACK_HUB, 'http://localhost:3000', STACK_BOOP, 'http://localhost:3008'])(
    'is refused by the production configuration on both tiers: %s',
    async (origin) => {
      await expect(allowedOrigin(production, '/api/trpc/identity.me', origin)).resolves.toBeNull()
      await expect(allowedOrigin(production, '/api/trpc/save.put', origin)).resolves.toBeNull()
    },
  )

  it('lets the stack hub through to identity', async () => {
    await expect(allowedOrigin(dockerStack, '/api/trpc/identity.me', STACK_HUB)).resolves.toBe(
      STACK_HUB,
    )
  })

  it('lets the stack boop save, and nothing more', async () => {
    await expect(allowedOrigin(dockerStack, '/api/trpc/save.put', STACK_BOOP)).resolves.toBe(
      STACK_BOOP,
    )
    await expect(
      allowedOrigin(dockerStack, '/api/trpc/identity.deleteAccount', STACK_BOOP),
    ).resolves.toBeNull()
  })

  it('refuses a stack app that is not onboarded', async () => {
    await expect(allowedOrigin(dockerStack, '/api/trpc/save.put', STACK_BOIDS)).resolves.toBeNull()
  })
})
