import { freshTestDb, type DbClient } from '@hoe/db'
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { migrations } from './migrations.ts'
import { familySchema, type FamilySchema } from './schema.ts'
import { DrizzleFamilyStore, type ChildProfileRow } from './store.ts'

async function freshStore(): Promise<{ db: DbClient<FamilySchema>; store: DrizzleFamilyStore }> {
  const db = await freshTestDb(familySchema, migrations)
  return { db, store: new DrizzleFamilyStore(db) }
}

/** Better Auth owns `user` rows in production; tests insert them directly. */
async function insertParent(db: DbClient<FamilySchema>, id: string): Promise<string> {
  await db
    .insert(familySchema.user)
    .values({ id, name: `parent ${id}`, email: `${id}@example.com` })
  return id
}

describe('DrizzleFamilyStore health', () => {
  it('round-trips the database for the deep health check', async () => {
    const { store } = await freshStore()
    await expect(store.ping()).resolves.toEqual({ ok: true })
  })
})

describe('DrizzleFamilyStore child profiles', () => {
  let db: DbClient<FamilySchema>
  let store: DrizzleFamilyStore

  beforeEach(async () => {
    ;({ db, store } = await freshStore())
    await insertParent(db, 'parent-1')
  })

  it('adds a profile under its parent and lists it back', async () => {
    const added = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada',
      displayName: 'Ada',
    })

    expect(added).toMatchObject({ parentId: 'parent-1', username: 'ada', displayName: 'Ada' })
    await expect(store.listChildProfiles('parent-1')).resolves.toEqual([added])
  })

  it('lists only the profiles of the asking parent', async () => {
    await insertParent(db, 'parent-2')
    await store.addChildProfile({ parentId: 'parent-1', username: 'ada', displayName: 'Ada' })
    await store.addChildProfile({ parentId: 'parent-2', username: 'grace', displayName: 'Grace' })

    const profiles = await store.listChildProfiles('parent-2')
    expect(profiles.map((profile) => profile.username)).toEqual(['grace'])
  })

  it('rejects a duplicate username as a conflict, not a driver error', async () => {
    await insertParent(db, 'parent-2')
    await store.addChildProfile({ parentId: 'parent-1', username: 'ada', displayName: 'Ada' })

    // Typed, because hub's add-a-child form needs something to show.
    await expect(
      store.addChildProfile({ parentId: 'parent-2', username: 'ada', displayName: 'Ada B' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(
      store.addChildProfile({ parentId: 'parent-1', username: 'ada', displayName: 'Ada B' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('still raises anything that is not a unique violation', async () => {
    // A foreign-key violation must not be read as a username already taken.
    await expect(
      store.addChildProfile({ parentId: 'nobody', username: 'ada', displayName: 'Ada' }),
    ).rejects.not.toMatchObject({ code: 'CONFLICT' })
  })

  it('cascades profiles when the parent user row is deleted', async () => {
    await store.addChildProfile({ parentId: 'parent-1', username: 'ada', displayName: 'Ada' })

    await db.delete(familySchema.user).where(eq(familySchema.user.id, 'parent-1'))

    const remaining = await db.select().from(familySchema.childProfiles)
    expect(remaining).toEqual([])
  })

  it('reads one profile back by id', async () => {
    const added = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada',
      displayName: 'Ada',
    })

    await expect(store.getChildProfile(added.id)).resolves.toEqual(added)
  })

  it('returns null for a profile id that does not exist', async () => {
    await expect(store.getChildProfile('00000000-0000-0000-0000-000000000000')).resolves.toBeNull()
  })

  it('renames a profile of the asking parent', async () => {
    const added = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada',
      displayName: 'Ada',
    })

    const renamed = await store.renameChildProfile({
      id: added.id,
      parentId: 'parent-1',
      displayName: 'Ada L',
    })

    expect(renamed).toMatchObject({ id: added.id, displayName: 'Ada L', username: 'ada' })
    await expect(store.getChildProfile(added.id)).resolves.toMatchObject({ displayName: 'Ada L' })
  })

  it('renames nothing when the profile belongs to another household', async () => {
    await insertParent(db, 'parent-2')
    const added = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada',
      displayName: 'Ada',
    })

    await expect(
      store.renameChildProfile({ id: added.id, parentId: 'parent-2', displayName: 'stolen' }),
    ).resolves.toBeNull()
    await expect(store.getChildProfile(added.id)).resolves.toMatchObject({ displayName: 'Ada' })
  })
})

