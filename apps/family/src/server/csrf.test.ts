// Over a real socket, not `app.inject`: inject builds a synthetic Request whose
// body cannot be read the way the multipart path reads it, so it reports a 500
// where the live server returns 200 and erases the household. The gap is only
// visible through the real pipeline.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { FAMILY_SESSION_COOKIE } from '@hoe/accounts'
import { mintTestToken, TEST_FAMILY_PUBLIC_KEY } from '@hoe/accounts/testing'
import { ConsoleLogger, createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { buildAppServer, type FastifyInstance } from '@hoe/backend-kit/server'
import { freshTestDb, type DbClient } from '@hoe/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { familySeam } from './auth/familySeam.ts'
import type { SessionResolver } from './auth/parentSession.ts'
import { registerParentSessionBridge } from './auth/parentSessionBridge.ts'
import { identityAllowedOrigins, registerCors, saveAllowedOrigins } from './cors.ts'
import { MAX_BATCH_SIZE, registerTrpcCsrfGuard } from './csrf.ts'
import { migrations } from './migrations.ts'
import { createAppRouter } from './router.ts'
import { familySchema, type FamilySchema } from './schema.ts'
import { DrizzleFamilyStore } from './store.ts'

const SESSION_COOKIE = 'family_session=good'

const fakeAuth: SessionResolver = {
  api: {
    getSession: ({ headers }) =>
      Promise.resolve(
        headers.get('cookie') === SESSION_COOKIE ? { user: { id: 'parent-1' } } : null,
      ),
  },
}

const childToken = mintTestToken({
  sub: 'child-1',
  role: 'child',
  parentId: 'parent-1',
  name: 'Robin',
})

/** Exactly the content types a browser sends without asking permission first. */
const SAFELISTED_CONTENT_TYPES = [
  'multipart/form-data; boundary=x',
  'application/x-www-form-urlencoded',
  'text/plain;charset=UTF-8',
]

let app: FastifyInstance
let db: DbClient<FamilySchema>
let base: string

beforeEach(async () => {
  db = await freshTestDb(familySchema, migrations)
  await db
    .insert(familySchema.user)
    .values({ id: 'parent-1', name: 'Ada', email: 'ada@example.com' })

  app = await buildAppServer({
    router: createAppRouter({
      mintToken: () => {
        throw new Error('not used')
      },
    }),
    createContext: createContext({
      store: new DrizzleFamilyStore(db),
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger(),
      auth: familySeam(TEST_FAMILY_PUBLIC_KEY),
    }),
    staticDir: await mkdtemp(join(tmpdir(), 'family-csrf-')),
    logger: new ConsoleLogger(),
    healthCheck: () => Promise.resolve({ ok: true }),
    maxBatchSize: MAX_BATCH_SIZE,
    registerRoutes: (instance) => {
      registerCors(instance, {
        identity: identityAllowedOrigins('production'),
        save: saveAllowedOrigins('production'),
      })
      registerTrpcCsrfGuard(instance)
      registerParentSessionBridge(instance, fakeAuth)
    },
  })

  await app.listen({ port: 0, host: '127.0.0.1' })
  const address = app.server.address()
  if (address === null || typeof address === 'string') throw new Error('no port bound')
  base = `http://127.0.0.1:${address.port}`
})

afterEach(async () => {
  await app.close()
})

const households = async (): Promise<number> => (await db.select().from(familySchema.user)).length

/** The attack a page on any estate subdomain can mount with no preflight. */
const forge = (path: string, contentType: string | null, cookie: string): Promise<Response> =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      origin: 'https://boop.homeofed.com',
      cookie,
      ...(contentType === null ? {} : { 'content-type': contentType }),
    },
    body: '{}',
  })

