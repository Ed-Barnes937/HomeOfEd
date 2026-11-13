import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { inwardNormals, type MeshPart, openEdges, signedVolume } from '../sword/sweep.ts'
import { BOTTLES, type ShapeId } from './bottles.ts'
import { compilePotion, type PotionSpec } from './compile.ts'
import { buildPotionMesh, type PotionMesh } from './geometry.ts'
import type { IngredientId } from './ingredients.ts'
import type { LabelId, StopperId } from './potionSchema.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'
import { BASE_MM, bottleProfile, type BottleProfile, LIQUID_GAP_MM } from './profile.ts'

const SHAPES = Object.keys(BOTTLES) as ShapeId[]
const STOPPERS: StopperId[] = ['cork', 'glass', 'wax']
const LABELS: LabelId[] = ['round', 'banner', 'tag']
const FOUR: IngredientId[] = ['moonmilk', 'rosehip', 'starpetal', 'bluebell']

interface Entry {
  name: string
  spec: PotionSpec
  profile: BottleProfile
  mesh: PotionMesh
}

function entry(
  shape: ShapeId,
  neck: number,
  stopper: StopperId,
  label: LabelId,
  pours = FOUR,
): Entry {
  const spec = compilePotion(
    normalise(potionSchema, { ...withPours(pours), shape, neck, stopper, label }),
  )
  return {
    name: `${shape} neck ${neck} ${stopper} ${label} ${pours.length} pours`,
    spec,
    profile: bottleProfile(spec),
    mesh: buildPotionMesh(spec),
  }
}

// Every shape at every neck with every label, the stoppers cycled; the teardrop with each
// stopper and no label; an empty and a one-pour bottle.
const CATALOGUE: Entry[] = [
  ...SHAPES.flatMap((shape, s) =>
    [0, 0.5, 1].flatMap((neck, n) =>
      LABELS.map((label, l) => entry(shape, neck, STOPPERS[(s + n + l) % 3]!, label)),
    ),
  ),
  ...STOPPERS.map((stopper) => entry('teardrop', 0.5, stopper, 'none')),
  entry('round', 0, 'wax', 'round', []),
  entry('gourd', 1, 'glass', 'banner', ['bogmurk']),
]

const partsOf = (mesh: PotionMesh) =>
  Object.entries(mesh).filter((e): e is [string, MeshPart] => e[1] !== null)

const vertexCount = (part: MeshPart | null) => (part ? part.positions.length / 3 : 0)

/** Every k-th vertex, about 200 of them, as [x, y, z]. */
function sampled(part: MeshPart, count = 200): [number, number, number][] {
  const n = part.positions.length / 3
  const step = Math.max(1, Math.floor(n / count))
  const out: [number, number, number][] = []
  for (let i = 0; i < n; i += step) {
    out.push([part.positions[i * 3]!, part.positions[i * 3 + 1]!, part.positions[i * 3 + 2]!])
  }
  return out
}

function distanceToOuter(profile: BottleProfile, r: number, z: number): number {
  let best = Infinity
  for (let zz = Math.max(0, z - 3); zz <= Math.min(profile.lipZ, z + 3); zz += 0.02) {
    best = Math.min(best, Math.hypot(profile.outerR(zz) - r, zz - z))
  }
  return best
}

