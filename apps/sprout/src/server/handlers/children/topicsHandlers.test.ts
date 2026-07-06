import { ForbiddenError, ValidationError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { AddTopicHandler } from './addTopicHandler.ts'
import { ListTopicsHandler } from './listTopicsHandler.ts'
import { RemoveTopicHandler } from './removeTopicHandler.ts'

async function seedChild(store: FakeSproutStore, parentId: string) {
  return store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'h',
  })
}

describe('topics handlers', () => {
  it('adds, lists, and removes a topic for an owned child', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const added = await new AddTopicHandler().run({ childId: child.id, topic: '  space  ' }, ctx)
    expect(added.topic).toBe('space') // trimmed

    const listed = await new ListTopicsHandler().run({ childId: child.id }, ctx)
    expect(listed.map((t) => t.topic)).toEqual(['space'])

    await new RemoveTopicHandler().run({ childId: child.id, topicId: added.id }, ctx)
    await expect(new ListTopicsHandler().run({ childId: child.id }, ctx)).resolves.toEqual([])
  })

  it('rejects an empty topic', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new AddTopicHandler().run({ childId: child.id, topic: '   ' }, ctx),
    ).rejects.toThrow(ValidationError)
  })

  it('403s a cross-family add', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(
      new AddTopicHandler().run({ childId: child.id, topic: 'space' }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })
})
