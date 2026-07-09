import { describe, expect, it } from 'vitest'

import { type Archetype, generateBlot, pickArchetype, SHAPES } from './blot.ts'
import { mulberry32 } from './rng.ts'
import type { Point } from './types.ts'

const CX = 200
const CY = 150
const R = 60

const ARCHETYPES = Object.keys(SHAPES) as Archetype[]

/** Ratio of the larger to smaller principal-axis spread — rotation-invariant
 * "how elongated is this point cloud" (1 = round, big = streaky). */
function elongation(points: Point[]): number {
  const n = points.length
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  let cxx = 0
  let cyy = 0
  let cxy = 0
  for (const p of points) {
    cxx += (p.x - mx) ** 2
    cyy += (p.y - my) ** 2
    cxy += (p.x - mx) * (p.y - my)
  }
  const mean = (cxx + cyy) / 2
  const diff = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy ** 2)
  const lambdaMax = mean + diff
  const lambdaMin = mean - diff
  return lambdaMin <= 0 ? Infinity : lambdaMax / lambdaMin
}

describe('generateBlot', () => {
  it('carries centre and radius through unchanged', () => {
    const b = generateBlot(CX, CY, R, mulberry32(7))
    expect(b.cx).toBe(CX)
    expect(b.cy).toBe(CY)
    expect(b.r).toBe(R)
  })

  describe.each(ARCHETYPES)('archetype %s', (archetype) => {
    const knobs = SHAPES[archetype]

    it('respects its configured outline-point range', () => {
      for (let seed = 0; seed < 30; seed++) {
        const b = generateBlot(CX, CY, R, mulberry32(seed), archetype)
        expect(b.points.length).toBeGreaterThanOrEqual(knobs.points[0])
        expect(b.points.length).toBeLessThanOrEqual(knobs.points[1])
      }
    })

    it('respects its configured satellite/lobe count', () => {
      const lobeMax = knobs.lobes?.count[1] ?? 0
      const lobeMin = knobs.lobes?.count[0] ?? 0
      for (let seed = 0; seed < 30; seed++) {
        const b = generateBlot(CX, CY, R, mulberry32(seed), archetype)
        expect(b.satellites.length).toBeGreaterThanOrEqual(knobs.satellites.count[0] + lobeMin)
        expect(b.satellites.length).toBeLessThanOrEqual(knobs.satellites.count[1] + lobeMax)
      }
    })

    it('keeps outline points within the radial × anisotropy band', () => {
      const scaleLo = Math.min(knobs.scaleX[0], knobs.scaleY[0])
      const scaleHi = Math.max(knobs.scaleX[1], knobs.scaleY[1])
      const lo = knobs.radial[0] * scaleLo * R
      const hi = knobs.radial[1] * scaleHi * R
      for (let seed = 0; seed < 30; seed++) {
        const b = generateBlot(CX, CY, R, mulberry32(seed), archetype)
        for (const p of b.points) {
          const d = Math.hypot(p.x - CX, p.y - CY)
          expect(d).toBeGreaterThanOrEqual(lo - 1e-9)
          expect(d).toBeLessThanOrEqual(hi + 1e-9)
        }
      }
    })
  })

  it('makes streaks markedly more elongated than blobs on average', () => {
    const N = 30
    const avg = (a: Archetype): number => {
      const vals = Array.from({ length: N }, (_, i) =>
        elongation(generateBlot(CX, CY, R, mulberry32(500 + i), a).points),
      )
      return vals.reduce((s, v) => s + v, 0) / N
    }
    expect(avg('streak')).toBeGreaterThan(avg('blob') * 2)
  })

  it('gives splatter far more droplets than a plain blob', () => {
    const N = 30
    const avgSats = (a: Archetype): number => {
      const counts = Array.from({ length: N }, (_, i) =>
        generateBlot(CX, CY, R, mulberry32(700 + i), a).satellites.length,
      )
      return counts.reduce((s, v) => s + v, 0) / N
    }
    expect(avgSats('splatter')).toBeGreaterThan(avgSats('blob') + 2)
  })

  // The divergent-thinking quality bar: over a sample of auto-picked blots the
  // generator must exercise its degrees of freedom (proxy for "consecutive
  // shuffles feel drastically different").
  it('exercises its variety degrees of freedom over 40 distinct seeds', () => {
    const N = 40
    const blots = Array.from({ length: N }, (_, i) => generateBlot(CX, CY, R, mulberry32(1000 + i)))

    // 1. point counts span more than one distinct value
    expect(new Set(blots.map((b) => b.points.length)).size).toBeGreaterThan(1)

    // 2. satellite counts include both few (≤2) and many (≥4)
    const satCounts = blots.map((b) => b.satellites.length)
    expect(satCounts.some((c) => c <= 2)).toBe(true)
    expect(satCounts.some((c) => c >= 4)).toBe(true)

    // 3. elongation varies: near-round and clearly-streaky both appear
    const ratios = blots.map((b) => elongation(b.points))
    expect(Math.min(...ratios)).toBeLessThan(1.6)
    expect(Math.max(...ratios)).toBeGreaterThan(2.5)
  })
})

describe('pickArchetype', () => {
  it('returns every archetype over enough draws', () => {
    const seen = new Set<Archetype>()
    for (let seed = 0; seed < 200; seed++) seen.add(pickArchetype(mulberry32(seed)))
    expect(seen).toEqual(new Set(ARCHETYPES))
  })
})
