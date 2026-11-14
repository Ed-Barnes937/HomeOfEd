import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { inwardNormals, type MeshPart, openEdges, signedVolume } from '../sword/sweep.ts'
import { BOTTLES, type ShapeId } from './bottles.ts'
import { compilePotion, type PotionSpec } from './compile.ts'
import { buildPotionMesh, FRONT_ANGLE, type PotionMesh, tagLayout } from './geometry.ts'
import type { IngredientId } from './ingredients.ts'
import type { LabelId, StopperId } from './potionSchema.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'
import { BASE_MM, bandTops, bottleProfile, type BottleProfile, LIQUID_GAP_MM } from './profile.ts'

const SHAPES = Object.keys(BOTTLES) as ShapeId[]
const STOPPERS: StopperId[] = ['cork', 'glass']
const LABELS: LabelId[] = ['round', 'banner', 'tag']
const THREE: IngredientId[] = ['moonmilk', 'rosehip', 'starpetal']

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
  pours = THREE,
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

// The heaviest of all 840 combinations, necks in 0.05 steps: the most in total, the most
// glass, the most liquid, the most stopper and label.
const HEAVIEST: Entry[] = [
  entry('gourd', 1, 'glass', 'tag'),
  entry('gourd', 1, 'cork', 'none'),
  entry('gourd', 0.9, 'cork', 'none'),
  entry('round', 0.15, 'glass', 'tag'),
]

// Every shape at every neck with every label, the stoppers cycled; the teardrop with each
// stopper and no label; an empty and a one-pour bottle.
const CATALOGUE: Entry[] = [
  ...HEAVIEST,
  ...SHAPES.flatMap((shape, s) =>
    [0, 0.5, 1].flatMap((neck, n) =>
      LABELS.map((label, l) => entry(shape, neck, STOPPERS[(s + n + l) % STOPPERS.length]!, label)),
    ),
  ),
  ...STOPPERS.map((stopper) => entry('teardrop', 0.5, stopper, 'none')),
  entry('round', 0, 'cork', 'round', []),
  entry('gourd', 1, 'glass', 'banner', ['puffcap']),
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

/** Each vertex's piece, pieces joined where triangles share a position. */
function pieceOf(part: MeshPart): (vertex: number) => number {
  const { positions: p, indices } = part
  const ids = new Map<string, number>()
  const weld = Int32Array.from({ length: p.length / 3 }, (_, i) => {
    const key = `${p[i * 3]},${p[i * 3 + 1]},${p[i * 3 + 2]}`
    if (!ids.has(key)) ids.set(key, ids.size)
    return ids.get(key)!
  })
  const parent = Int32Array.from({ length: ids.size }, (_, i) => i)
  const root = (a: number): number => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]!]!
    return a
  }
  for (let t = 0; t < indices.length; t += 3) {
    const a = root(weld[indices[t]!]!)
    parent[root(weld[indices[t + 1]!]!)] = a
    parent[root(weld[indices[t + 2]!]!)] = a
  }
  return (vertex) => root(weld[vertex]!)
}

/** The signed volume of each piece of a part. */
function pieceVolumes(part: MeshPart): number[] {
  const { positions: p, indices } = part
  const piece = pieceOf(part)
  const volumes = new Map<number, number>()
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]! * 3
    const b = indices[t + 1]! * 3
    const c = indices[t + 2]! * 3
    const det =
      p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) -
      p[a + 1]! * (p[b]! * p[c + 2]! - p[b + 2]! * p[c]!) +
      p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!)
    const id = piece(indices[t]!)
    volumes.set(id, (volumes.get(id) ?? 0) + det / 6)
  }
  return [...volumes.values()]
}

type Vec = [number, number, number]

