import { describe, expect, it } from 'vitest'

import { BOTTLES, drawnHeightMm, type ShapeId } from './bottles.ts'
import { compilePotion } from './compile.ts'
import { BASE_LINE, drawnHeightFraction, heightFraction, TALLEST_MM } from './framing.ts'
import { potionSchema } from './potionSchema.ts'
import { defaults } from '../engine/schema.ts'

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
    const longest = SHAPES.map((shape) => ({ shape, mm: drawnHeightMm({ shape, neck: 1 }) }))
    const tallest = Math.max(...longest.map((l) => l.mm))
    expect(TALLEST_MM).toBe(tallest)
    const full = SHAPES.flatMap((shape) => [0, 0.5, 1].map((neck) => ({ shape, neck }))).filter(
      (p) => drawnHeightFraction(p) === 1,
    )
    expect(full).toEqual(
      longest.filter((l) => l.mm === tallest).map((l) => ({ shape: l.shape, neck: 1 })),
    )
  })

  it('refuses a compiled spec, which has no neck slider to read', () => {
    const spec = compilePotion(defaults(potionSchema))
    // @ts-expect-error a PotionSpec is not a set of params
    drawnHeightFraction(spec)
  })
})

describe('heightFraction', () => {
  it('is the spec height over the tallest, the same as the params give', () => {
    for (const shape of SHAPES)
      for (const neck of [0, 0.4, 1]) {
        const p = { ...defaults(potionSchema), shape, neck }
        expect(heightFraction(compilePotion(p))).toBe(drawnHeightFraction(p))
      }
  })

  it('has a base line inside the stage', () => {
    expect(BASE_LINE).toBeGreaterThan(0)
    expect(BASE_LINE).toBeLessThan(1)
  })
})
