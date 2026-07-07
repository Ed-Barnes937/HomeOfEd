import { ForbiddenError, NotFoundError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it, vi } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { SummariseAndPurgeHandler } from './summariseAndPurgeHandler.ts'

async function seedConversation(
  store: FakeSproutStore,
  parentId: string,
  summary: string | null = null,
) {
  const child = await store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'hash',
  })
  const conversation = await store.createConversation({ childId: child.id, summary })
  return { child, conversation }
}

describe('SummariseAndPurgeHandler', () => {
  it('calls the injected summariser with the messages and purges them atomically', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1')
    await store.addMessage({ conversationId: conversation.id, role: 'child', content: 'hi' })
    await store.addMessage({ conversationId: conversation.id, role: 'ai', content: 'hello!' })
    const summarise = vi.fn().mockResolvedValue('a condensed summary')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new SummariseAndPurgeHandler(summarise).run(
      { conversationId: conversation.id },
      ctx,
    )

    expect(result).toEqual({ summary: 'a condensed summary' })
    expect(summarise).toHaveBeenCalledWith([
      { role: 'child', content: 'hi' },
      { role: 'ai', content: 'hello!' },
    ])
    expect(await store.listMessages(conversation.id)).toEqual([]) // purged
    expect((await store.getConversation(conversation.id))?.summary).toBe('a condensed summary')
  })

  it('returns the existing summary without calling the summariser when there are no messages', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1', 'already summarised')
    const summarise = vi.fn()
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new SummariseAndPurgeHandler(summarise).run(
      { conversationId: conversation.id },
      ctx,
    )

    expect(result).toEqual({ summary: 'already summarised' })
    expect(summarise).not.toHaveBeenCalled()
  })

  it('403s a different parent (cross-family IDOR)', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(
      new SummariseAndPurgeHandler(vi.fn()).run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })

  it('rejects a child caller (parent authentication required)', async () => {
    const store = new FakeSproutStore()
    const { child, conversation } = await seedConversation(store, 'p1')
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    await expect(
      new SummariseAndPurgeHandler(vi.fn()).run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(UnauthorizedError)
  })

  it('404s a conversation that does not exist', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new SummariseAndPurgeHandler(vi.fn()).run(
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
      new SummariseAndPurgeHandler(vi.fn()).run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(UnauthorizedError)
  })
})
