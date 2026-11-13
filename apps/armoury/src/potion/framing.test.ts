import { describe, expect, it } from 'vitest'

import { BOTTLES, type ShapeId } from './bottles.ts'
import { BASE_LINE, drawnHeightFraction, TALLEST_MM } from './framing.ts'

const SHAPES = Object.keys(BOTTLES) as ShapeId[]

describe('drawnHeightFraction', () => {
  it('is in (0, 1] for every shape and neck', () => {
    for (const shape of SHAPES)
      for (const neck of [0, 0.5, 1]) {
        const f = drawnHeightFraction({ shape, neck })
        expect(f).toBeGreaterThan(0)
        expect(f).toBeLessThanOrEqual(1)
      }
  })

  it('is 1 only for the tallest bottle at its longest neck', () => {
    const full = SHAPES.flatMap((shape) => [0, 0.5, 1].map((neck) => ({ shape, neck }))).filter(
      (p) => drawnHeightFraction(p) === 1,
    )
    expect(full).toEqual([{ shape: 'tall', neck: 1 }])
    expect(TALLEST_MM).toBe(213)
  })

  it('draws a round flask with a short neck at about 0.6', () => {
    expect(drawnHeightFraction({ shape: 'round', neck: 0 })).toBeCloseTo(0.6, 1)
  })

  it('has a base line inside the stage', () => {
    expect(BASE_LINE).toBeGreaterThan(0)
    expect(BASE_LINE).toBeLessThan(1)
  })
})
