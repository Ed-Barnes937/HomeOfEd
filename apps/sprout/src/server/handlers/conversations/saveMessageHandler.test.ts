import { ForbiddenError, NotFoundError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { SaveMessageHandler } from './saveMessageHandler.ts'

async function seedConversation(store: FakeSproutStore, parentId: string) {
  const child = await store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'hash',
  })
  const conversation = await store.createConversation({
    childId: child.id,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  })
  return { child, conversation }
}

describe('SaveMessageHandler', () => {
  it("saves the message and bumps the conversation's updatedAt (touchConversation)", async () => {
    const later = new Date('2026-06-01T00:00:00Z')
    const store = new FakeSproutStore(() => later)
    const { child, conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1'), now: () => later })

    const result = await new SaveMessageHandler().run(
      { conversationId: conversation.id, role: 'child', content: 'hello' },
      ctx,
    )

    expect(result).toMatchObject({ role: 'child', content: 'hello', conversationId: conversation.id })
    const updated = await store.getConversation(conversation.id)
    expect(updated?.updatedAt).toEqual(later) // touchConversation was called
  })

  it('defaults flagged to false', async () => {
    const store = new FakeSproutStore()
    const { child, conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    const result = await new SaveMessageHandler().run(
      { conversationId: conversation.id, role: 'ai', content: 'hi there' },
      ctx,
    )
    expect(result.flagged).toBe(false)
  })

  it("403s when the child tries to save into someone else's conversation", async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: childUser('other-child', 'p1') })

    await expect(
      new SaveMessageHandler().run(
        { conversationId: conversation.id, role: 'child', content: 'hi' },
        ctx,
      ),
    ).rejects.toThrow(ForbiddenError)
  })

  it('404s a conversation that does not exist', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: childUser('c1', 'p1') })

    await expect(
      new SaveMessageHandler().run(
        {
          conversationId: '00000000-0000-0000-0000-000000000000',
          role: 'child',
          content: 'hi',
        },
        ctx,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it('401s an anonymous caller', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: null })

    await expect(
      new SaveMessageHandler().run(
        { conversationId: conversation.id, role: 'child', content: 'hi' },
        ctx,
      ),
    ).rejects.toThrow(UnauthorizedError)
  })

  it('rejects a parent caller (child authentication required)', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new SaveMessageHandler().run(
        { conversationId: conversation.id, role: 'child', content: 'hi' },
        ctx,
      ),
    ).rejects.toThrow(UnauthorizedError)
  })
})
