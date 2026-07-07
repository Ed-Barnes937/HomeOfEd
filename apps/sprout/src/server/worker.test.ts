// Retention worker integration test (plan §9.2 / P9). Drives the pure-ish
// `runRetentionSweep` over a fresh migrated PGlite + DrizzleSproutStore with a
// fake summariser and a FIXED `now`, so no timers / docker are involved.
import { freshTestDb } from '@hoe/db'
import type { Logger } from '@hoe/backend-kit'
import { describe, expect, it, vi } from 'vitest'

import { migrations } from './migrations.ts'
import { sproutSchema } from './schema.ts'
import { DrizzleSproutStore } from './store.ts'
import { runRetentionSweep } from './worker.ts'

const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => silentLogger,
}

const NOW = new Date('2026-06-01T00:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * DAY)

async function freshStore(): Promise<DrizzleSproutStore> {
  const db = await freshTestDb(sproutSchema, migrations)
  return new DrizzleSproutStore(db)
}

async function seedChild(store: DrizzleSproutStore): Promise<string> {
  const parentId = await store.createUser({
    id: 'parent-1',
    name: 'Parent',
    email: 'parent@example.com',
  })
  const child = await store.createChild({
    parentId,
    displayName: 'Kid',
    username: 'kid1',
    passwordHash: 'hash',
  })
  return child.id
}

describe('runRetentionSweep over PGlite', () => {
  it('summarises + purges only past-window conversations, prunes only old events', async () => {
    const store = await freshStore()
    const childId = await seedChild(store)

    // Past-window conversation with messages -> should be summarised + purged.
    const oldConvo = await store.createConversation({
      childId,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(40),
    })
    await store.addMessage({ conversationId: oldConvo.id, role: 'child', content: 'old-1' })
    await store.addMessage({ conversationId: oldConvo.id, role: 'ai', content: 'old-2' })

    // Recent conversation -> untouched.
    const recentConvo = await store.createConversation({
      childId,
      createdAt: NOW,
      updatedAt: NOW,
    })
    await store.addMessage({ conversationId: recentConvo.id, role: 'child', content: 'fresh-1' })

    // Behavioural events: one old (pruned), one recent (kept).
    await store.recordBehaviouralEvent({ kind: 'message', childId, createdAt: daysAgo(40) })
    await store.recordBehaviouralEvent({ kind: 'message', childId, createdAt: NOW })

    const summarise = vi.fn((msgs: { role: string; content: string }[]) =>
      Promise.resolve(`summary(${msgs.map((m) => m.content).join('|')})`),
    )

    const result = await runRetentionSweep({
      store,
      summarise,
      now: () => NOW,
      logger: silentLogger,
      retentionDays: 30,
      behaviouralEventRetentionDays: 30,
    })

    expect(result).toMatchObject({ conversationsSummarised: 1, conversationsFailed: 0 })

    // Old conversation: messages purged, summary set from the fake summariser.
    await expect(store.listMessages(oldConvo.id)).resolves.toHaveLength(0)
    await expect(store.getConversation(oldConvo.id)).resolves.toMatchObject({
      summary: 'summary(old-1|old-2)',
    })

    // Recent conversation: untouched.
    await expect(store.listMessages(recentConvo.id)).resolves.toHaveLength(1)
    await expect(store.getConversation(recentConvo.id)).resolves.toMatchObject({ summary: null })

    // Events: old dropped, recent kept.
    await expect(
      store.countBehaviouralEvents({ kind: 'message', since: new Date(0), childId }),
    ).resolves.toBe(1)

    // The summariser saw only the past-window conversation.
    expect(summarise).toHaveBeenCalledTimes(1)
  })

  it('continues the sweep when the summariser fails on one conversation', async () => {
    const store = await freshStore()
    const childId = await seedChild(store)

    const goodConvo = await store.createConversation({
      childId,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(40),
    })
    await store.addMessage({ conversationId: goodConvo.id, role: 'child', content: 'good' })

    const badConvo = await store.createConversation({
      childId,
      createdAt: daysAgo(50),
      updatedAt: daysAgo(50),
    })
    await store.addMessage({ conversationId: badConvo.id, role: 'child', content: 'BOOM' })

    // Throws for the conversation whose transcript contains BOOM.
    const summarise = (msgs: { role: string; content: string }[]): Promise<string> => {
      if (msgs.some((m) => m.content.includes('BOOM'))) {
        return Promise.reject(new Error('pipeline exploded'))
      }
      return Promise.resolve('ok-summary')
    }

    const result = await runRetentionSweep({
      store,
      summarise,
      now: () => NOW,
      logger: silentLogger,
      retentionDays: 30,
      behaviouralEventRetentionDays: 30,
    })

    // One succeeded, one failed — the failure did not abort the whole sweep.
    expect(result).toMatchObject({ conversationsSummarised: 1, conversationsFailed: 1 })

    // Good conversation was still summarised + purged.
    await expect(store.listMessages(goodConvo.id)).resolves.toHaveLength(0)
    await expect(store.getConversation(goodConvo.id)).resolves.toMatchObject({
      summary: 'ok-summary',
    })

    // Bad conversation kept its messages and has no summary.
    await expect(store.listMessages(badConvo.id)).resolves.toHaveLength(1)
    await expect(store.getConversation(badConvo.id)).resolves.toMatchObject({ summary: null })
  })
})