describe('buildPotionMesh', () => {
  it.each(CATALOGUE)(
    '$name: every part is closed, outward and wound to a positive volume',
    ({ name, mesh }) => {
      for (const [key, part] of partsOf(mesh)) {
        expect(openEdges(part), `${name} ${key} open edges`).toBe(0)
        expect(inwardNormals(part), `${name} ${key} inward normals`).toBe(0)
        expect(signedVolume(part), `${name} ${key} volume`).toBeGreaterThan(0)
        expect(part.uvs.length / 2).toBe(part.positions.length / 3)
        const height = part.attrs.aHeight!
        expect(height.every((h, i) => h === part.positions[i * 3 + 2])).toBe(true)
      }
    },
  )

  it.each(CATALOGUE)('$name: within budget', ({ mesh }) => {
    const glass = vertexCount(mesh.glass)
    const liquid = vertexCount(mesh.liquid)
    const finish = vertexCount(mesh.stopper) + vertexCount(mesh.label)
    expect(glass).toBeLessThanOrEqual(20_000)
    expect(liquid).toBeLessThanOrEqual(10_000)
    expect(finish).toBeLessThanOrEqual(8_000)
    expect(glass + liquid + finish).toBeLessThanOrEqual(40_000)
  })

  it.each(CATALOGUE)('$name: the liquid lies inside the cavity', ({ mesh, profile }) => {
    for (const [x, y, z] of sampled(mesh.liquid)) {
      expect(z).toBeGreaterThanOrEqual(BASE_MM + LIQUID_GAP_MM - 1e-4)
      expect(z).toBeLessThanOrEqual(profile.cavityTopZ)
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(profile.innerR(z) - 0.2)
    }
    expect(signedVolume(mesh.liquid)).toBeLessThan(profile.cavityVolume(profile.cavityTopZ))
    expect(signedVolume(mesh.liquid)).toBeGreaterThan(
      0.95 * profile.cavityVolume(profile.cavityTopZ),
    )
  })

  it.each(CATALOGUE)(
    '$name: the stopper fills the seat and never crosses the glass',
    ({ spec, mesh, profile }) => {
      const top = Math.max(...sampled(mesh.stopper, Infinity).map(([, , z]) => z))
      expect(top).toBeLessThanOrEqual(spec.heightMm + 1e-4)
      if (spec.stopper === 'glass') expect(top).toBeCloseTo(spec.heightMm, 3)
      let deepest = Infinity
      for (const [x, y, z] of sampled(mesh.stopper, Infinity)) {
        if (z >= profile.lipZ) continue
        const r = Math.hypot(x, y)
        const inBore = r <= profile.innerR(z) - 0.01
        const outside = r >= profile.outerR(z) + 0.01
        expect(inBore || outside, `r ${r} at z ${z}`).toBe(true)
        if (inBore) deepest = Math.min(deepest, z)
      }
      expect(deepest).toBeCloseTo(profile.stopperSeat.z - profile.stopperSeat.depthMm, 3)
    },
  )

  it.each(CATALOGUE.filter((e) => e.spec.label === 'round' || e.spec.label === 'banner'))(
    '$name: the label sits 0.2-0.5 mm outside the glass, facing the front',
    ({ mesh, profile }) => {
      const label = mesh.label!
      for (const [x, y, z] of sampled(label)) {
        const d = distanceToOuter(profile, Math.hypot(x, y), z)
        expect(d).toBeGreaterThanOrEqual(0.2)
        expect(d).toBeLessThanOrEqual(0.5)
        expect(y).toBeLessThan(0)
      }
    },
  )

  it.each(CATALOGUE.filter((e) => e.spec.label === 'tag'))(
    '$name: the tag and its string hang clear of the glass, in front',
    ({ mesh, profile }) => {
      let front = 0
      for (const [x, y, z] of sampled(mesh.label!, Infinity)) {
        if (z < 0 || z > profile.lipZ) continue
        expect(Math.hypot(x, y)).toBeGreaterThanOrEqual(profile.outerR(z) + 0.1)
        if (y < -profile.outerR(z)) front++
      }
      expect(front).toBeGreaterThan(0)
    },
  )

  it('lays label UVs out in millimetres across the paper', () => {
    const span = (part: MeshPart, axis: 0 | 1) => {
      const values = part.uvs.filter((_, i) => i % 2 === axis)
      return Math.max(...values) - Math.min(...values)
    }
    const round = CATALOGUE.find((e) => e.name === 'teardrop neck 0.5 cork round 4 pours')
    const banner = CATALOGUE.find((e) => e.spec.shape === 'teardrop' && e.spec.label === 'banner')!
    const tag = CATALOGUE.find((e) => e.spec.shape === 'teardrop' && e.spec.label === 'tag')!
    const r =
      round ?? CATALOGUE.find((e) => e.spec.shape === 'teardrop' && e.spec.label === 'round')!
    expect(span(r.mesh.label!, 0)).toBeGreaterThan(30)
    expect(span(r.mesh.label!, 0)).toBeCloseTo(span(r.mesh.label!, 1), 0)
    expect(span(banner.mesh.label!, 1)).toBeCloseTo(22, 0)
    expect(span(banner.mesh.label!, 0)).toBeGreaterThan(60)
    const card = tag.mesh.label!
    expect(Math.max(...card.uvs.filter((_, i) => i % 2 === 0))).toBeCloseTo(13, 1)
    expect(Math.max(...card.uvs.filter((_, i) => i % 2 === 1))).toBeCloseTo(9, 1)
  })

  it('makes a smaller round label on the tall bottle than on the teardrop', () => {
    const width = (e: Entry) => {
      const u = e.mesh.label!.uvs.filter((_, i) => i % 2 === 0)
      return Math.max(...u) - Math.min(...u)
    }
    const of = (shape: ShapeId) =>
      CATALOGUE.find((e) => e.spec.shape === shape && e.spec.label === 'round')!
    expect(width(of('tall'))).toBeLessThan(width(of('teardrop')))
  })

  it('has no label part without a label, and a wax seal with drips below its cap', () => {
    const plain = CATALOGUE.find((e) => e.spec.label === 'none' && e.spec.stopper === 'wax')!
    expect(plain.mesh.label).toBeNull()
    const cork = CATALOGUE.find((e) => e.spec.label === 'none' && e.spec.stopper === 'cork')!
    const low = (e: Entry) =>
      Math.min(
        ...sampled(e.mesh.stopper, Infinity)
          .filter(([x, y]) => Math.hypot(x, y) > e.profile.stopperSeat.r + 1)
          .map(([, , z]) => z),
      )
    expect(low(plain)).toBeLessThan(plain.profile.lipZ - 2 * BOTTLES.teardrop.lipMm - 4)
    expect(Math.min(...sampled(cork.mesh.stopper, Infinity).map(([, , z]) => z))).toBeCloseTo(
      cork.profile.cavityTopZ,
      3,
    )
  })
})