describe('a cross-origin request a browser sends without a preflight', () => {
  it.each(SAFELISTED_CONTENT_TYPES)(
    'cannot erase a household with content-type %s',
    async (contentType) => {
      const response = await forge('/api/trpc/identity.deleteAccount', contentType, SESSION_COOKIE)

      await expect(households()).resolves.toBe(1)
      expect(response.status).toBe(415)
    },
  )

  it('cannot erase a household with no content-type at all', async () => {
    const response = await forge('/api/trpc/identity.deleteAccount', null, SESSION_COOKIE)

    await expect(households()).resolves.toBe(1)
    expect(response.status).toBe(415)
  })

  it('cannot reach a save mutation either', async () => {
    const response = await forge(
      '/api/trpc/save.put',
      'multipart/form-data; boundary=x',
      `${FAMILY_SESSION_COOKIE}=${childToken}`,
    )

    expect(response.status).toBe(415)
  })

  it('cannot smuggle one in a batch', async () => {
    const response = await forge(
      '/api/trpc/save.put,identity.deleteAccount?batch=1',
      'multipart/form-data; boundary=x',
      SESSION_COOKIE,
    )

    await expect(households()).resolves.toBe(1)
    expect(response.status).toBe(415)
  })

  it('says what is required without naming the household', async () => {
    const response = await forge('/api/trpc/identity.deleteAccount', 'text/plain', SESSION_COOKIE)
    const body = await response.text()

    expect(body).toContain('application/json')
    expect(body).not.toContain('parent-1')
  })
})

describe('the most destructive procedure also wants a body', () => {
  const erase = (body: string): Promise<Response> =>
    fetch(`${base}/api/trpc/identity.deleteAccount`, {
      method: 'POST',
      headers: { cookie: SESSION_COOKIE, 'content-type': 'application/json' },
      body,
    })

  it.each([
    ['nothing', ''],
    ['an empty object', '{}'],
    ['a refusal', JSON.stringify({ confirm: false })],
  ])('refuses to erase a household given %s', async (_label, body) => {
    const response = await erase(body)

    await expect(households()).resolves.toBe(1)
    expect(response.status).toBe(400)
  })

  it('erases it when the caller says so plainly', async () => {
    const response = await erase(JSON.stringify({ confirm: true }))

    expect(response.status).toBe(200)
    await expect(households()).resolves.toBe(0)
  })
})

describe('one request may not fan out without limit', () => {
  // `greeting` is the shortest procedure here, so it is the most that fits
  // within Fastify's 100-character route-parameter default - which is what
  // bounds a batch today, and is not a limit this app ever stated.
  const batchOf = (count: number, separator = ','): Promise<Response> =>
    fetch(
      `${base}/api/trpc/${Array.from({ length: count }, () => 'greeting').join(separator)}?batch=1`,
    )

  it('serves a batch within the cap', async () => {
    expect((await batchOf(MAX_BATCH_SIZE)).status).toBe(200)
  })

  it('refuses one past it', async () => {
    expect((await batchOf(MAX_BATCH_SIZE + 1)).status).toBe(400)
  })

  // tRPC decodes the path before splitting it, so the encoded form is a real
  // batch and the cap has to count it as one.
  it('refuses one past it in its percent-encoded form', async () => {
    expect((await batchOf(MAX_BATCH_SIZE + 1, '%2C')).status).toBe(400)
  })
})

describe('the guard leaves every legitimate caller alone', () => {
  const addChild = (contentType: string): Promise<Response> =>
    fetch(`${base}/api/trpc/identity.children.add`, {
      method: 'POST',
      headers: { cookie: SESSION_COOKIE, 'content-type': contentType },
      body: JSON.stringify({ username: 'robin', displayName: 'Robin' }),
    })

  it('accepts the content type the tRPC client sends', async () => {
    expect((await addChild('application/json')).status).toBe(200)
  })

  it('accepts a charset parameter, which is not safelisted either', async () => {
    expect((await addChild('application/json; charset=utf-8')).status).toBe(200)
  })

  it('leaves queries alone, which mutate nothing', async () => {
    const response = await fetch(`${base}/api/trpc/identity.me`, {
      headers: { cookie: SESSION_COOKIE },
    })

    expect(response.status).toBe(200)
  })

  it('leaves the CORS preflight alone', async () => {
    const response = await fetch(`${base}/api/trpc/identity.me`, {
      method: 'OPTIONS',
      headers: { origin: 'https://homeofed.com', 'access-control-request-method': 'POST' },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://homeofed.com')
  })

  it('leaves everything outside /api/trpc alone', async () => {
    const response = await fetch(`${base}/health`, { method: 'POST' })

    expect(response.status).not.toBe(415)
  })
})
