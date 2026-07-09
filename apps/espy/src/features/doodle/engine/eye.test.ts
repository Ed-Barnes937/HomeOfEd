import { describe, expect, it } from 'vitest'

import { EYE_BASE, makeEye } from './eye.ts'
import { mulberry32 } from './rng.ts'

describe('makeEye', () => {
  it('exposes the default base size', () => {
    expect(EYE_BASE).toBe(12)
  })

  it('places the eye at the given centre', () => {
    const eye = makeEye(40, 55, EYE_BASE, mulberry32(1))
    expect(eye.x).toBe(40)
    expect(eye.y).toBe(55)
  })

  it('sizes within base * [0.85, 1.25) and angles within [0, 2π)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const eye = makeEye(0, 0, EYE_BASE, mulberry32(seed))
      expect(eye.size).toBeGreaterThanOrEqual(EYE_BASE * 0.85)
      expect(eye.size).toBeLessThan(EYE_BASE * 1.25)
      expect(eye.pupilAngle).toBeGreaterThanOrEqual(0)
      expect(eye.pupilAngle).toBeLessThan(Math.PI * 2)
    }
  })
})
