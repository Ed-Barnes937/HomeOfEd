import { FAMILY_SESSION_COOKIE, type SavePutInput } from '@hoe/accounts'
import { mintTestToken, TEST_FAMILY_PUBLIC_KEY } from '@hoe/accounts/testing'
import { ConsoleLogger, InMemoryBlobStore, type AuthProvider } from '@hoe/backend-kit'
import { freshTestDb, type DbClient } from '@hoe/db'
import { beforeEach, describe, expect, it } from 'vitest'

import { familySeam } from './auth/familySeam.ts'
import type { FamilyContext } from './handlers/authz.ts'
import { DeleteSaveHandler } from './handlers/saves/deleteSaveHandler.ts'
import { GetSaveHandler } from './handlers/saves/getSaveHandler.ts'
import { MAX_ACCOUNT_BYTES, MAX_SLOT_BYTES } from './handlers/saves/limits.ts'
import { ListSavesHandler } from './handlers/saves/listSavesHandler.ts'
import { PutSaveHandler } from './handlers/saves/putSaveHandler.ts'
import { migrations } from './migrations.ts'
import { familySchema, type FamilySchema } from './schema.ts'
import { DrizzleFamilyStore, type FamilyStore } from './store.ts'

const APP = 'boop'
const SLOT = 'boop:save'

const now = (): Date => new Date('2026-01-01T00:00:00Z')

/**
 * Every credential in this suite is a real token through the real seam, so the
 * tests cannot drift from what a request actually resolves to.
 */
const seam = familySeam(TEST_FAMILY_PUBLIC_KEY, now)

function requestWith(headers: Record<string, string>): AuthProvider {
  return seam(new Request('https://family.homeofed.com/api/trpc/save.get', { headers }))
}

function childAuth(accountId: string, parentId = 'parent-1'): AuthProvider {
  const token = mintTestToken({ sub: accountId, role: 'child', parentId, name: 'Robin' }, { now })
  return requestWith({ cookie: `${FAMILY_SESSION_COOKIE}=${token}` })
}

function parentTokenAuth(accountId: string): AuthProvider {
  const token = mintTestToken({ sub: accountId, role: 'parent', name: 'Ada' }, { now })
  return requestWith({ cookie: `${FAMILY_SESSION_COOKIE}=${token}` })
}

/** A Better Auth cookie session: the identity router's credential, not this one. */
function parentSessionAuth(parentId: string): AuthProvider {
  return requestWith({ 'x-family-parent': parentId })
}

const signedOut: AuthProvider = { getUser: () => null }

let db: DbClient<FamilySchema>
let store: FamilyStore

function ctxFor(auth: AuthProvider): FamilyContext {
  return {
    store,
    blobs: new InMemoryBlobStore(),
    auth,
    now,
    logger: new ConsoleLogger(),
  }
}

const put = (auth: AuthProvider, input: SavePutInput): Promise<{ version: number }> =>
  new PutSaveHandler().run(input, ctxFor(auth))

const get = (auth: AuthProvider, appId = APP, slotKey = SLOT) =>
  new GetSaveHandler().run({ appId, slotKey }, ctxFor(auth))

const list = (auth: AuthProvider, appId = APP) =>
  new ListSavesHandler().run({ appId }, ctxFor(auth))

const del = (auth: AuthProvider, appId = APP, slotKey = SLOT) =>
  new DeleteSaveHandler().run({ appId, slotKey }, ctxFor(auth))

beforeEach(async () => {
  db = await freshTestDb(familySchema, migrations)
  store = new DrizzleFamilyStore(db)
})

describe('save.get and save.put', () => {
  it('round-trips a blob for the token holder, versioned from one', async () => {
    const auth = childAuth('child-1')

    await expect(put(auth, { appId: APP, slotKey: SLOT, blob: '{"boops":1}' })).resolves.toEqual({
      version: 1,
    })
    await expect(get(auth)).resolves.toEqual({
      blob: '{"boops":1}',
      version: 1,
      updatedAt: expect.any(Number) as number,
    })
  })

  it('returns null for a slot that was never written', async () => {
    await expect(get(childAuth('child-1'))).resolves.toBeNull()
  })

  it('overwrites unconditionally and bumps the version, last write winning', async () => {
    const auth = childAuth('child-1')
    await put(auth, { appId: APP, slotKey: SLOT, blob: 'first' })

    await expect(put(auth, { appId: APP, slotKey: SLOT, blob: 'second' })).resolves.toEqual({
      version: 2,
    })
    await expect(get(auth)).resolves.toMatchObject({ blob: 'second', version: 2 })
  })

  it('never reads the account from input, whatever a caller sends', async () => {
    // The wire schema has no accountId, so this can only arrive from a client
    // that ignores it; the handler must still write under the token's subject.
    const smuggled = { appId: APP, slotKey: SLOT, blob: 'mine', accountId: 'child-2' }
    await put(childAuth('child-1'), smuggled)

    await expect(get(childAuth('child-2'))).resolves.toBeNull()
    await expect(get(childAuth('child-1'))).resolves.toMatchObject({ blob: 'mine' })
  })
})

