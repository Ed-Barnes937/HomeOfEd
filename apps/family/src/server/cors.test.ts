import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConsoleLogger, createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { buildAppServer, type FastifyInstance } from '@hoe/backend-kit/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { identityAllowedOrigins, registerCors, saveAllowedOrigins } from './cors.ts'
import { onboardedAppOrigins } from './onboardedApps.ts'
import { createAppRouter } from './router.ts'

const ALLOWED = 'https://homeofed.com'
const APP_ORIGIN = 'https://boop.homeofed.com'
const ORIGINS = identityAllowedOrigins('production')

let app: FastifyInstance

// The real pipeline: backend-kit registers the tRPC plugin BEFORE calling
// registerRoutes, so this is also the proof that a hook added there still
// reaches /api/trpc.
beforeEach(async () => {
  app = await buildAppServer({
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
    registerRoutes: (instance) =>
      registerCors(instance, { identity: ORIGINS, save: saveAllowedOrigins('production') }),
  })
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
