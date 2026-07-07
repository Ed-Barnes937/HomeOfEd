import { ForbiddenError, NotFoundError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { ListMessagesHandler } from './listMessagesHandler.ts'

async function seedConversationWithMessage(store: FakeSproutStore, parentId: string) {
  const child = await store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'hash',
  })
  const conversation = await store.createConversation({ childId: child.id })
  await store.addMessage({ conversationId: conversation.id, role: 'child', content: 'hi' })
  return { child, conversation }
}

describe('ListMessagesHandler (dual-role: owning parent OR the conversation child)', () => {
  it('returns messages for the owning parent (e.g. flag review)', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversationWithMessage(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new ListMessagesHandler().run(
      { conversationId: conversation.id },
      ctx,
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ content: 'hi', conversationId: conversation.id })
  })

  it("returns messages for the conversation's own child (resuming a chat)", async () => {
    const store = new FakeSproutStore()
    const { child, conversation } = await seedConversationWithMessage(store, 'p1')
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    const result = await new ListMessagesHandler().run(
      { conversationId: conversation.id },
      ctx,
    )
    expect(result).toHaveLength(1)
  })

  it("403s a different parent (cross-family IDOR)", async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversationWithMessage(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(
      new ListMessagesHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })

  it("403s a different child (cannot access another child's conversation)", async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversationWithMessage(store, 'p1')
    const ctx = makeCtx({ store, user: childUser('other-child', 'p1') })

    await expect(
      new ListMessagesHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })

  it('404s a conversation that does not exist', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new ListMessagesHandler().run(
        { conversationId: '00000000-0000-0000-0000-000000000000' },
        ctx,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it('401s an anonymous caller', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversationWithMessage(store, 'p1')
    const ctx = makeCtx({ store, user: null })

    await expect(
      new ListMessagesHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(UnauthorizedError)
  })
})
