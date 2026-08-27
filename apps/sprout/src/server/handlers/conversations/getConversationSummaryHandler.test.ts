import { ForbiddenError, NotFoundError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { GetConversationSummaryHandler } from './getConversationSummaryHandler.ts'

async function seedConversation(store: FakeSproutStore, parentId: string, summary: string | null) {
  const child = await store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'hash',
  })
  const conversation = await store.createConversation({ childId: child.id, summary })
  return { child, conversation }
}

describe('GetConversationSummaryHandler (dual-role: owning parent OR the conversation child)', () => {
  it('returns null when no summary exists yet, for the owning parent', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1', null)
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new GetConversationSummaryHandler().run({ conversationId: conversation.id }, ctx),
    ).resolves.toEqual({ summary: null, deletedAt: null })
  })

  it('returns the summary for the conversation own child', async () => {
    const store = new FakeSproutStore()
    const { child, conversation } = await seedConversation(store, 'p1', 'condensed')
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    await expect(
      new GetConversationSummaryHandler().run({ conversationId: conversation.id }, ctx),
    ).resolves.toEqual({ summary: 'condensed', deletedAt: null })
  })

  // Pilot issue 03: the parent's read carries the deleted-by-child marker so
  // the dashboard can label it; the child's own read 404s.
  it('marks a soft-deleted conversation with deletedAt for the owning parent', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1', 'condensed')
    await store.softDeleteConversation(conversation.id)
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new GetConversationSummaryHandler().run(
      { conversationId: conversation.id },
      ctx,
    )
    expect(result.summary).toBe('condensed')
    expect(result.deletedAt).toEqual(expect.any(String))
  })

  it('404s the child on a soft-deleted conversation', async () => {
    const store = new FakeSproutStore()
    const { child, conversation } = await seedConversation(store, 'p1', 'condensed')
    await store.softDeleteConversation(conversation.id)
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    await expect(
      new GetConversationSummaryHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(NotFoundError)
  })

  it("403s a different parent (cross-family IDOR)", async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1', null)
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(
      new GetConversationSummaryHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })

  it("403s a different child", async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1', null)
    const ctx = makeCtx({ store, user: childUser('other-child', 'p1') })

    await expect(
      new GetConversationSummaryHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })

  it('404s a conversation that does not exist', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new GetConversationSummaryHandler().run(
        { conversationId: '00000000-0000-0000-0000-000000000000' },
        ctx,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it('401s an anonymous caller', async () => {
    const store = new FakeSproutStore()
    const { conversation } = await seedConversation(store, 'p1', null)
    const ctx = makeCtx({ store, user: null })

    await expect(
      new GetConversationSummaryHandler().run({ conversationId: conversation.id }, ctx),
    ).rejects.toThrow(UnauthorizedError)
  })
})
