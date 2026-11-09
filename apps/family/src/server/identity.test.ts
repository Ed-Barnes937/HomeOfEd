import { mintFamilyToken, verifyFamilyToken } from '@hoe/accounts/server'
import { TEST_FAMILY_PRIVATE_KEY, TEST_FAMILY_PUBLIC_KEY } from '@hoe/accounts/testing'
import { ConsoleLogger, InMemoryBlobStore, type AuthProvider } from '@hoe/backend-kit'
import { freshTestDb, type DbClient } from '@hoe/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { parentSessionProvider } from './auth/parentSession.ts'
import type { FamilyTokenMinter } from './auth/tokenPort.ts'
import type { FamilyContext } from './handlers/authz.ts'
import { AddChildHandler } from './handlers/identity/addChildHandler.ts'
import { DeleteAccountHandler } from './handlers/identity/deleteAccountHandler.ts'
import { DeleteChildHandler } from './handlers/identity/deleteChildHandler.ts'
import { ListChildrenHandler } from './handlers/identity/listChildrenHandler.ts'
import { MeHandler } from './handlers/identity/meHandler.ts'
import { MintSessionTokenHandler } from './handlers/identity/mintSessionTokenHandler.ts'
import { RenameChildHandler } from './handlers/identity/renameChildHandler.ts'
import { migrations } from './migrations.ts'
import { familySchema, type FamilySchema } from './schema.ts'
import { DrizzleFamilyStore, type FamilyStore } from './store.ts'

const signedOut: AuthProvider = { getUser: () => null }

/**
 * A verified family token's user, which the save router will put on this same
 * seam (ticket 05). It must never authorise an identity procedure.
 */
const familyTokenParent: AuthProvider = {
  getUser: () => ({ id: 'parent-1', role: 'parent', name: 'Ada' }),
}

const mintWithTestKey: FamilyTokenMinter = (input) =>
  mintFamilyToken(input, TEST_FAMILY_PRIVATE_KEY)

let db: DbClient<FamilySchema>
let store: FamilyStore

function ctxFor(auth: AuthProvider): FamilyContext {
  return {
    store,
    blobs: new InMemoryBlobStore(),
    auth,
    now: () => new Date('2026-01-01T00:00:00Z'),
    logger: new ConsoleLogger(),
  }
}

async function insertParent(id: string, name: string): Promise<void> {
  await db.insert(familySchema.user).values({ id, name, email: `${id}@example.com` })
}

beforeEach(async () => {
  db = await freshTestDb(familySchema, migrations)
  store = new DrizzleFamilyStore(db)
  await insertParent('parent-1', 'Ada')
  await insertParent('parent-2', 'Grace')
})

describe('identity.me', () => {
  it('reports the signed-in parent', async () => {
    await expect(
      new MeHandler().run(undefined, ctxFor(parentSessionProvider('parent-1'))),
    ).resolves.toEqual({ parent: { id: 'parent-1', name: 'Ada', email: 'parent-1@example.com' } })
  })

  it('reports nobody when signed out', async () => {
    await expect(new MeHandler().run(undefined, ctxFor(signedOut))).resolves.toEqual({
      parent: null,
    })
  })

  it('reports nobody for a family-token user, which is not a cookie session', async () => {
    await expect(new MeHandler().run(undefined, ctxFor(familyTokenParent))).resolves.toEqual({
      parent: null,
    })
  })

  it('reports nobody when the session outlives the user row', async () => {
    await store.deleteAccount('parent-1')

    await expect(
      new MeHandler().run(undefined, ctxFor(parentSessionProvider('parent-1'))),
    ).resolves.toEqual({ parent: null })
  })
})

