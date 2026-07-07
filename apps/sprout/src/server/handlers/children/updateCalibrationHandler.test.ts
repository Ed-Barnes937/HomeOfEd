import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { UpdateCalibrationHandler } from './updateCalibrationHandler.ts'

describe('UpdateCalibrationHandler', () => {
  it('replaces the calibration set wholesale', async () => {
    const store = new FakeSproutStore()
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid',
      passwordHash: 'h',
    })
    await store.createCalibrationAnswers(child.id, [
      { questionId: 'old', selectedLevel: 1, customAnswer: null },
    ])
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new UpdateCalibrationHandler().run(
      {
        childId: child.id,
        answers: [
          { questionId: 'babies', selectedLevel: 2, customAnswer: null },
          { questionId: 'death', selectedLevel: null, customAnswer: 'my own words' },
        ],
      },
      ctx,
    )

    expect(result.calibrationAnswers).toHaveLength(2)
    expect(result.calibrationAnswers.map((a) => a.questionId).sort()).toEqual(['babies', 'death'])
    // The old answer was replaced, not merged.
    const stored = await store.listCalibrationAnswers(child.id)
    expect(stored.some((a) => a.questionId === 'old')).toBe(false)
  })
})
