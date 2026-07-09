import { describe, expect, it } from 'vitest'

import { generateBlot } from './blot.ts'
import { mulberry32 } from './rng.ts'

const CX = 200
const CY = 150
const R = 60

function extentRatio(points: { x: number; y: number }[]): number {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xExt = Math.max(...xs) - Math.min(...xs)
  const yExt = Math.max(...ys) - Math.min(...ys)
  return xExt / yExt
}

describe('generateBlot', () => {
  it('carries centre and radius through unchanged', () => {
    const b = generateBlot(CX, CY, R, mulberry32(7))
    expect(b.cx).toBe(CX)
    expect(b.cy).toBe(CY)
    expect(b.r).toBe(R)
  })

  it('produces 9–13 outline points', () => {
    for (let seed = 0; seed < 30; seed++) {
      const b = generateBlot(CX, CY, R, mulberry32(seed))
      expect(b.points.length).toBeGreaterThanOrEqual(9)
      expect(b.points.length).toBeLessThanOrEqual(13)
    }
  })

  it('keeps every outline point inside the [0.62r, 1.24r]·anisotropy band', () => {
    // anisotropy scale is 0.82–1.18 per axis, so the distance from centre is
    // bounded by the base radial band times the extreme scale factors.
    const lo = 0.62 * 0.82 * R
    const hi = 1.24 * 1.18 * R
    for (let seed = 0; seed < 30; seed++) {
      const b = generateBlot(CX, CY, R, mulberry32(seed))
      for (const p of b.points) {
        const d = Math.hypot(p.x - CX, p.y - CY)
        expect(d).toBeGreaterThanOrEqual(lo - 1e-9)
        expect(d).toBeLessThanOrEqual(hi + 1e-9)
      }
    }
  })

  it('emits 0–2 satellites within their distance/size ranges', () => {
    for (let seed = 0; seed < 30; seed++) {
      const b = generateBlot(CX, CY, R, mulberry32(seed))
      expect(b.satellites.length).toBeGreaterThanOrEqual(0)
      expect(b.satellites.length).toBeLessThanOrEqual(2)
      for (const s of b.satellites) {
        const d = Math.hypot(s.x - CX, s.y - CY)
        expect(d).toBeGreaterThanOrEqual(1.05 * R - 1e-9)
        expect(d).toBeLessThanOrEqual(1.55 * R + 1e-9)
        expect(s.r).toBeGreaterThanOrEqual(0.05 * R - 1e-9)
        expect(s.r).toBeLessThanOrEqual(0.17 * R + 1e-9)
      }
    }
  })

  // The divergent-thinking quality bar: over a sample of distinct seeds, the
  // generator must exercise its degrees of freedom (proxy for "consecutive
  // shuffles feel different").
  it('exercises its variety degrees of freedom over 40 distinct seeds', () => {
    const N = 40
    const blots = Array.from({ length: N }, (_, i) =>
      generateBlot(CX, CY, R, mulberry32(1000 + i)),
    )

    // 1. point counts span more than one distinct value
    const pointCounts = new Set(blots.map((b) => b.points.length))
    expect(pointCounts.size).toBeGreaterThan(1)

    // 2. satellite counts include both 0 and >0
    const satCounts = blots.map((b) => b.satellites.length)
    expect(satCounts.some((c) => c === 0)).toBe(true)
    expect(satCounts.some((c) => c > 0)).toBe(true)

    // 3. anisotropy is real: x/y extent ratio varies across the sample
    const ratios = blots.map((b) => extentRatio(b.points))
    const spread = Math.max(...ratios) - Math.min(...ratios)
    expect(spread).toBeGreaterThan(0.4)
  })
})
