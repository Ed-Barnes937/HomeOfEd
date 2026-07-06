import { freshTestDb } from '@hoe/db'
import { beforeEach, describe, expect, it } from 'vitest'

import { migrations } from './migrations.ts'
import { sproutSchema } from './schema.ts'
import { DrizzleSproutStore } from './store.ts'

// A fresh migrated PGlite + Store per test = per-test isolation.
async function freshStore(): Promise<DrizzleSproutStore> {
  const db = await freshTestDb(sproutSchema, migrations)
  return new DrizzleSproutStore(db)
}

// Parent accounts satisfy the children.parentId FK. Better Auth ids are strings.
let parentSeq = 0
async function makeParent(store: DrizzleSproutStore): Promise<string> {
  parentSeq += 1
  return store.createUser({
    id: `parent-${parentSeq}`,
    name: `Parent ${parentSeq}`,
    email: `parent-${parentSeq}@example.com`,
  })
}

const childInput = (parentId: string, username: string) => ({
  parentId,
  displayName: 'Kid',
  username,
  passwordHash: 'hash',
})

describe('DrizzleSproutStore over PGlite with the generated migrations', () => {
  beforeEach(() => {
    parentSeq = 0
  })

  it('pings after migration', async () => {
    const store = await freshStore()
    await expect(store.ping()).resolves.toEqual({ ok: true })
  })

  it('round-trips a child and lists it by parent', async () => {
    const store = await freshStore()
    const parentId = await makeParent(store)
    const child = await store.createChild(childInput(parentId, 'kid1'))

    await expect(store.getChild(child.id)).resolves.toMatchObject({ id: child.id, username: 'kid1' })
    await expect(store.listChildrenByParent(parentId)).resolves.toHaveLength(1)
  })

  // Feature check 1 — JSON payload round-trip. NB the source stores flag topics
  // as a JSON *string* in a `text` column (there are no true jsonb columns in
  // the source schema); this proves the text JSON round-trips faithfully.
  it('round-trips a JSON topics payload stored in flags.topics (text)', async () => {
    const store = await freshStore()
    const parentId = await makeParent(store)
    const child = await store.createChild(childInput(parentId, 'kid1'))
    const topics = ['sensitive-a', 'sensitive-b']

    await store.createFlag({
      childId: child.id,
      type: 'sensitive',
      reason: 'test',
      topics: JSON.stringify(topics),
    })

    const rows = await store.listFlagsByChild(child.id)
    expect(rows).toHaveLength(1)
    expect(JSON.parse(rows[0]?.topics ?? '[]')).toEqual(topics)
  })

  // Feature check 2 — composite-index query
  // (behavioural_events_child_kind_created_idx on childId, kind, createdAt).
  it('counts behavioural events by child + kind since a time (composite index)', async () => {
    const store = await freshStore()
    const parentId = await makeParent(store)
    const child = await store.createChild(childInput(parentId, 'kid1'))
    const old = new Date('2020-01-01T00:00:00Z')
    const recent = new Date('2026-07-06T12:00:00Z')

    await store.recordBehaviouralEvent({ childId: child.id, kind: 'pin_fail', createdAt: old })
    await store.recordBehaviouralEvent({ childId: child.id, kind: 'pin_fail', createdAt: recent })
    await store.recordBehaviouralEvent({ childId: child.id, kind: 'message', createdAt: recent })

    const since = new Date('2026-01-01T00:00:00Z')
    await expect(
      store.countBehaviouralEvents({ childId: child.id, kind: 'pin_fail', since }),
    ).resolves.toBe(1)
    await expect(
      store.countBehaviouralEvents({ childId: child.id, kind: 'message', since }),
    ).resolves.toBe(1)
  })

  // Feature check 3 — unique-constraint conflict (children.username is unique).
  it('rejects a duplicate child username (unique constraint)', async () => {
    const store = await freshStore()
    const parentId = await makeParent(store)
    await store.createChild(childInput(parentId, 'dupe'))
    await expect(store.createChild(childInput(parentId, 'dupe'))).rejects.toThrow()
  })

  // Feature check 4 — cascade delete: deleting a parent user cascades through
  // children (FK added in §5.2) → conversations → messages/flags.
  it('cascades a parent delete through children and their conversations/messages/flags', async () => {
    const store = await freshStore()
    const parentId = await makeParent(store)
    const child = await store.createChild(childInput(parentId, 'kid1'))
    const conversation = await store.createConversation({ childId: child.id, title: 'chat' })
    await store.addMessage({ conversationId: conversation.id, role: 'child', content: 'hi' })
    await store.createFlag({ childId: child.id, type: 'sensitive', reason: 'test' })

    await store.deleteUser(parentId)

    await expect(store.getChild(child.id)).resolves.toBeNull()
    await expect(store.listChildrenByParent(parentId)).resolves.toHaveLength(0)
    await expect(store.listMessages(conversation.id)).resolves.toHaveLength(0)
    await expect(store.listFlagsByChild(child.id)).resolves.toHaveLength(0)
  })
})
