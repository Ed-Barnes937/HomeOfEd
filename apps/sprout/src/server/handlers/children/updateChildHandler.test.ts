import { ForbiddenError, ValidationError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { scryptHasher, verifySecret } from '../../password.ts'
import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { UpdateChildHandler } from './updateChildHandler.ts'

async function seed(store: FakeSproutStore, parentId: string) {
  return store.createChild({
    parentId,
    displayName: 'Old',
    username: `kid-${parentId}`,
    passwordHash: 'hash',
  })
}

describe('UpdateChildHandler', () => {
  it('updates the display name and hashes a new PIN', async () => {
    const store = new FakeSproutStore()
    const child = await seed(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new UpdateChildHandler(scryptHasher).run(
      { childId: child.id, displayName: 'New', pin: '9999' },
      ctx,
    )

    expect(result.displayName).toBe('New')
    const updated = await store.getChild(child.id)
    expect(verifySecret('9999', updated?.pinHash ?? '')).toBe(true)
  })

  it('is a no-op that returns the current child when no fields are given', async () => {
    const store = new FakeSproutStore()
    const child = await seed(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new UpdateChildHandler(scryptHasher).run({ childId: child.id }, ctx)
    expect(result.displayName).toBe('Old')
  })

  it('rejects a bad PIN', async () => {
    const store = new FakeSproutStore()
    const child = await seed(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new UpdateChildHandler(scryptHasher).run({ childId: child.id, pin: 'abcd' }, ctx),
    ).rejects.toThrow(ValidationError)
  })

  it("403s a cross-family write", async () => {
    const store = new FakeSproutStore()
    const child = await seed(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(
      new UpdateChildHandler(scryptHasher).run({ childId: child.id, displayName: 'Hacked' }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })
})