const angleOf = ([x, y]: Vec) => Math.atan2(y, x)
/** The angle from a to b, -PI to PI. */
const turnBetween = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

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

  it.each(CATALOGUE)('$name: every piece of every part encloses a positive volume', ({ mesh }) => {
    for (const [key, part] of partsOf(mesh)) {
      for (const volume of pieceVolumes(part)) {
        expect(volume, `${key} piece`).toBeGreaterThan(0)
      }
    }
  })

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
    '$name: the label is paper 0.1 mm off the glass, facing the front',
    ({ mesh, profile }) => {
      const label = mesh.label!
      for (const [x, y, z] of sampled(label)) {
        const d = distanceToOuter(profile, Math.hypot(x, y), z)
        expect(Math.hypot(x, y)).toBeGreaterThan(profile.outerR(z))
        expect(d).toBeGreaterThanOrEqual(0.08)
        expect(d).toBeLessThanOrEqual(0.22)
        expect(y).toBeLessThan(0)
      }
    },
  )

  it.each(CATALOGUE.filter((e) => e.spec.label === 'round'))(
    '$name: the round label spans at most 0.6 of the body from the front, 0.6 on the tall bottle',
    ({ spec, mesh, profile }) => {
      const label = sampled(mesh.label!, Infinity)
      const xs = label.map(([x]) => x)
      const zs = label.map(([, , z]) => z)
      const middle = (Math.min(...zs) + Math.max(...zs)) / 2
      const share = (Math.max(...xs) - Math.min(...xs)) / (2 * profile.outerR(middle))
      expect(share).toBeLessThan(0.63)
      // The round flask's is held to a third of its height, so its middle pours still show.
      expect(share).toBeGreaterThan(spec.shape === 'round' ? 0.25 : 0.5)
      if (spec.shape === 'tall') expect(share).toBeGreaterThan(0.57)
    },
  )

  it.each(CATALOGUE.filter((e) => e.spec.label === 'banner'))(
    '$name: the banner wraps 120 degrees round the front, 100 on the round flask, so both notched ends show',
    ({ spec, mesh }) => {
      const turns = sampled(mesh.label!, Infinity).map((p) => turnBetween(FRONT_ANGLE, angleOf(p)))
      const half = spec.shape === 'round' ? 50 : 60
      expect((Math.max(...turns) * 180) / Math.PI).toBeCloseTo(half, 0)
      expect((Math.min(...turns) * 180) / Math.PI).toBeCloseTo(-half, 0)
    },
  )

  it.each(CATALOGUE.filter((e) => e.spec.label === 'banner' && e.spec.shape === 'round'))(
    '$name: the banner leaves at least 40 percent of the middle of three pours showing from the front',
    ({ spec, mesh, profile }) => {
      const [bottom, middle] = bandTops(profile, spec.layers.length)
      const label = sampled(mesh.label!, Infinity)
      let band = 0
      let hidden = 0
      for (let z = bottom! + 0.125; z < middle!; z += 0.25) {
        const r = profile.innerR(z)
        band += 2 * r
        const xs = label.filter(([, , lz]) => Math.abs(lz - z) <= 1.05).map(([x]) => x)
        if (xs.length > 0) hidden += Math.min(r, Math.max(...xs)) - Math.max(-r, Math.min(...xs))
      }
      expect(1 - hidden / band).toBeGreaterThanOrEqual(0.4)
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

  it.each(CATALOGUE.filter((e) => e.spec.label === 'tag'))(
    '$name: the tag hangs below its loop on a smooth string, rolled, resting on the glass',
    ({ mesh, profile }) => {
      const { loopZ, card, string } = tagLayout(profile)
      const neckD = 2 * profile.neckR
      const outline: [number, number][] = [
        [-13, -9],
        [13, -9],
        [13, 5],
        [9, 9],
        [-9, 9],
        [-13, 5],
      ]
      const top = Math.max(...outline.map(([u, v]) => card(u, v, 0)[2]))
      expect(loopZ - top).toBeGreaterThanOrEqual(0.5 * neckD)
      expect(loopZ - top).toBeLessThanOrEqual(neckD)
      const [a, b] = [card(-13, -9, 0), card(13, -9, 0)]
      const roll =
        (Math.acos((b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])) * 180) /
        Math.PI
      expect(roll).toBeGreaterThanOrEqual(8)
      expect(roll).toBeLessThanOrEqual(12)
      let nearest = Infinity
      for (let u = -13; u <= 13; u += 0.5)
        for (let v = -9; v <= 9; v += 0.5) {
          if (Math.abs(u) > 13 - Math.max(0, v - 5)) continue
          const [x, y, z] = card(u, v, -0.2)
          nearest = Math.min(nearest, Math.hypot(x, y) - profile.outerR(z))
        }
      expect(nearest).toBeLessThan(1)
      for (let k = 0; k < string.length; k++) {
        const [p, q, s] = [-1, 0, 1].map((d) => string[(k + d + string.length) % string.length]!)
        const ab = [q![0] - p![0], q![1] - p![1], q![2] - p![2]]
        const bc = [s![0] - q![0], s![1] - q![1], s![2] - q![2]]
        const cos =
          (ab[0]! * bc[0]! + ab[1]! * bc[1]! + ab[2]! * bc[2]!) /
          (Math.hypot(...ab) * Math.hypot(...bc))
        expect((Math.acos(Math.min(1, cos)) * 180) / Math.PI, `at ${k}`).toBeLessThan(20)
      }
      const uv = mesh.label!.uvs
      for (let i = 0; i < uv.length; i += 2) {
        if (uv[i + 1]! > 8.99) expect(Math.abs(uv[i]!)).toBeLessThanOrEqual(9.01)
      }
    },
  )

  it('lays label UVs out in millimetres across the paper', () => {
    const span = (part: MeshPart, axis: 0 | 1) => {
      const values = part.uvs.filter((_, i) => i % 2 === axis)
      return Math.max(...values) - Math.min(...values)
    }
    const banner = CATALOGUE.find((e) => e.spec.shape === 'teardrop' && e.spec.label === 'banner')!
    const tag = CATALOGUE.find((e) => e.spec.shape === 'teardrop' && e.spec.label === 'tag')!
    const r = CATALOGUE.find((e) => e.spec.shape === 'teardrop' && e.spec.label === 'round')!
    expect(span(r.mesh.label!, 0)).toBeGreaterThan(30)
    expect(span(r.mesh.label!, 0)).toBeCloseTo(span(r.mesh.label!, 1), 0)
    expect(span(banner.mesh.label!, 1)).toBeCloseTo(18, 0)
    expect(span(banner.mesh.label!, 0)).toBeGreaterThan(60)
    const card = tag.mesh.label!
    expect(Math.max(...card.uvs.filter((_, i) => i % 2 === 0))).toBeCloseTo(13, 1)
    expect(Math.max(...card.uvs.filter((_, i) => i % 2 === 1))).toBeCloseTo(9, 1)
  })

  it.each(CATALOGUE)(
    "$name: the glass marks its cavity's and bore's surface inner, its outside outer",
    ({ name, mesh, profile }) => {
      const { positions: p, normals: n, indices } = mesh.glass
      const inner = mesh.glass.attrs.aInner!
      expect(inner).toHaveLength(p.length / 3)
      const at = (i: number) => {
        const r = Math.hypot(p[i * 3]!, p[i * 3 + 1]!)
        const radial = r < 1e-6 ? 0 : (n[i * 3]! * p[i * 3]! + n[i * 3 + 1]! * p[i * 3 + 1]!) / r
        return { r, z: p[i * 3 + 2]!, radial, nz: n[i * 3 + 2]!, inner: inner[i] }
      }
      const seen = { towards: 0, away: 0, floor: 0, foot: 0, lip: 0 }
      for (let i = 0; i < inner.length; i++) {
        const v = at(i)
        expect(v.inner === 0 || v.inner === 1, `${name} vertex ${i}`).toBe(true)
        if (v.radial < -0.2) {
          expect(v.inner, `${name} faces the axis at z ${v.z}`).toBe(1)
          seen.towards++
        }
        if (v.radial > 0.2) {
          expect(v.inner, `${name} faces away at z ${v.z}`).toBe(0)
          seen.away++
        }
        if (Math.abs(v.z - BASE_MM) < 1e-3 && v.nz > 0.99) {
          expect(v.inner, `${name} cavity floor`).toBe(1)
          seen.floor++
        }
        if (v.z < 1 && v.nz < -0.99) {
          expect(v.inner, `${name} foot`).toBe(0)
          seen.foot++
        }
        const lipRing = (profile.neckR + profile.stopperSeat.r) / 2
        if (Math.abs(v.z - profile.lipZ) < 1e-3 && v.nz > 0.99 && v.r >= lipRing) {
          expect(v.inner, `${name} lip top`).toBe(0)
          seen.lip++
        }
      }
      for (const [where, count] of Object.entries(seen)) expect(count, where).toBeGreaterThan(0)
      for (let t = 0; t < indices.length; t += 3) {
        const flag = inner[indices[t]!]
        expect(inner[indices[t + 1]!], `${name} triangle ${t / 3}`).toBe(flag)
        expect(inner[indices[t + 2]!], `${name} triangle ${t / 3}`).toBe(flag)
      }
    },
  )

  it.each(CATALOGUE)('$name: the stopper is solid, so nothing of it is inner', ({ mesh }) => {
    const inner = mesh.stopper.attrs.aInner!
    expect(inner).toHaveLength(mesh.stopper.positions.length / 3)
    expect(inner.every((f) => f === 0)).toBe(true)
  })

  it('has no label part without a label, and a cork reaching down to the cavity', () => {
    const cork = CATALOGUE.find((e) => e.spec.label === 'none' && e.spec.stopper === 'cork')!
    expect(cork.mesh.label).toBeNull()
    expect(Math.min(...sampled(cork.mesh.stopper, Infinity).map(([, , z]) => z))).toBeCloseTo(
      cork.profile.cavityTopZ,
      3,
    )
  })
})
