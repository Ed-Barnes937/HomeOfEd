import { describe, expect, it } from 'vitest'

import { DEFAULT_PARAMS } from '../engine/params.ts'
import { streakLength } from './renderer.ts'

describe('streakLength', () => {
  it('is the reference formula 6 + trail*46 + speed*3', () => {
    expect(streakLength(DEFAULT_PARAMS)).toBeCloseTo(6 + 0.42 * 46 + 2.6 * 3)
    expect(streakLength({ ...DEFAULT_PARAMS, trail: 0, speed: 0.5 })).toBeCloseTo(7.5)
    expect(streakLength({ ...DEFAULT_PARAMS, trail: 1, speed: 6 })).toBeCloseTo(70)
  })
})
