import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConsoleLogger, createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { buildAppServer, type FastifyInstance } from '@hoe/backend-kit/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { identityAllowedOrigins, registerCors } from './cors.ts'
import { createAppRouter } from './router.ts'

const ALLOWED = 'https://homeofed.com'
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
    registerRoutes: (instance) => registerCors(instance, ORIGINS),
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
