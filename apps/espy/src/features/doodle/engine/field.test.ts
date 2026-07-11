import { describe, expect, it } from 'vitest'

import { generateField } from './field.ts'
import { blobCount } from './layout.ts'
import { mulberry32 } from './rng.ts'
import type { ViewBox } from './types.ts'

const DESKTOP: ViewBox = { width: 1550, height: 760 }
const PHONE: ViewBox = { width: 334, height: 562 } // iPhone-14 canvas card

describe('generateField', () => {
  it('floors a phone-sized viewBox to a small varied field, first blot centre-ish', () => {
    const target = blobCount(PHONE.width, PHONE.height)
    expect(target).toBe(3) // small-canvas floor, not a lone blot
    for (let seed = 0; seed < 20; seed++) {
      const blots = generateField(PHONE, mulberry32(seed))
      expect(blots.length).toBe(target)
      const b = blots[0]!
      // centre-ish: within the ±0.06 jitter window of the middle
      expect(Math.abs(b.cx - PHONE.width / 2)).toBeLessThanOrEqual(
        0.06 * PHONE.width + 1e-9,
      )
      expect(Math.abs(b.cy - PHONE.height / 2)).toBeLessThanOrEqual(
        0.06 * PHONE.height + 1e-9,
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

  it('anchors the first blot near centre for a multi-blot field', () => {
    expect(blobCount(DESKTOP.width, DESKTOP.height)).toBeGreaterThan(1)
    for (let seed = 0; seed < 20; seed++) {
      const first = generateField(DESKTOP, mulberry32(seed))[0]!
      // Same ±0.06 window as the single-blot case.
      expect(Math.abs(first.cx - DESKTOP.width / 2)).toBeLessThanOrEqual(0.06 * DESKTOP.width + 1e-9)
      expect(Math.abs(first.cy - DESKTOP.height / 2)).toBeLessThanOrEqual(0.06 * DESKTOP.height + 1e-9)
    }
  })

  it('spreads a multi-blot field across the canvas (best-candidate, not clumped)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const blots = generateField(DESKTOP, mulberry32(seed))
      const xs = blots.map((b) => b.cx)
      const ys = blots.map((b) => b.cy)
      const xSpan = Math.max(...xs) - Math.min(...xs)
      const ySpan = Math.max(...ys) - Math.min(...ys)
      expect(xSpan).toBeGreaterThan(0.45 * DESKTOP.width)
      expect(ySpan).toBeGreaterThan(0.3 * DESKTOP.height)
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
