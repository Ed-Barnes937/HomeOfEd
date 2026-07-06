import { ForbiddenError, NotFoundError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { ReviewFlagHandler } from './reviewFlagHandler.ts'

async function seedChild(store: FakeSproutStore, parentId: string) {
  return store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'hash',
  })
}

describe('ReviewFlagHandler (ownership is the point)', () => {
  it('marks a flag reviewed for the owning parent', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const flag = await store.createFlag({ childId: child.id, type: 'sensitive', reason: 'r' })
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new ReviewFlagHandler().run({ flagId: flag.id, reviewed: true }, ctx)

    expect(result.reviewed).toBe(true)
    expect((await store.getFlag(flag.id))?.reviewed).toBe(true)
  })

  it("403s when a parent reaches for another parent's child's flag (cross-family IDOR)", async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const flag = await store.createFlag({ childId: child.id, type: 'sensitive', reason: 'r' })
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(
      new ReviewFlagHandler().run({ flagId: flag.id, reviewed: true }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })

  it('404s for a flag that does not exist', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new ReviewFlagHandler().run(
        { flagId: '00000000-0000-0000-0000-000000000000', reviewed: true },
        ctx,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it('401s an anonymous caller', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const flag = await store.createFlag({ childId: child.id, type: 'sensitive', reason: 'r' })
    const ctx = makeCtx({ store, user: null })

    await expect(
      new ReviewFlagHandler().run({ flagId: flag.id, reviewed: true }, ctx),
    ).rejects.toThrow(UnauthorizedError)
  })
})
