import { ForbiddenError, NotFoundError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { GetChildHandler } from './getChildHandler.ts'

async function seedChild(store: FakeSproutStore, parentId: string) {
  return store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'hash',
  })
}

describe('GetChildHandler (ownership is the point)', () => {
  it('returns a child the authenticated parent owns', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(new GetChildHandler().run({ childId: child.id }, ctx)).resolves.toMatchObject({
      id: child.id,
      displayName: 'Kid',
    })
  })

  it("403s when a parent reaches for another parent's child (cross-family IDOR)", async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(new GetChildHandler().run({ childId: child.id }, ctx)).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('404s for a child that does not exist', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new GetChildHandler().run({ childId: '00000000-0000-0000-0000-000000000000' }, ctx),
    ).rejects.toThrow(NotFoundError)
  })

  it('401s an anonymous caller', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: null })

    await expect(new GetChildHandler().run({ childId: child.id }, ctx)).rejects.toThrow(
      UnauthorizedError,
    )
  })
})