describe('identity.children', () => {
  it('adds a profile under the signed-in parent and lists it back', async () => {
    const added = await new AddChildHandler().run(
      { username: 'ada-jr', displayName: 'Ada Jr' },
      ctxFor(parentSessionProvider('parent-1')),
    )

    expect(added).toMatchObject({ username: 'ada-jr', displayName: 'Ada Jr' })
    expect(typeof added.createdAt).toBe('number')
    await expect(
      new ListChildrenHandler().run(undefined, ctxFor(parentSessionProvider('parent-1'))),
    ).resolves.toEqual([added])
  })

  it('lists only the profiles of the signed-in parent', async () => {
    await new AddChildHandler().run(
      { username: 'ada-jr', displayName: 'Ada Jr' },
      ctxFor(parentSessionProvider('parent-1')),
    )

    await expect(
      new ListChildrenHandler().run(undefined, ctxFor(parentSessionProvider('parent-2'))),
    ).resolves.toEqual([])
  })

  it.each([
    ['signed out', signedOut],
    ['a family token', familyTokenParent],
  ])('refuses to list for %s', async (_label, auth) => {
    await expect(new ListChildrenHandler().run(undefined, ctxFor(auth))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('refuses a username another household already took, as a conflict', async () => {
    await store.addChildProfile({ parentId: 'parent-2', username: 'ada-jr', displayName: 'Ada Jr' })

    await expect(
      new AddChildHandler().run(
        { username: 'ada-jr', displayName: 'Ada Jr' },
        ctxFor(parentSessionProvider('parent-1')),
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('refuses to add a profile when signed out', async () => {
    await expect(
      new AddChildHandler().run({ username: 'ada-jr', displayName: 'Ada Jr' }, ctxFor(signedOut)),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(await db.select().from(familySchema.childProfiles)).toEqual([])
  })

  it('renames a profile of the signed-in parent', async () => {
    const added = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada-jr',
      displayName: 'Ada Jr',
    })

    await expect(
      new RenameChildHandler().run(
        { id: added.id, displayName: 'Ada L' },
        ctxFor(parentSessionProvider('parent-1')),
      ),
    ).resolves.toMatchObject({ id: added.id, displayName: 'Ada L' })
  })

  it('refuses to rename a profile of another household, and changes nothing', async () => {
    const added = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada-jr',
      displayName: 'Ada Jr',
    })

    await expect(
      new RenameChildHandler().run(
        { id: added.id, displayName: 'stolen' },
        ctxFor(parentSessionProvider('parent-2')),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(store.getChildProfile(added.id)).resolves.toMatchObject({
      displayName: 'Ada Jr',
    })
  })

  it('refuses a profile id that does not exist', async () => {
    await expect(
      new RenameChildHandler().run(
        { id: '00000000-0000-0000-0000-000000000000', displayName: 'ghost' },
        ctxFor(parentSessionProvider('parent-1')),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('deletes a profile of the signed-in parent and leaves no orphan saves', async () => {
    const ada = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada-jr',
      displayName: 'Ada Jr',
    })
    await store.putSave({
      appId: 'boop',
      accountId: ada.id,
      slotKey: 'boop:save',
      blob: 'beats',
    })
    await store.putSave({
      appId: 'boop',
      accountId: 'parent-1',
      slotKey: 'boop:save',
      blob: 'beats',
    })

    await expect(
      new DeleteChildHandler().run({ id: ada.id }, ctxFor(parentSessionProvider('parent-1'))),
    ).resolves.toEqual({ ok: true })

    await expect(store.getChildProfile(ada.id)).resolves.toBeNull()
    expect((await db.select().from(familySchema.saves)).map((row) => row.accountId)).toEqual([
      'parent-1',
    ])
  })

  it('refuses to delete a profile of another household, saves and all', async () => {
    const ada = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada-jr',
      displayName: 'Ada Jr',
    })
    await store.putSave({
      appId: 'boop',
      accountId: ada.id,
      slotKey: 'boop:save',
      blob: 'beats',
    })

    await expect(
      new DeleteChildHandler().run({ id: ada.id }, ctxFor(parentSessionProvider('parent-2'))),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    await expect(store.getChildProfile(ada.id)).resolves.not.toBeNull()
    expect(await db.select().from(familySchema.saves)).toHaveLength(1)
  })
})

describe('identity.mintSessionToken', () => {
  function mint(auth: AuthProvider, input: { childId?: string } = {}) {
    return new MintSessionTokenHandler(mintWithTestKey).run(input, ctxFor(auth))
  }

  it('mints a parent token for the signed-in parent themselves', async () => {
    const { token } = await mint(parentSessionProvider('parent-1'))

    expect(verifyFamilyToken(token, TEST_FAMILY_PUBLIC_KEY)).toMatchObject({
      sub: 'parent-1',
      role: 'parent',
      name: 'Ada',
    })
  })

  it('mints a child token carrying the parent id and display name', async () => {
    const ada = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada-jr',
      displayName: 'Ada Jr',
    })

    const { token } = await mint(parentSessionProvider('parent-1'), { childId: ada.id })

    expect(verifyFamilyToken(token, TEST_FAMILY_PUBLIC_KEY)).toMatchObject({
      sub: ada.id,
      role: 'child',
      parentId: 'parent-1',
      name: 'Ada Jr',
    })
  })

  it('never mints for a child profile of another family', async () => {
    const ada = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada-jr',
      displayName: 'Ada Jr',
    })
    const minter = vi.fn(mintWithTestKey)

    await expect(
      new MintSessionTokenHandler(minter).run(
        { childId: ada.id },
        ctxFor(parentSessionProvider('parent-2')),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(minter).not.toHaveBeenCalled()
  })

  it.each([
    ['signed out', signedOut],
    ['a family token', familyTokenParent],
  ])('refuses to mint for %s', async (_label, auth) => {
    const minter = vi.fn(mintWithTestKey)

    await expect(new MintSessionTokenHandler(minter).run({}, ctxFor(auth))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    expect(minter).not.toHaveBeenCalled()
  })
})

describe('identity.deleteAccount', () => {
  it('erases the household and every save row it owned', async () => {
    const ada = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada-jr',
      displayName: 'Ada Jr',
    })
    for (const accountId of ['parent-1', ada.id]) {
      await store.putSave({ appId: 'boop', accountId, slotKey: 'boop:save', blob: 'beats' })
    }
    await store.putSave({
      appId: 'boop',
      accountId: 'parent-2',
      slotKey: 'boop:save',
      blob: 'beats',
    })

    await expect(
      new DeleteAccountHandler().run(undefined, ctxFor(parentSessionProvider('parent-1'))),
    ).resolves.toEqual({ ok: true })

    expect((await db.select().from(familySchema.user)).map((row) => row.id)).toEqual(['parent-2'])
    expect((await db.select().from(familySchema.saves)).map((row) => row.accountId)).toEqual([
      'parent-2',
    ])
  })

  it.each([
    ['signed out', signedOut],
    ['a family token', familyTokenParent],
  ])('refuses to erase anything for %s', async (_label, auth) => {
    await expect(new DeleteAccountHandler().run(undefined, ctxFor(auth))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    expect(await db.select().from(familySchema.user)).toHaveLength(2)
  })
})
