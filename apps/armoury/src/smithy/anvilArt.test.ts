import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { compileSword } from '../sword/compile.ts'
import { drawnFraction } from '../sword/framing.ts'
import { swordSchema } from '../sword/swordSchema.ts'
import { ANVIL_H, ANVIL_W, swordOnAnvil } from './anvilArt.ts'

const xsAndYs = (d: string) => {
  const nums = [...d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]))
  return {
    xs: nums.filter((_, i) => i % 2 === 0),
    ys: nums.filter((_, i) => i % 2 === 1),
  }
}

describe('swordOnAnvil', () => {
  it('lays the outline where the stage draws the sword: centred, at its drawn length', () => {
    for (const family of ['dagger', 'knight', 'greatsword'] as const) {
      const spec = compileSword(normalise(swordSchema, { family }))
      const { d, gripX } = swordOnAnvil(spec)
      const { xs, ys } = xsAndYs(d)
      const drawn = drawnFraction(spec.lengthMm) * 0.72 * 1.3 * ANVIL_W
      expect(Math.min(...xs)).toBeCloseTo(ANVIL_W / 2 - drawn / 2, 0)
      expect(Math.max(...xs)).toBeCloseTo(ANVIL_W / 2 + drawn / 2, 0)
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(ANVIL_H / 2, -1)
      expect(gripX).toBeGreaterThan(Math.min(...xs) / ANVIL_W)
      expect(gripX).toBeLessThan(0.5)
    }
  })
})
