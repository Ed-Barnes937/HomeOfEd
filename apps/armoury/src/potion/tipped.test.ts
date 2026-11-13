import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { BOTTLES, type ShapeId } from './bottles.ts'
import { compilePotion, type PotionSpec } from './compile.ts'
import type { IngredientId } from './ingredients.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'
import { BASE_MM, bottleProfile, type BottleProfile, uprightLevels } from './profile.ts'
import { levelsAt, levelTable } from './tipped.ts'

const SHAPES = Object.keys(BOTTLES) as ShapeId[]
const THREE: IngredientId[] = ['moonmilk', 'rosehip', 'starpetal']
const RAD = Math.PI / 180

const specOf = (shape: ShapeId, neck: number, pours = THREE): PotionSpec =>
  compilePotion(normalise(potionSchema, { ...withPours(pours), shape, neck }))

const CATALOGUE = SHAPES.flatMap((shape) =>
  [0, 0.5, 1].map((neck) => {
    const spec = specOf(shape, neck)
    return {
      name: `${shape} neck ${neck}`,
      spec,
      profile: bottleProfile(spec),
      table: levelTable(spec),
    }
  }),
)

/**
 * The cavity's volume between two heights along up, tilted by t, by quadrature: slices
 * along the axis, Simpson's across each slice's chord.
 */
function bandVolume(profile: BottleProfile, t: number, lo: number, hi: number): number {
  const s = Math.sin(t)
  const c = Math.cos(t)
  const dz = 0.2
  const n = 32
  let v = 0
  for (let z = BASE_MM + dz / 2; z < profile.cavityTopZ; z += dz) {
    const r = profile.innerR(z)
    let a = -r
    let b = r
    if (s < 1e-9) {
      if (z * c <= lo || z * c > hi) continue
    } else {
      a = Math.max(a, (lo - z * c) / s)
      b = Math.min(b, (hi - z * c) / s)
    }
    if (b <= a) continue
    const h = (b - a) / n
    const chord = (x: number) => 2 * Math.sqrt(Math.max(0, r * r - x * x))
    let sum = chord(a) + chord(b)
    for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * chord(a + i * h)
    v += ((sum * h) / 3) * dz
  }
  return v
}

describe('levelTable', () => {
  it('has a row every 5 degrees from upright to on its side, one level per pour', () => {
    const { table } = CATALOGUE[0]!
    expect(table.stepDeg).toBe(5)
    expect(table.levels).toHaveLength(19)
    for (const row of table.levels) expect(row).toHaveLength(3)
    expect(levelTable(specOf('round', 0.5, THREE.slice(0, 2))).levels[3]).toHaveLength(2)
    expect(levelTable(specOf('round', 0.5, [])).levels[3]).toEqual([])
  })

  it.each(CATALOGUE)('$name: upright equals uprightLevels', ({ spec, table }) => {
    const upright = uprightLevels(spec)
    table.levels[0]!.forEach((h, i) => expect(h).toBeCloseTo(upright[i]!, 6))
    levelsAt(table, 0).forEach((h, i) => expect(h).toBeCloseTo(upright[i]!, 6))
  })

  it.each(CATALOGUE)('$name: levels rise with fill at every tilt', ({ table }) => {
    for (const row of table.levels)
      for (let i = 1; i < row.length; i++) expect(row[i]).toBeGreaterThan(row[i - 1]!)
  })

  it.each(CATALOGUE)('$name: every band keeps its volume as it tips', ({ profile, table }) => {
    const quarter = profile.cavityVolume(profile.fullZ) / 3
    for (const [deg, bound] of [
      [0, 0.02],
      [15, 0.02],
      [30, 0.02],
      [37, 0.02],
      [45, 0.02],
      [52, 0.02],
      [60, 0.02],
      [75, 0.05],
      [90, 0.05],
    ] as const) {
      const t = deg * RAD
      const levels = levelsAt(table, t)
      // Upright the first band starts at the floor; tipped, below the lowest point of the cavity.
      let below = -1e3
      for (const top of levels) {
        const v = bandVolume(profile, t, below, top)
        expect(Math.abs(v / quarter - 1), `${deg} degrees`).toBeLessThan(bound)
        below = top
      }
    }
  })
})

describe('levelsAt', () => {
  it('interpolates between rows and holds at the ends', () => {
    const { table } = CATALOGUE[4]!
    const mid = levelsAt(table, 7.5 * RAD)
    mid.forEach((h, i) =>
      expect(h).toBeCloseTo((table.levels[1]![i]! + table.levels[2]![i]!) / 2, 9),
    )
    const plus = levelsAt(table, 20 * RAD)
    levelsAt(table, -20 * RAD).forEach((h, i) => expect(h).toBeCloseTo(plus[i]!, 9))
    levelsAt(table, 120 * RAD).forEach((h, i) => expect(h).toBeCloseTo(table.levels[18]![i]!, 9))
  })
})