describe('save.list and save.delete', () => {
  it('lists slot metadata for one app without the blobs', async () => {
    const auth = childAuth('child-1')
    await put(auth, { appId: APP, slotKey: 'boop:save', blob: 'abc' })
    await put(auth, { appId: APP, slotKey: 'boop:other', blob: 'de' })

    await expect(list(auth)).resolves.toEqual([
      { slotKey: 'boop:other', version: 1, sizeBytes: 2, updatedAt: expect.any(Number) as number },
      { slotKey: 'boop:save', version: 1, sizeBytes: 3, updatedAt: expect.any(Number) as number },
    ])
  })

  it('deletes one slot and leaves the rest of the app alone', async () => {
    const auth = childAuth('child-1')
    await put(auth, { appId: APP, slotKey: 'boop:save', blob: 'abc' })
    await put(auth, { appId: APP, slotKey: 'boop:other', blob: 'de' })

    await expect(del(auth, APP, 'boop:save')).resolves.toEqual({})
    await expect(get(auth, APP, 'boop:save')).resolves.toBeNull()
    await expect(get(auth, APP, 'boop:other')).resolves.toMatchObject({ blob: 'de' })
  })

  it('deleting a slot that was never written is not an error', async () => {
    await expect(del(childAuth('child-1'))).resolves.toEqual({})
  })
})

