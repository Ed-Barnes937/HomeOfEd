import { describe, expect, it } from 'vitest'

import { generateField } from './field.ts'
import { blobCount } from './layout.ts'
import { mulberry32 } from './rng.ts'
import type { ViewBox } from './types.ts'

const DESKTOP: ViewBox = { width: 1550, height: 760 }
const SINGLE: ViewBox = { width: 400, height: 520 }

describe('generateField', () => {
  it('lays exactly one centre-ish blot for a single-blot viewBox', () => {
    expect(blobCount(SINGLE.width, SINGLE.height)).toBe(1)
    for (let seed = 0; seed < 20; seed++) {
      const blots = generateField(SINGLE, mulberry32(seed))
      expect(blots.length).toBe(1)
      const b = blots[0]!
      // centre-ish: within the ±0.06 jitter window of the middle
      expect(Math.abs(b.cx - SINGLE.width / 2)).toBeLessThanOrEqual(
        0.06 * SINGLE.width + 1e-9,
      )
      expect(Math.abs(b.cy - SINGLE.height / 2)).toBeLessThanOrEqual(
        0.06 * SINGLE.height + 1e-9,
      )
    }
  })

  it('never overlaps: every pair satisfies the gap-factor invariant', () => {
    for (let seed = 0; seed < 20; seed++) {
      const blots = generateField(DESKTOP, mulberry32(seed))
      for (let i = 0; i < blots.length; i++) {
        for (let j = i + 1; j < blots.length; j++) {
          const a = blots[i]!
          const b = blots[j]!
          const d = Math.hypot(a.cx - b.cx, a.cy - b.cy)
          expect(d).toBeGreaterThan((a.r + b.r) * 1.15)
        }
      }
    }
  })

  it('reaches the target blobCount for a normal desktop viewBox', () => {
    const target = blobCount(DESKTOP.width, DESKTOP.height)
    // Placement is rejection-sampled; assert it can reach the target for a
    // roomy desktop field (checked across seeds — it should always fit here).
    for (let seed = 0; seed < 20; seed++) {
      const blots = generateField(DESKTOP, mulberry32(seed))
      expect(blots.length).toBe(target)
    }
  })

  it('generates resolved blot geometry (points + satellites)', () => {
    const blots = generateField(DESKTOP, mulberry32(3))
    for (const b of blots) {
      expect(b.points.length).toBeGreaterThanOrEqual(9)
      expect(Array.isArray(b.satellites)).toBe(true)
    }
  })
})
