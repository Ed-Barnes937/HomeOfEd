import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { BOTTLES, type ShapeId } from './bottles.ts'
import { compilePotion, type PotionSpec } from './compile.ts'
import { TALLEST_MM } from './framing.ts'
import type { IngredientId } from './ingredients.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'
import { BASE_MM, bottleProfile, type BottleProfile, uprightLevels, WALL_MM } from './profile.ts'

const SHAPES = Object.keys(BOTTLES) as ShapeId[]
const FOUR: IngredientId[] = ['moonmilk', 'rosehip', 'starpetal', 'bluebell']

const specOf = (shape: ShapeId, neck: number, pours: IngredientId[] = FOUR): PotionSpec =>
  compilePotion(normalise(potionSchema, { ...withPours(pours), shape, neck }))

const CATALOGUE = SHAPES.flatMap((shape) =>
  [0, 0.5, 1].map((neck) => {
    const spec = specOf(shape, neck)
    return { name: `${shape} neck ${neck}`, spec, profile: bottleProfile(spec) }
  }),
)

const steps = (from: number, to: number, step: number) => {
  const out: number[] = []
  for (let z = from; z < to; z += step) out.push(z)
  out.push(to)
  return out
}

function distanceToPolyline(p: { r: number; z: number }, line: { r: number; z: number }[]) {
  let best = Infinity
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!
    const b = line[i]!
    const dr = b.r - a.r
    const dz = b.z - a.z
    const len2 = dr * dr + dz * dz
    const t = len2 ? Math.max(0, Math.min(1, ((p.r - a.r) * dr + (p.z - a.z) * dz) / len2)) : 0
    best = Math.min(best, Math.hypot(a.r + t * dr - p.r, a.z + t * dz - p.z))
  }
  return best
}

/** The cavity's volume by an independent rule: Simpson's over pi r^2, fine steps. */
function simpsonVolume(profile: BottleProfile, from: number, to: number): number {
  const n = 2 * Math.ceil((to - from) / 0.05)
  const h = (to - from) / n
  const f = (z: number) => Math.PI * profile.innerR(z) ** 2
  let s = f(from) + f(to)
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(from + i * h)
  return (s * h) / 3
}

describe('the bottle rows', () => {
  it('end the body at the neck: the last point is at the top of the body, at the neck radius', () => {
    for (const s of SHAPES) {
      const row = BOTTLES[s]
      expect(row.body.at(-1)).toEqual([1, row.neckRadiusMm])
      expect(row.fullAt).toBeGreaterThan(0.5)
      expect(row.fullAt).toBeLessThan(1)
    }
  })
})

describe('bottleProfile', () => {
  it.each(CATALOGUE)(
    '$name: outer radius positive and continuous from foot to lip',
    ({ profile }) => {
      let last = profile.outerR(0)
      for (const z of steps(0, profile.lipZ, 0.05)) {
        const r = profile.outerR(z)
        expect(r).toBeGreaterThan(0)
        expect(Math.abs(r - last)).toBeLessThan(1)
        last = r
      }
    },
  )

  it.each(CATALOGUE)(
    '$name: inner radius positive, continuous, inside the outer by the wall',
    ({ profile }) => {
      let last = profile.innerR(BASE_MM)
      for (const z of steps(BASE_MM, profile.cavityTopZ, 0.05)) {
        const r = profile.innerR(z)
        expect(r).toBeGreaterThan(0)
        expect(Math.abs(r - last)).toBeLessThan(1)
        expect(profile.outerR(z) - r).toBeGreaterThanOrEqual(WALL_MM - 0.02)
        last = r
      }
    },
  )

  it.each(CATALOGUE)('$name: the wall is the wall thick along its normal', ({ profile }) => {
    const outer = steps(0, profile.lipZ - 5, 0.05).map((z) => ({ r: profile.outerR(z), z }))
    const inner = profile.glass.filter(
      (p) => p.z > BASE_MM + 3 && p.z < profile.shoulderZ - 3 && p.nr < 0,
    )
    for (const p of inner) {
      const d = distanceToPolyline(p, outer)
      expect(d).toBeGreaterThan(WALL_MM - 0.05)
      expect(d).toBeLessThan(WALL_MM + 0.1)
    }
  })

  it.each(CATALOGUE)(
    '$name: body ends at the neck; full is under it; the seat is the lip',
    ({ spec, profile }) => {
      expect(profile.shoulderZ).toBe(spec.bodyHeightMm)
      expect(profile.fullZ).toBeLessThan(profile.shoulderZ)
      expect(profile.fullZ).toBeCloseTo(BOTTLES[spec.shape].fullAt * spec.bodyHeightMm, 6)
      expect(profile.lipZ).toBeCloseTo(spec.bodyHeightMm + spec.neckMm, 6)
      expect(profile.stopperSeat.z).toBe(profile.lipZ)
      expect(profile.stopperSeat.r).toBeCloseTo(BOTTLES[spec.shape].neckRadiusMm - WALL_MM, 6)
      expect(profile.cavityTopZ).toBeCloseTo(profile.lipZ - profile.stopperSeat.depthMm, 6)
      expect(profile.cavityTopZ).toBeGreaterThan(profile.fullZ)
      expect(profile.heightMm).toBe(spec.heightMm)
      expect(profile.heightMm).toBeLessThanOrEqual(TALLEST_MM)
    },
  )

  it.each(CATALOGUE)('$name: widthMm is the widest outer diameter', ({ profile }) => {
    const widest = Math.max(...steps(0, profile.lipZ, 0.1).map((z) => profile.outerR(z)))
    expect(profile.widthMm).toBeCloseTo(2 * widest, 1)
  })

  it.each(CATALOGUE)('$name: closed profiles run axis to axis with unit normals', ({ profile }) => {
    for (const curve of [profile.glass, profile.liquid, ...profile.stopper]) {
      expect(curve[0]!.r).toBe(0)
      expect(curve.at(-1)!.r).toBe(0)
      for (const p of curve) {
        expect(p.r).toBeGreaterThanOrEqual(0)
        expect(Math.hypot(p.nr, p.nz)).toBeCloseTo(1, 6)
      }
    }
  })

  it.each(CATALOGUE)('$name: cavityVolume is monotone and agrees with Simpson', ({ profile }) => {
    expect(profile.cavityVolume(BASE_MM)).toBe(0)
    let last = 0
    for (const z of steps(BASE_MM, profile.cavityTopZ, 1)) {
      const v = profile.cavityVolume(z)
      expect(v).toBeGreaterThanOrEqual(last)
      last = v
    }
    const exact = simpsonVolume(profile, BASE_MM, profile.fullZ)
    expect(profile.cavityVolume(profile.fullZ) / exact).toBeCloseTo(1, 3)
  })
})

