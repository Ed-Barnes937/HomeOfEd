import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConsoleLogger, createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { buildAppServer, type FastifyInstance } from '@hoe/backend-kit/server'
import { freshTestDb } from '@hoe/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { migrations } from '../migrations.ts'
import { createAppRouter } from '../router.ts'
import { familySchema } from '../schema.ts'
import { DrizzleFamilyStore } from '../store.ts'

import { parentSessionSeam, registerParentSessionBridge } from './parentSessionBridge.ts'
import type { SessionResolver } from './parentSession.ts'

const GOOD_COOKIE = 'family_session=good'

/** A fake Better Auth: one cookie value resolves, everything else does not. */
const fakeAuth: SessionResolver = {
  api: {
    getSession: ({ headers }) =>
      Promise.resolve(headers.get('cookie') === GOOD_COOKIE ? { user: { id: 'parent-1' } } : null),
  },
}

let app: FastifyInstance

beforeEach(async () => {
  const db = await freshTestDb(familySchema, migrations)
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
      auth: parentSessionSeam,
    }),
    staticDir: await mkdtemp(join(tmpdir(), 'family-bridge-')),
    logger: new ConsoleLogger(),
    healthCheck: () => Promise.resolve({ ok: true }),
    registerRoutes: (instance) => registerParentSessionBridge(instance, fakeAuth),
  })
})

afterEach(async () => {
  await app.close()
})

async function me(headers: Record<string, string>): Promise<{ parent: unknown }> {
  const response = await app.inject({ method: 'GET', url: '/api/trpc/identity.me', headers })
  expect(response.statusCode).toBe(200)
  return (JSON.parse(response.body) as { result: { data: { parent: unknown } } }).result.data
}

describe('the Better Auth session bridge', () => {
  it('puts the parent from a verified cookie session into the tRPC context', async () => {
    await expect(me({ cookie: GOOD_COOKIE })).resolves.toEqual({
      parent: { id: 'parent-1', name: 'Ada', email: 'ada@example.com' },
    })
  })

  it('leaves the context anonymous without a session cookie', async () => {
    await expect(me({})).resolves.toEqual({ parent: null })
  })

  it('ignores a client-supplied parent header, with or without a cookie', async () => {
    await expect(me({ 'x-family-parent': 'parent-1' })).resolves.toEqual({ parent: null })
    await expect(
      me({ cookie: 'family_session=forged', 'x-family-parent': 'parent-1' }),
    ).resolves.toEqual({
      parent: null,
    })
  })

  it('ignores it however the client cases it', async () => {
    await expect(me({ 'X-Family-Parent': 'parent-1' })).resolves.toEqual({ parent: null })
    await expect(me({ 'X-FAMILY-PARENT': 'parent-1' })).resolves.toEqual({ parent: null })
  })
})
