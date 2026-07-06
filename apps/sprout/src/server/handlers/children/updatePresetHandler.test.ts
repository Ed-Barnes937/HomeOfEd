import { ForbiddenError, NotFoundError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { PRESET_DEFINITIONS } from '../../domain/presets.ts'
import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { UpdatePresetHandler } from './updatePresetHandler.ts'

async function seedChildWithPreset(store: FakeSproutStore, parentId: string) {
  const child = await store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: 'h',
  })
  await store.createPreset({
    childId: child.id,
    name: 'early-learner',
    ...PRESET_DEFINITIONS['early-learner'].sliders,
  })
  return child
}

describe('UpdatePresetHandler', () => {
  it('patches the sliders for an owned child', async () => {
    const store = new FakeSproutStore()
    const child = await seedChildWithPreset(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new UpdatePresetHandler().run(
      { childId: child.id, sliders: { vocabularyLevel: 4, topicAccess: 2 } },
      ctx,
    )

    expect(result.sliders.vocabularyLevel).toBe(4)
    expect(result.sliders.topicAccess).toBe(2)
    expect(result.sliders.responseDepth).toBe(1) // untouched
  })

  it('404s when the child has no preset row', async () => {
    const store = new FakeSproutStore()
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid',
      passwordHash: 'h',
    })
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new UpdatePresetHandler().run({ childId: child.id, sliders: { vocabularyLevel: 4 } }, ctx),
    ).rejects.toThrow(NotFoundError)
  })

  it('403s a cross-family write', async () => {
    const store = new FakeSproutStore()
    const child = await seedChildWithPreset(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(
      new UpdatePresetHandler().run({ childId: child.id, sliders: { vocabularyLevel: 4 } }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })
})
