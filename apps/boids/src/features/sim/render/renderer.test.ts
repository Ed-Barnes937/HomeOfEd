import { describe, expect, it } from 'vitest'

import { DEFAULT_PARAMS } from '../engine/params.ts'
import { beaconRingAlpha, streakLength } from './renderer.ts'

describe('streakLength', () => {
  it('is the reference formula 6 + trail*46 + speed*3', () => {
    expect(streakLength(DEFAULT_PARAMS)).toBeCloseTo(6 + 0.42 * 46 + 2.6 * 3)
    expect(streakLength({ ...DEFAULT_PARAMS, trail: 0, speed: 0.5 })).toBeCloseTo(7.5)
    expect(streakLength({ ...DEFAULT_PARAMS, trail: 1, speed: 6 })).toBeCloseTo(70)
  })
})

describe('beaconRingAlpha', () => {
  it('stays near the faint floor for a weak beacon', () => {
    expect(beaconRingAlpha(0.05)).toBeCloseTo(0.05 + 0.15 * (0.05 / 3))
  })

  it('caps at 0.2 at full strength', () => {
    expect(beaconRingAlpha(3)).toBeCloseTo(0.2)
  })

  it('is sign-independent', () => {
    expect(beaconRingAlpha(-3)).toBeCloseTo(beaconRingAlpha(3))
    expect(beaconRingAlpha(-1.5)).toBeCloseTo(beaconRingAlpha(1.5))
  })
})