describe('DrizzleFamilyStore child-profile erasure', () => {
  let db: DbClient<FamilySchema>
  let store: DrizzleFamilyStore
  let ada: ChildProfileRow
  let bob: ChildProfileRow

  beforeEach(async () => {
    ;({ db, store } = await freshStore())
    await insertParent(db, 'parent-1')
    ada = await store.addChildProfile({ parentId: 'parent-1', username: 'ada', displayName: 'Ada' })
    bob = await store.addChildProfile({ parentId: 'parent-1', username: 'bob', displayName: 'Bob' })
    for (const accountId of ['parent-1', ada.id, bob.id]) {
      await store.putSave({ appId: 'boop', accountId, slotKey: 'boop:save', blob: 'beats' })
    }
  })

  it('leaves no orphan saves behind the deleted profile', async () => {
    await store.deleteChildProfile({ id: ada.id, parentId: 'parent-1' })

    const remaining = await db.select().from(familySchema.saves)
    expect(remaining.map((row) => row.accountId).sort()).toEqual(['parent-1', bob.id].sort())
    expect((await store.listChildProfiles('parent-1')).map((row) => row.id)).toEqual([bob.id])
  })

  it('rolls the profile delete back when the saves delete fails', async () => {
    // Stands in for any failure after the profile row is gone: both halves must
    // roll back together, or the saves are orphaned beyond reach.
    await db.execute(sql`
      create function block_saves_delete() returns trigger
      as $$ begin raise exception 'blocked'; end; $$ language plpgsql
    `)
    await db.execute(sql`
      create trigger block_saves_delete before delete on saves
      for each row execute function block_saves_delete()
    `)

    await expect(store.deleteChildProfile({ id: ada.id, parentId: 'parent-1' })).rejects.toThrow()

    await expect(store.getChildProfile(ada.id)).resolves.not.toBeNull()
    expect(await db.select().from(familySchema.saves)).toHaveLength(3)
  })

  it('deletes nothing when the profile belongs to another household', async () => {
    await insertParent(db, 'parent-2')

    await store.deleteChildProfile({ id: ada.id, parentId: 'parent-2' })

    await expect(store.getChildProfile(ada.id)).resolves.not.toBeNull()
    expect(await db.select().from(familySchema.saves)).toHaveLength(3)
  })
})

describe('DrizzleFamilyStore saves', () => {
  let store: DrizzleFamilyStore

  beforeEach(async () => {
    ;({ store } = await freshStore())
  })

  it('returns null for a slot that was never written', async () => {
    await expect(
      store.getSave({ appId: 'boop', accountId: 'parent-1', slotKey: 'boop:save' }),
    ).resolves.toBeNull()
  })

  it('bumps the version on every put', async () => {
    const key = { appId: 'boop', accountId: 'parent-1', slotKey: 'boop:save' }

    await expect(store.putSave({ ...key, blob: 'one' })).resolves.toEqual({ version: 1 })
    await expect(store.putSave({ ...key, blob: 'two' })).resolves.toEqual({ version: 2 })
    await expect(store.getSave(key)).resolves.toMatchObject({ blob: 'two', version: 2 })
  })

  it('never moves updatedAt backwards when it bumps the version', async () => {
    const key = { appId: 'boop', accountId: 'parent-1', slotKey: 'boop:save' }
    await store.putSave({ ...key, blob: 'one' })
    const inserted = await store.getSave(key)
    await store.putSave({ ...key, blob: 'two' })
    const updated = await store.getSave(key)

    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(inserted?.updatedAt.getTime() ?? 0)
  })

  it('versions each (appId, accountId, slotKey) slot independently', async () => {
    await store.putSave({ appId: 'boop', accountId: 'a', slotKey: 'boop:save', blob: 'one' })
    await store.putSave({ appId: 'boop', accountId: 'a', slotKey: 'boop:save', blob: 'two' })
    await store.putSave({ appId: 'boop', accountId: 'b', slotKey: 'boop:save', blob: 'one' })

    await expect(
      store.getSave({ appId: 'boop', accountId: 'b', slotKey: 'boop:save' }),
    ).resolves.toMatchObject({ version: 1 })
  })

  it('records the blob byte length, not its character count', async () => {
    await store.putSave({
      appId: 'boop',
      accountId: 'parent-1',
      slotKey: 'boop:save',
      blob: '🥁',
    })

    const [slot] = await store.listSaves({ appId: 'boop', accountId: 'parent-1' })
    expect(slot?.sizeBytes).toBe(4)
  })

  it('lists slot metadata without blobs', async () => {
    await store.putSave({
      appId: 'boop',
      accountId: 'parent-1',
      slotKey: 'boop:save',
      blob: 'one',
    })
    await store.putSave({
      appId: 'silt',
      accountId: 'parent-1',
      slotKey: 'silt:scene:1',
      blob: 'two',
    })

    const slots = await store.listSaves({ appId: 'boop', accountId: 'parent-1' })
    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({ slotKey: 'boop:save', version: 1, sizeBytes: 3 })
    expect(Object.keys(slots[0] ?? {})).toEqual(['slotKey', 'version', 'sizeBytes', 'updatedAt'])
  })

  it('deletes a single slot and leaves the rest alone', async () => {
    const key = { appId: 'boop', accountId: 'parent-1', slotKey: 'boop:save' }
    await store.putSave({ ...key, blob: 'one' })
    await store.putSave({ ...key, slotKey: 'boop:other', blob: 'two' })

    await store.deleteSave(key)

    const slots = await store.listSaves({ appId: 'boop', accountId: 'parent-1' })
    expect(slots.map((slot) => slot.slotKey)).toEqual(['boop:other'])
  })
})

