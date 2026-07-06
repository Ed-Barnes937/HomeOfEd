import { UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { ListFlagsHandler } from './listFlagsHandler.ts'

async function seedChild(store: FakeSproutStore, parentId: string, displayName: string) {
  return store.createChild({
    parentId,
    displayName,
    username: `${displayName}-${parentId}`.toLowerCase(),
    passwordHash: 'hash',
  })
}

describe('ListFlagsHandler (cross-family isolation is the point)', () => {
  it("returns only the authed parent's children's flags, newest-first", async () => {
    const store = new FakeSproutStore()
    const mine = await seedChild(store, 'p1', 'Mine')
    const theirs = await seedChild(store, 'p2', 'Theirs')
    await store.createFlag({ childId: theirs.id, type: 'sensitive', reason: 'other family' })
    const older = await store.createFlag({
      childId: mine.id,
      type: 'sensitive',
      reason: 'older',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
    const newer = await store.createFlag({
      childId: mine.id,
      type: 'blocked',
      reason: 'newer',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    })

    const ctx = makeCtx({ store, user: parentUser('p1') })
    const result = await new ListFlagsHandler().run(undefined, ctx)

    expect(result.map((f) => f.id)).toEqual([newer.id, older.id])
    expect(result.every((f) => f.childDisplayName === 'Mine')).toBe(true)
  })

  it('IGNORES any childId in input — the owned set always wins (closes #35 IDOR)', async () => {
    const store = new FakeSproutStore()
    const mine = await seedChild(store, 'p1', 'Mine')
    const theirs = await seedChild(store, 'p2', 'Theirs')
    const myFlag = await store.createFlag({ childId: mine.id, type: 'sensitive', reason: 'r' })
    const theirFlag = await store.createFlag({ childId: theirs.id, type: 'sensitive', reason: 'r' })

    const ctx = makeCtx({ store, user: parentUser('p1') })

    // Even asking for another family's child by id must not leak their flag,
    // and must not narrow away the caller's own children either.
    const result = await new ListFlagsHandler().run({ childId: theirs.id }, ctx)

    expect(result.map((f) => f.id)).toEqual([myFlag.id])
    expect(result.some((f) => f.id === theirFlag.id)).toBe(false)
  })

  it('returns an empty list for a parent with no children', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(new ListFlagsHandler().run(undefined, ctx)).resolves.toEqual([])
  })

  it('401s an anonymous caller', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: null })

    await expect(new ListFlagsHandler().run(undefined, ctx)).rejects.toThrow(UnauthorizedError)
  })
})
