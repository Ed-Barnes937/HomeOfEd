import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConsoleLogger, createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { buildAppServer, type FastifyInstance } from '@hoe/backend-kit/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { allowedOrigins, registerCors } from './cors.ts'
import { createAppRouter } from './router.ts'

const ALLOWED = 'https://homeofed.com'
const ORIGINS = [ALLOWED]

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

  it('grants an unlisted origin nothing, and never reflects it back', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/trpc/identity.me',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
    expect(response.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it('marks the preflight as varying by origin, so no cache crosses origins', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/trpc/identity.me',
      headers: { origin: ALLOWED, 'access-control-request-method': 'POST' },
    })

    expect(response.headers['vary']).toContain('Origin')
  })
})

describe('allowedOrigins', () => {
  it('is never a wildcard', () => {
    expect(allowedOrigins('production')).not.toContain('*')
    expect(allowedOrigins(undefined)).not.toContain('*')
  })

  it('adds the localhost dev servers only outside production', () => {
    expect(allowedOrigins('production')).toEqual([
      'https://homeofed.com',
      'https://boop.homeofed.com',
    ])
    expect(allowedOrigins(undefined)).toContain('http://localhost:3000')
  })
})
