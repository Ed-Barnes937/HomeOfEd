import { ForbiddenError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { ParentChildProfileHandler } from './parentChildProfileHandler.ts'

const seedChild = (store: FakeSproutStore, parentId: string, pinHash: string | null) =>
  store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'pw-hash',
    pinHash,
    presetName: 'early-learner',
  })

describe('ParentChildProfileHandler', () => {
  it('returns the picker profile of the parent’s own child', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1', 'pin-hash')

    const result = await new ParentChildProfileHandler().run(
      { childId: child.id },
      makeCtx({ store, user: parentUser('p1') }),
    )

    expect(result).toEqual({
      id: child.id,
      displayName: 'Kid',
      presetName: 'early-learner',
      hasPin: true,
    })
  })

  it('reports hasPin false after a PIN reset', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1', null)

    const result = await new ParentChildProfileHandler().run(
      { childId: child.id },
      makeCtx({ store, user: parentUser('p1') }),
    )

    expect(result.hasPin).toBe(false)
  })

  it('requires the owning parent', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p2', 'pin-hash')

    await expect(
      new ParentChildProfileHandler().run({ childId: child.id }, makeCtx({ store })),
    ).rejects.toThrow(UnauthorizedError)
    await expect(
      new ParentChildProfileHandler().run(
        { childId: child.id },
        makeCtx({ store, user: parentUser('p1') }),
      ),
    ).rejects.toThrow(ForbiddenError)
  })
})
