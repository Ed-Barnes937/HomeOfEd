import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { compileSword } from './compile.ts'
import { FAMILIES, type Family } from './families.ts'
import { drawnFraction, LONGEST_SWORD_MM, SHORTEST_SWORD_MM } from './framing.ts'
import { swordSchema } from './swordSchema.ts'

describe('drawnFraction', () => {
  it('runs from 0.55 at the shortest sword to 1.0 at the longest', () => {
    expect(drawnFraction(SHORTEST_SWORD_MM)).toBeCloseTo(0.55, 9)
    expect(drawnFraction(LONGEST_SWORD_MM)).toBeCloseTo(1, 9)
    expect(drawnFraction(SHORTEST_SWORD_MM - 100)).toBeCloseTo(0.55, 9)
    expect(drawnFraction(LONGEST_SWORD_MM + 100)).toBeCloseTo(1, 9)
  })

  it('rises monotonically, compressed toward the long end', () => {
    let last = 0
    for (let mm = SHORTEST_SWORD_MM; mm <= LONGEST_SWORD_MM; mm += 10) {
      const f = drawnFraction(mm)
      expect(f).toBeGreaterThan(last)
      last = f
    }
    const mid = (SHORTEST_SWORD_MM + LONGEST_SWORD_MM) / 2
    expect(drawnFraction(mid)).toBeGreaterThan(0.775)
  })

  it("holds every Kind's shortest and longest sword between its two ends", () => {
    for (const family of Object.keys(FAMILIES) as Family[]) {
      const f = FAMILIES[family]
      for (const v of [0, 1])
        for (const guard of f.guard)
          for (const pommel of f.pommel) {
            const p = normalise(swordSchema, {
              family,
              guard,
              pommel,
              bladeLength: v,
              bladeWidth: v,
              gripLength: v,
              pommelSize: v,
            })
            const { lengthMm } = compileSword(p)
            expect(lengthMm).toBeGreaterThanOrEqual(SHORTEST_SWORD_MM)
            expect(lengthMm).toBeLessThanOrEqual(LONGEST_SWORD_MM)
          }
    }
  })
})
