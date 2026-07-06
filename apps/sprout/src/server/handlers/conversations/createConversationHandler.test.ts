import { UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { CreateConversationHandler } from './createConversationHandler.ts'

async function seedChild(store: FakeSproutStore, parentId: string) {
  return store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'hash',
  })
}

describe('CreateConversationHandler', () => {
  it('creates a conversation owned by the authenticated child', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    const result = await new CreateConversationHandler().run({ title: 'My chat' }, ctx)

    expect(result).toMatchObject({ childId: child.id, title: 'My chat' })
    const stored = await store.getConversation(result.id)
    expect(stored?.childId).toBe(child.id)
  })

  it('defaults to a null title when none is given', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    const result = await new CreateConversationHandler().run({}, ctx)
    expect(result.title).toBeNull()
  })

  it('401s an anonymous caller', async () => {
    const ctx = makeCtx({ user: null })
    await expect(new CreateConversationHandler().run({}, ctx)).rejects.toThrow(UnauthorizedError)
  })

  it('rejects a parent caller (child authentication required)', async () => {
    const ctx = makeCtx({ user: parentUser('p1') })
    await expect(new CreateConversationHandler().run({}, ctx)).rejects.toThrow(UnauthorizedError)
  })
})
