import { ForbiddenError, NotFoundError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { DeleteConversationHandler } from './deleteConversationHandler.ts'

async function seedConversation(store: FakeSproutStore, parentId: string) {
  const child = await store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'hash',
  })
  const conversation = await store.createConversation({ childId: child.id })
  return { child, conversation }
}

describe('DeleteConversationHandler (source: child-initiated; kept open to the owning parent too)', () => {
  it('soft-deletes the conversation for its own child — the row survives with deletedAt set', async () => {
    const store = new FakeSproutStore()
    const { child, conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    await expect(
      new DeleteConversationHandler().run({ conversationId: conversation.id }, ctx),
    ).resolves.toEqual({ success: true })
    const row = await store.getConversation(conversation.id)
    expect(row?.deletedAt).toBeInstanceOf(Date)
  })

  // The safeguarding point of pilot issue 03: the old hard delete cascaded the
  // conversation's messages AND safety flags away; a child's delete must not.
  it('leaves the messages and flags of a child-deleted conversation untouched', async () => {
    const store = new FakeSproutStore()
    const { child, conversation } = await seedConversation(store, 'p1')
    const message = await store.addMessage({
      conversationId: conversation.id,
      role: 'ai',
      content: 'flagged answer',
    })
    await store.createFlag({
      childId: child.id,
      conversationId: conversation.id,
      messageId: message.id,
      type: 'sensitive',
      reason: 'test',
    })
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    await new DeleteConversationHandler().run({ conversationId: conversation.id }, ctx)

    await expect(store.listMessages(conversation.id)).resolves.toHaveLength(1)
    await expect(store.listFlagsByChild(child.id)).resolves.toHaveLength(1)
  })

  it('also allows the owning parent to delete', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new DeleteConversationHandler().run({ conversationId: conversation.id }, ctx),
    ).resolves.toEqual({ success: true })
    const row = await store.getConversation(conversation.id)
    expect(row?.deletedAt).toBeInstanceOf(Date)
  })

  it('404s the child re-deleting an already-deleted conversation (gone from their view)', async () => {
    const store = new FakeSproutStore()
    const { child, conversation } = await seedConversation(store, 'p1')
    await store.softDeleteConversation(conversation.id)
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    await expect(
      new DeleteConversationHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(NotFoundError)
  })

  it("403s a different parent (cross-family IDOR)", async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(
      new DeleteConversationHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })

  it("403s a different child (cannot delete another child's conversation)", async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: childUser('other-child', 'p1') })

    await expect(
      new DeleteConversationHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })

  it('404s a conversation that does not exist', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new DeleteConversationHandler().run(
        { conversationId: '00000000-0000-0000-0000-000000000000' },
        ctx,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it('401s an anonymous caller', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: null })

    await expect(
      new DeleteConversationHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(UnauthorizedError)
  })
})
