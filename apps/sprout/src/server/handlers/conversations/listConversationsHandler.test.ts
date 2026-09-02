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

  // Pilot issue 03: soft-deleted conversations vanish from the child's list but
  // stay in the parent's, marked so the dashboard can label them.
  it('hides soft-deleted conversations from the child', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    await store.createConversation({ childId: child.id, title: 'kept' })
    const deleted = await store.createConversation({ childId: child.id, title: 'deleted' })
    await store.softDeleteConversation(deleted.id)
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    const result = await new ListConversationsHandler().run({ childId: child.id }, ctx)
    expect(result.map((c) => c.title)).toEqual(['kept'])
  })

  it('shows soft-deleted conversations to the owning parent, marked with deletedAt', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    await store.createConversation({ childId: child.id, title: 'kept' })
    const deleted = await store.createConversation({ childId: child.id, title: 'deleted' })
    await store.softDeleteConversation(deleted.id)
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new ListConversationsHandler().run({ childId: child.id }, ctx)
    expect(result).toHaveLength(2)
    expect(result.find((c) => c.title === 'deleted')?.deletedAt).toEqual(expect.any(String))
    expect(result.find((c) => c.title === 'kept')?.deletedAt).toBeNull()
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
