// Over a real socket: the binding is a field on the wire, so the wire is what is tested,
// in both rollout orders (a new client against an old family, and the reverse).
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  createFamilySaveClient,
  FAMILY_SESSION_COOKIE,
  SaveAccountMismatchError,
} from '@hoe/accounts'
import { mintTestToken, TEST_FAMILY_PUBLIC_KEY } from '@hoe/accounts/testing'
import { ConsoleLogger, createContext, createTRPC, InMemoryBlobStore } from '@hoe/backend-kit'
import { buildAppServer, type FastifyInstance } from '@hoe/backend-kit/server'
import { freshTestDb } from '@hoe/db'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { familySeam } from './auth/familySeam.ts'
import { migrations } from './migrations.ts'
import { createAppRouter } from './router.ts'
import { familySchema } from './schema.ts'
import { DrizzleFamilyStore } from './store.ts'

const SLOT = { appId: 'boop', slotKey: 'boop:save' }

const cookieFor = (sub: string): string =>
  `${FAMILY_SESSION_COOKIE}=${mintTestToken({ sub, role: 'child', parentId: 'parent-1', name: sub })}`

type AnyRouter = Parameters<typeof buildAppServer>[0]['router']

let app: FastifyInstance | null = null

afterEach(async () => {
  await app?.close()
  app = null
})

async function serve(router: AnyRouter, store: unknown): Promise<string> {
  app = await buildAppServer({
    router,
    createContext: createContext({
      store,
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger(),
      auth: familySeam(TEST_FAMILY_PUBLIC_KEY),
    }),
    staticDir: await mkdtemp(join(tmpdir(), 'family-binding-')),
    logger: new ConsoleLogger(),
    healthCheck: () => Promise.resolve({ ok: true }),
  })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const address = app.server.address()
  if (address === null || typeof address === 'string') throw new Error('no port bound')
  return `http://127.0.0.1:${address.port}`
}

async function serveFamily(): Promise<string> {
  const store = new DrizzleFamilyStore(await freshTestDb(familySchema, migrations))
  const router = createAppRouter({
    mintToken: () => {
      throw new Error('not used')
    },
  })
  return serve(router, store)
}

/** A browser whose family cookie is `cookie()` at the moment of each request. */
function browser(cookie: () => string) {
  return (url: string, init?: RequestInit) =>
    fetch(url, { ...init, headers: { ...(init?.headers as object), cookie: cookie() } })
}

describe('a save client bound to one profile, against this family', () => {
  it('cannot write into the profile another tab signed in as', async () => {
    const base = await serveFamily()
    let cookie = cookieFor('child-bo')
    const bo = createFamilySaveClient({
      baseUrl: base,
      accountId: 'child-bo',
      currentAccount: () => 'child-bo',
      fetch: browser(() => cookie),
    })
    await bo.put({ ...SLOT, blob: 'bo' })

    // Cy's page, still believing Cy is signed in, sends Bo's cookie.
    const cy = createFamilySaveClient({
      baseUrl: base,
      accountId: 'child-cy',
      currentAccount: () => 'child-cy',
      fetch: browser(() => cookie),
    })
    await expect(cy.put({ ...SLOT, blob: 'cy' })).rejects.toBeInstanceOf(SaveAccountMismatchError)
    await expect(cy.get(SLOT)).rejects.toBeInstanceOf(SaveAccountMismatchError)

    cookie = cookieFor('child-bo')
    await expect(bo.get(SLOT)).resolves.toMatchObject({ blob: 'bo', version: 1 })
  })

  it('still serves a client that sends no expected account', async () => {
    const base = await serveFamily()
    const response = await fetch(`${base}/api/trpc/save.put`, {
      method: 'POST',
      headers: { cookie: cookieFor('child-bo'), 'content-type': 'application/json' },
      body: JSON.stringify({ ...SLOT, blob: 'old client' }),
    })

    expect(response.status).toBe(200)
  })
})

describe('a save client bound to one profile, against a family from before the binding', () => {
  // The save inputs as they were: a zod object, which strips keys it does not know.
  const legacyGetInput = z.object({
    appId: z.string().min(1),
    slotKey: z.string().min(1).max(128),
  })
  const legacyPutInput = legacyGetInput.extend({ blob: z.string() })

  it('keeps working, because the old service drops the unknown field', async () => {
    const slots = new Map<string, string>()
    const t = createTRPC<unknown>()
    const legacy = t.router({
      save: t.router({
        get: t.procedure.input(legacyGetInput).query(({ input }) => {
          const blob = slots.get(input.slotKey)
          return blob === undefined ? null : { blob, version: 1, updatedAt: 0 }
        }),
        put: t.procedure.input(legacyPutInput).mutation(({ input }) => {
          slots.set(input.slotKey, input.blob)
          return { version: 1 }
        }),
      }),
    })
    const base = await serve(legacy, undefined)
    const client = createFamilySaveClient({
      baseUrl: base,
      accountId: 'child-bo',
      currentAccount: () => 'child-bo',
      fetch: browser(() => cookieFor('child-bo')),
    })

    await expect(client.put({ ...SLOT, blob: 'new client' })).resolves.toEqual({ version: 1 })
    await expect(client.get(SLOT)).resolves.toMatchObject({ blob: 'new client' })
  })
})