describe('DrizzleFamilyStore save usage', () => {
  let store: DrizzleFamilyStore

  const key = { appId: 'boop', accountId: 'parent-1', slotKey: 'boop:save' }

  beforeEach(async () => {
    ;({ store } = await freshStore())
  })

  const nothing = { accountBytes: 0, accountSlots: 0, slotBytes: 0, slotExists: false }

  it('reports nothing stored for an account with no saves', async () => {
    await expect(store.saveUsage(key)).resolves.toEqual(nothing)
  })

  it('sums every appId for the account, and the addressed slot within it', async () => {
    await store.putSave({ ...key, blob: 'one' })
    await store.putSave({ ...key, slotKey: 'boop:other', blob: 'four' })
    await store.putSave({ ...key, appId: 'silt', slotKey: 'silt:scene:1', blob: 'twelve bytes' })

    await expect(store.saveUsage(key)).resolves.toEqual({
      accountBytes: 19,
      accountSlots: 3,
      slotBytes: 3,
      slotExists: true,
    })
  })

  // The slot is `(appId, slotKey)`: one half matching is not the slot.
  it('does not count the same slotKey under another appId as this slot', async () => {
    await store.putSave({ ...key, appId: 'silt', blob: 'four' })

    await expect(store.saveUsage(key)).resolves.toEqual({
      accountBytes: 4,
      accountSlots: 1,
      slotBytes: 0,
      slotExists: false,
    })
  })

  it('counts bytes, not characters', async () => {
    await store.putSave({ ...key, blob: '🥁' })

    await expect(store.saveUsage(key)).resolves.toEqual({
      accountBytes: 4,
      accountSlots: 1,
      slotBytes: 4,
      slotExists: true,
    })
  })

  // An empty blob costs no bytes, so only the slot count notices it.
  it('counts an empty slot as a slot', async () => {
    await store.putSave({ ...key, blob: '' })

    await expect(store.saveUsage(key)).resolves.toEqual({
      accountBytes: 0,
      accountSlots: 1,
      slotBytes: 0,
      slotExists: true,
    })
  })

  it('counts no other account', async () => {
    await store.putSave({ ...key, accountId: 'parent-2', blob: 'theirs' })

    await expect(store.saveUsage(key)).resolves.toEqual(nothing)
  })
})

describe('DrizzleFamilyStore account erasure', () => {
  it('leaves no orphan saves behind the deleted parent and its profiles', async () => {
    const { db, store } = await freshStore()
    await insertParent(db, 'parent-1')
    const ada = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada',
      displayName: 'Ada',
    })
    const bob = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'bob',
      displayName: 'Bob',
    })
    for (const accountId of ['parent-1', ada.id, bob.id]) {
      await store.putSave({ appId: 'boop', accountId, slotKey: 'boop:save', blob: 'beats' })
    }

    await store.deleteAccount('parent-1')

    expect(await db.select().from(familySchema.user)).toEqual([])
    expect(await db.select().from(familySchema.childProfiles)).toEqual([])
    expect(await db.select().from(familySchema.saves)).toEqual([])
  })

  it('rolls the saves delete back when the user delete fails', async () => {
    const { db, store } = await freshStore()
    await insertParent(db, 'parent-1')
    const ada = await store.addChildProfile({
      parentId: 'parent-1',
      username: 'ada',
      displayName: 'Ada',
    })
    for (const accountId of ['parent-1', ada.id]) {
      await store.putSave({ appId: 'boop', accountId, slotKey: 'boop:save', blob: 'beats' })
    }
    // Stands in for a future table referencing `user` with NO ACTION: the user
    // delete fails after the saves delete, so both must roll back together.
    await db.execute(sql`
      create function block_user_delete() returns trigger
      as $$ begin raise exception 'blocked'; end; $$ language plpgsql
    `)
    await db.execute(sql`
      create trigger block_user_delete before delete on "user"
      for each row execute function block_user_delete()
    `)

    await expect(store.deleteAccount('parent-1')).rejects.toThrow()

    expect(await db.select().from(familySchema.saves)).toHaveLength(2)
    expect(await db.select().from(familySchema.user)).toHaveLength(1)
    expect(await db.select().from(familySchema.childProfiles)).toHaveLength(1)
  })

  it('erases nothing belonging to another household', async () => {
    const { db, store } = await freshStore()
    await insertParent(db, 'parent-1')
    await insertParent(db, 'parent-2')
    const grace = await store.addChildProfile({
      parentId: 'parent-2',
      username: 'grace',
      displayName: 'Grace',
    })
    await store.putSave({
      appId: 'boop',
      accountId: 'parent-1',
      slotKey: 'boop:save',
      blob: 'beats',
    })
    await store.putSave({
      appId: 'boop',
      accountId: grace.id,
      slotKey: 'boop:save',
      blob: 'beats',
    })

    await store.deleteAccount('parent-1')

    expect((await db.select().from(familySchema.user)).map((row) => row.id)).toEqual(['parent-2'])
    expect((await db.select().from(familySchema.saves)).map((row) => row.accountId)).toEqual([
      grace.id,
    ])
  })
})
