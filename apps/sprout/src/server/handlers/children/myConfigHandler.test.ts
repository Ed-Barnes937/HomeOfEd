import { PRESET_DEFINITIONS } from '@hoe/sprout-shared'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx } from '../../testing/makeCtx.ts'
import { MyConfigHandler } from './myConfigHandler.ts'

describe('MyConfigHandler', () => {
  it('returns the stored preset name alongside the sliders', async () => {
    const store = new FakeSproutStore()
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid',
      passwordHash: 'h',
    })
    await store.createPreset({
      childId: child.id,
      name: 'independent-explorer',
      ...PRESET_DEFINITIONS['independent-explorer'].sliders,
    })
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    const config = await new MyConfigHandler().run(undefined, ctx)
    expect(config.presetName).toBe('independent-explorer')
    expect(config.sliders).toEqual(PRESET_DEFINITIONS['independent-explorer'].sliders)
  })

  it('falls back to early-learner when the preset row carries an unknown name', async () => {
    const store = new FakeSproutStore()
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid',
      passwordHash: 'h',
    })
    await store.createPreset({
      childId: child.id,
      name: 'not-a-real-preset',
      ...PRESET_DEFINITIONS['independent-explorer'].sliders,
    })
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    const config = await new MyConfigHandler().run(undefined, ctx)
    expect(config.presetName).toBe('early-learner')
  })

  it('falls back to early-learner (safe-by-default) when a child has no preset row', async () => {
    const store = new FakeSproutStore()
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid',
      passwordHash: 'h',
    })
    const ctx = makeCtx({ store, user: childUser(child.id, 'p1') })

    const config = await new MyConfigHandler().run(undefined, ctx)
    expect(config.presetName).toBe('early-learner')
    expect(config.sliders).toEqual(PRESET_DEFINITIONS['early-learner'].sliders)
  })
})
