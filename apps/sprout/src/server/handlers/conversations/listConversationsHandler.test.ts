import { ForbiddenError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { ListConversationsHandler } from './listConversationsHandler.ts'

async function seedChild(store: FakeSproutStore, parentId: string) {
  return store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'hash',
  })
}

describe('ListConversationsHandler (dual-role: owning parent OR the child themself)', () => {
  it("returns the child's conversations for the owning parent", async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    await store.createConversation({ childId: child.id, title: 'A' })
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new ListConversationsHandler().run({ childId: child.id }, ctx)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ title: 'A' })
  })

  it('returns the same conversations for the child reading their own history', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    await store.createConversation({ childId: child.id, title: 'A' })
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    const result = await new ListConversationsHandler().run({ childId: child.id }, ctx)
    expect(result).toHaveLength(1)
  })

  it("403s when a different parent reaches for another family's child (cross-family IDOR)", async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(new ListConversationsHandler().run({ childId: child.id }, ctx)).rejects.toThrow(
      ForbiddenError,
    )
  })

  it("403s when a different child reaches for another child's conversations", async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: childUser('other-child', 'p1') })

    await expect(new ListConversationsHandler().run({ childId: child.id }, ctx)).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('401s an anonymous caller', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: null })

    await expect(new ListConversationsHandler().run({ childId: child.id }, ctx)).rejects.toThrow(
      UnauthorizedError,
    )
  })
})
