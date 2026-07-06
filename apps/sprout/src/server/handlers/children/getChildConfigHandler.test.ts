import { describe, expect, it } from 'vitest'

import { PRESET_DEFINITIONS } from '../../domain/presets.ts'
import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { GetChildConfigHandler } from './getChildConfigHandler.ts'

describe('GetChildConfigHandler', () => {
  it('returns the stored sliders and calibration answers', async () => {
    const store = new FakeSproutStore()
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid',
      passwordHash: 'h',
    })
    await store.createPreset({
      childId: child.id,
      name: 'confident-reader',
      ...PRESET_DEFINITIONS['confident-reader'].sliders,
    })
    await store.createCalibrationAnswers(child.id, [
      { questionId: 'death', selectedLevel: 2, customAnswer: null },
    ])
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const config = await new GetChildConfigHandler().run({ childId: child.id }, ctx)
    expect(config.sliders.vocabularyLevel).toBe(3)
    expect(config.calibrationAnswers).toEqual([
      { questionId: 'death', selectedLevel: 2, customAnswer: null },
    ])
  })

  it('falls back to the strictest preset when a child has no preset row', async () => {
    const store = new FakeSproutStore()
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid',
      passwordHash: 'h',
    })
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const config = await new GetChildConfigHandler().run({ childId: child.id }, ctx)
    expect(config.sliders).toEqual(PRESET_DEFINITIONS['early-learner'].sliders)
  })
})