describe('the appId allowlist', () => {
  it('refuses an appId the service has not onboarded, on every procedure', async () => {
    const auth = childAuth('child-1')
    const unknown = 'silt'

    await expect(put(auth, { appId: unknown, slotKey: SLOT, blob: 'x' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    await expect(get(auth, unknown)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(list(auth, unknown)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(del(auth, unknown)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('writes nothing for a refused appId', async () => {
    const auth = childAuth('child-1')
    await expect(put(auth, { appId: 'silt', slotKey: SLOT, blob: 'x' })).rejects.toThrow()

    await expect(
      store.getSave({ appId: 'silt', accountId: 'child-1', slotKey: SLOT }),
    ).resolves.toBeNull()
  })
})

describe('the save quotas', () => {
  const blobOf = (bytes: number): string => 'x'.repeat(bytes)

  it('accepts a slot of exactly the limit and refuses one byte more', async () => {
    const auth = childAuth('child-1')

    await expect(
      put(auth, { appId: APP, slotKey: SLOT, blob: blobOf(MAX_SLOT_BYTES) }),
    ).resolves.toEqual({ version: 1 })
    await expect(
      put(auth, { appId: APP, slotKey: SLOT, blob: blobOf(MAX_SLOT_BYTES + 1) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('measures the blob in bytes, not characters', async () => {
    // Four bytes each, so a quarter of the limit in characters is the limit.
    const auth = childAuth('child-1')
    const blob = '🎹'.repeat(MAX_SLOT_BYTES / 4 + 1)

    await expect(put(auth, { appId: APP, slotKey: SLOT, blob })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })

  it('sums the account quota across every appId, including ones since retired', async () => {
    // Seeded through the store, which has no allowlist: an app can be removed
    // from the allowlist while its rows still count against the account.
    const auth = childAuth('child-1')
    await store.putSave({
      appId: 'silt',
      accountId: 'child-1',
      slotKey: 'silt:scene:1',
      blob: blobOf(MAX_ACCOUNT_BYTES - 10),
    })

    await expect(put(auth, { appId: APP, slotKey: SLOT, blob: blobOf(11) })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    await expect(put(auth, { appId: APP, slotKey: SLOT, blob: blobOf(10) })).resolves.toEqual({
      version: 1,
    })
  })

  it('prices an overwrite by the difference, so a full account can still be rewritten', async () => {
    const auth = childAuth('child-1')
    await store.putSave({
      appId: 'silt',
      accountId: 'child-1',
      slotKey: 'silt:scene:1',
      blob: blobOf(MAX_ACCOUNT_BYTES - MAX_SLOT_BYTES),
    })
    await put(auth, { appId: APP, slotKey: SLOT, blob: blobOf(MAX_SLOT_BYTES) })

    await expect(
      put(auth, { appId: APP, slotKey: SLOT, blob: blobOf(MAX_SLOT_BYTES) }),
    ).resolves.toEqual({ version: 2 })
    await expect(
      put(auth, { appId: APP, slotKey: 'boop:two', blob: blobOf(1) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('counts only the asking account towards its quota', async () => {
    await store.putSave({
      appId: APP,
      accountId: 'child-2',
      slotKey: SLOT,
      blob: 'x'.repeat(MAX_ACCOUNT_BYTES),
    })

    await expect(
      put(childAuth('child-1'), { appId: APP, slotKey: SLOT, blob: 'mine' }),
    ).resolves.toEqual({ version: 1 })
  })
})

describe('save ownership', () => {
  it('gives a child token nothing of another account, on every procedure', async () => {
    await put(childAuth('child-1'), { appId: APP, slotKey: SLOT, blob: 'theirs' })
    const other = childAuth('child-2')

    await expect(get(other)).resolves.toBeNull()
    await expect(list(other)).resolves.toEqual([])
    await expect(del(other)).resolves.toEqual({})
    await expect(get(childAuth('child-1'))).resolves.toMatchObject({ blob: 'theirs' })
  })

  it('gives a parent token its own account only, not its children', async () => {
    await put(childAuth('child-1', 'parent-1'), { appId: APP, slotKey: SLOT, blob: 'the kid' })

    await expect(get(parentTokenAuth('parent-1'))).resolves.toBeNull()
    await expect(list(parentTokenAuth('parent-1'))).resolves.toEqual([])
  })

  // `saves.accountId` is text with no FK, and erasure matches Postgres's
  // canonical lowercase uuid, so a differently cased subject is a different
  // account here and would be missed on erasure.
  it('treats accountIds differing only in case as different accounts', async () => {
    const lower = '11111111-aaaa-bbbb-cccc-ddddeeeeffff'
    const upper = lower.toUpperCase()
    await put(childAuth(lower), { appId: APP, slotKey: SLOT, blob: 'lower' })

    await expect(get(childAuth(upper))).resolves.toBeNull()
    await expect(list(childAuth(upper))).resolves.toEqual([])

    await put(childAuth(upper), { appId: APP, slotKey: SLOT, blob: 'upper' })
    await expect(get(childAuth(lower))).resolves.toMatchObject({ blob: 'lower' })
  })

  it('orphans a row written under a non-canonical form of the owning uuid', async () => {
    await db
      .insert(familySchema.user)
      .values({ id: 'parent-1', name: 'Ada', email: 'ada@example.com' })
    const profile = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'robin',
      displayName: 'Robin',
    })
    await put(childAuth(profile.id), { appId: APP, slotKey: SLOT, blob: 'canonical' })
    await put(childAuth(profile.id.toUpperCase()), { appId: APP, slotKey: SLOT, blob: 'shouted' })

    await store.deleteChildProfile({ id: profile.id, parentId: 'parent-1' })

    // The structural price of the no-FK decision: erasure matches Postgres's
    // canonical uuid, so a row under any other casing outlives the profile.
    await expect(get(childAuth(profile.id))).resolves.toBeNull()
    await expect(get(childAuth(profile.id.toUpperCase()))).resolves.toMatchObject({
      blob: 'shouted',
    })
  })
})

describe('the save authorisation boundary', () => {
  const everyProcedure = (auth: AuthProvider): Promise<unknown>[] => [
    get(auth),
    put(auth, { appId: APP, slotKey: SLOT, blob: 'x' }),
    list(auth),
    del(auth),
  ]

  it('refuses every procedure when no credential was sent', async () => {
    for (const call of everyProcedure(signedOut)) {
      await expect(call).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    }
  })

  // The mirror of ADR 0078's rule that a family token can never reach the
  // identity router: a cookie session can never reach the SaveStore.
  it('refuses every procedure to a parent cookie session', async () => {
    for (const call of everyProcedure(parentSessionAuth('parent-1'))) {
      await expect(call).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    }
  })

  it('refuses a user that carries an account but no role', async () => {
    const roleless: AuthProvider = {
      getUser: () => ({ id: 'child-1', saveAccount: { accountId: 'child-1' } }),
    }

    for (const call of everyProcedure(roleless)) {
      await expect(call).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    }
  })

  it('serves a parent cookie session and a child token on one request from the token', async () => {
    const token = mintTestToken(
      { sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' },
      { now },
    )
    const both = requestWith({
      'x-family-parent': 'parent-7',
      cookie: `${FAMILY_SESSION_COOKIE}=${token}`,
    })

    await put(both, { appId: APP, slotKey: SLOT, blob: 'the kid' })

    await expect(get(childAuth('child-1'))).resolves.toMatchObject({ blob: 'the kid' })
    await expect(get(parentTokenAuth('parent-7'))).resolves.toBeNull()
  })
})