describe('uprightLevels', () => {
  it.each(CATALOGUE)(
    '$name: each pour adds a quarter of the volume to fullZ, within 1 percent',
    ({ spec, profile }) => {
      const levels = uprightLevels(spec)
      expect(levels).toHaveLength(4)
      expect(levels.at(-1)).toBeCloseTo(profile.fullZ, 6)
      const full = simpsonVolume(profile, BASE_MM, profile.fullZ)
      let below = BASE_MM
      for (const top of levels) {
        expect(top).toBeGreaterThan(below)
        const band = simpsonVolume(profile, below, top)
        expect(Math.abs(band / (full / 4) - 1)).toBeLessThan(0.01)
        below = top
      }
    },
  )

  it('gives one level per pour, the same heights as the full bottle', () => {
    const full = uprightLevels(specOf('gourd', 0.5))
    for (const n of [0, 1, 2, 3]) {
      expect(uprightLevels(specOf('gourd', 0.5, FOUR.slice(0, n)))).toEqual(full.slice(0, n))
    }
  })
})

describe('each shape reads as its name', () => {
  const at = (shape: ShapeId) => bottleProfile(specOf(shape, 0.5))
  const widestZ = (p: BottleProfile) => {
    const zs = steps(0, p.shoulderZ, 0.1)
    return zs.reduce((best, z) => (p.outerR(z) > p.outerR(best) ? z : best), 0)
  }

  it('the round flask is nearly as wide as its body is tall', () => {
    const p = at('round')
    expect(p.widthMm / p.shoulderZ).toBeGreaterThan(0.95)
  })

  it('the teardrop flask is widest low down and tapers all the way to the neck', () => {
    const p = at('teardrop')
    const w = widestZ(p)
    expect(w / p.shoulderZ).toBeLessThan(0.4)
    for (const z of steps(w + 1, p.shoulderZ, 0.5))
      expect(p.outerR(z)).toBeLessThan(p.outerR(z - 0.5))
  })

  it('the tall bottle is at least three times as tall as it is wide', () => {
    const p = at('tall')
    expect(p.lipZ / p.widthMm).toBeGreaterThan(3)
  })

  it('the square shoulders turn in flat: most of the radius goes in a few millimetres', () => {
    const p = at('shoulder')
    const body = p.outerR(p.shoulderZ * 0.8)
    const neck = BOTTLES.shoulder.neckRadiusMm
    const zs = steps(p.shoulderZ * 0.8, p.shoulderZ, 0.05)
    const from = zs.find((z) => p.outerR(z) < body - 0.15 * (body - neck))!
    const to = zs.find((z) => p.outerR(z) < neck + 0.15 * (body - neck))!
    expect(to - from).toBeLessThan(0.35 * (body - neck))
    expect(p.outerR(p.shoulderZ * 0.85)).toBeCloseTo(body, 0)
  })

  it('the gourd has a waist narrower than both bulbs', () => {
    const p = at('gourd')
    const r = (f: number) => p.outerR(f * p.shoulderZ)
    const lower = Math.max(...steps(0, 0.45, 0.01).map(r))
    const waist = Math.min(...steps(0.35, 0.65, 0.01).map(r))
    const upper = Math.max(...steps(0.55, 0.9, 0.01).map(r))
    expect(waist).toBeLessThan(0.7 * upper)
    expect(upper).toBeLessThan(lower)
  })
})
