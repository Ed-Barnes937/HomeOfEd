import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { BOTTLES, type ShapeId } from './bottles.ts'
import { compilePotion, type PotionSpec } from './compile.ts'
import type { IngredientId } from './ingredients.ts'
import { potionOutline } from './outline.ts'
import type { StopperId } from './potionSchema.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'
import { BASE_MM, bottleProfile, uprightLevels } from './profile.ts'

const SHAPES = Object.keys(BOTTLES) as ShapeId[]
const THREE: IngredientId[] = ['moonmilk', 'rosehip', 'starpetal']

const specOf = (
  shape: ShapeId,
  neck: number,
  pours = THREE,
  stopper: StopperId = 'cork',
): PotionSpec =>
  compilePotion(normalise(potionSchema, { ...withPours(pours), shape, neck, stopper }))

const CATALOGUE = SHAPES.flatMap((shape) =>
  [0, 0.5, 1].map((neck) => {
    const spec = specOf(shape, neck)
    return { name: `${shape} neck ${neck}`, spec, outline: potionOutline(spec) }
  }),
)

type Pt = [number, number]

/** The widest x where a horizontal line at y crosses a closed polygon. */
function halfWidthAt(poly: Pt[], y: number): number {
  let best = -Infinity
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]!
    const [x1, y1] = poly[(i + 1) % poly.length]!
    if ((y0 - y) * (y1 - y) > 0 || y0 === y1) continue
    best = Math.max(best, x0 + ((x1 - x0) * (y - y0)) / (y1 - y0))
  }
  return best
}

describe('potionOutline', () => {
  it.each(CATALOGUE)('$name: the glass half-widths follow outerR', ({ spec, outline }) => {
    const profile = bottleProfile(spec)
    for (let y = 0.5; y < profile.lipZ - 0.5; y += 0.7) {
      expect(Math.abs(halfWidthAt(outline.glass, y) - profile.outerR(y))).toBeLessThan(0.15)
    }
    expect(outline.widthMm).toBe(profile.widthMm)
    expect(outline.heightMm).toBe(spec.heightMm)
  })

  it.each(CATALOGUE)(
    '$name: the glass is mirrored about the axis and stands on y = 0',
    ({ outline }) => {
      const key = ([x, y]: Pt) => `${Math.abs(x).toFixed(6)},${y.toFixed(6)}`
      const right = outline.glass
        .filter(([x]) => x > 0)
        .map(key)
        .sort()
      const left = outline.glass
        .filter(([x]) => x < 0)
        .map(key)
        .sort()
      expect(left).toEqual(right)
      expect(Math.min(...outline.glass.map(([, y]) => y))).toBe(0)
    },
  )

  it.each(CATALOGUE)(
    '$name: one band per pour, in order, inside the cavity',
    ({ spec, outline }) => {
      const profile = bottleProfile(spec)
      const levels = uprightLevels(spec)
      expect(outline.bands.map((b) => b.colour)).toEqual(spec.layers.map((l) => l.colour))
      outline.bands.forEach((band, i) => {
        const lo = i === 0 ? BASE_MM : levels[i - 1]!
        const ys = band.points.map(([, y]) => y)
        expect(Math.min(...ys)).toBeCloseTo(lo, 6)
        expect(Math.max(...ys)).toBeCloseTo(levels[i]!, 6)
        for (const [x, y] of band.points) {
          expect(Math.abs(x)).toBeLessThanOrEqual(profile.innerR(y) + 1e-9)
        }
      })
    },
  )

  it('draws no bands in an empty bottle and fewer in a short one', () => {
    expect(potionOutline(specOf('round', 0.5, [])).bands).toEqual([])
    expect(potionOutline(specOf('round', 0.5, THREE.slice(0, 2))).bands).toHaveLength(2)
  })

  it.each(['cork', 'glass', 'wax'] as const)(
    'draws the %s stopper above the lip, under the drawn height',
    (stopper) => {
      const spec = specOf('teardrop', 0.5, THREE, stopper)
      const { stopper: shape } = potionOutline(spec)
      const profile = bottleProfile(spec)
      const top = Math.max(...shape.map(([, y]) => y))
      expect(top).toBeGreaterThan(profile.lipZ + (stopper === 'wax' ? 2.5 : 5))
      expect(top).toBeLessThanOrEqual(spec.heightMm + 1e-9)
      if (stopper === 'glass') expect(top).toBeCloseTo(spec.heightMm, 6)
      const { neckRadiusMm, lipMm } = BOTTLES.teardrop
      if (stopper === 'wax')
        expect(halfWidthAt(shape, profile.lipZ - 1)).toBeGreaterThan(neckRadiusMm + lipMm)
      else expect(halfWidthAt(shape, profile.lipZ - 1)).toBeLessThanOrEqual(profile.stopperSeat.r)
    },
  )

  it.each(['./profile.ts', './outline.ts'])(
    '%s imports only light modules, so it can ship in the main chunk',
    (file) => {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])
      const light = [
        '../sword/curve.ts',
        './bottles.ts',
        './compile.ts',
        './potionSchema.ts',
        './profile.ts',
      ]
      expect(imports.filter((i) => !light.includes(i!))).toEqual([])
    },
  )
})
