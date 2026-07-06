import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { GetChildStatsHandler } from './getChildStatsHandler.ts'

describe('GetChildStatsHandler', () => {
  it('aggregates message/conversation counts, top topics, unreviewed flags, last active', async () => {
    const store = new FakeSproutStore()
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid',
      passwordHash: 'h',
    })

    const convo = await store.createConversation({
      childId: child.id,
      title: 'c',
      updatedAt: new Date('2026-05-01T00:00:00Z'),
    })
    await store.addMessage({ conversationId: convo.id, role: 'child', content: 'hi' })
    await store.addMessage({ conversationId: convo.id, role: 'ai', content: 'hello' })

    await store.createFlag({
      childId: child.id,
      type: 'sensitive',
      reason: 'r',
      topics: JSON.stringify(['violence', 'violence', 'death']),
      reviewed: false,
    })
    await store.createFlag({ childId: child.id, type: 'reported', reason: 'r', reviewed: true })

    const ctx = makeCtx({ store, user: parentUser('p1') })
    const stats = await new GetChildStatsHandler().run({ childId: child.id }, ctx)

    expect(stats.messageCount).toBe(2)
    expect(stats.conversationCount).toBe(1)
    expect(stats.topTopics[0]).toBe('violence')
    expect(stats.flagCount).toBe(1) // only the unreviewed flag
    expect(stats.lastActive).toBe('2026-05-01T00:00:00.000Z')
  })

  it('reports zeroes and null lastActive for a child with no activity', async () => {
    const store = new FakeSproutStore()
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid',
      passwordHash: 'h',
    })
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const stats = await new GetChildStatsHandler().run({ childId: child.id }, ctx)
    expect(stats).toEqual({
      messageCount: 0,
      conversationCount: 0,
      topTopics: [],
      flagCount: 0,
      lastActive: null,
    })
  })
})
