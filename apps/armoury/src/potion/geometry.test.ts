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

// The heaviest of all 1,260 combinations, necks in 0.05 steps: the most in total, the most
// glass, the most liquid, the most stopper and label.
const HEAVIEST: Entry[] = [
  entry('gourd', 1, 'wax', 'tag'),
  entry('gourd', 1, 'cork', 'none'),
  entry('gourd', 0.9, 'cork', 'none'),
  entry('round', 0.9, 'wax', 'tag'),
]

// Every shape at every neck with every label, the stoppers cycled; the teardrop with each
// stopper and no label; an empty and a one-pour bottle.
const CATALOGUE: Entry[] = [
  ...HEAVIEST,
  ...SHAPES.flatMap((shape, s) =>
    [0, 0.5, 1].flatMap((neck, n) =>
      LABELS.map((label, l) => entry(shape, neck, STOPPERS[(s + n + l) % 3]!, label)),
    ),
  ),
  ...STOPPERS.map((stopper) => entry('teardrop', 0.5, stopper, 'none')),
  entry('round', 0, 'wax', 'round', []),
  entry('gourd', 1, 'glass', 'banner', ['bogmurk']),
  entry('teardrop', 0.4, 'wax', 'round'),
  entry('round', 0.1, 'wax', 'banner'),
  entry('tall', 0, 'wax', 'tag'),
  entry('shoulder', 1, 'wax', 'tag'),
  entry('gourd', 1, 'wax', 'banner'),
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

/** The vertices of each piece of a part that triangles use. */
function pieces(part: MeshPart): Vec[][] {
  const piece = pieceOf(part)
  const out = new Map<number, Vec[]>()
  for (const i of new Set(part.indices)) {
    const id = piece(i)
    if (!out.has(id)) out.set(id, [])
    out
      .get(id)!
      .push([part.positions[i * 3]!, part.positions[i * 3 + 1]!, part.positions[i * 3 + 2]!])
  }
  return [...out.values()]
}

/** A wax seal's cork, its coat and its runs. */
function waxPieces(e: Entry): { coat: Vec[]; runs: Vec[][] } {
  const all = pieces(e.mesh.stopper)
  const low = (p: Vec[]) => Math.min(...p.map(([, , z]) => z))
  const high = (p: Vec[]) => Math.max(...p.map(([, , z]) => z))
  const cork = all.find((p) => Math.abs(low(p) - e.profile.cavityTopZ) < 1e-3)!
  const coat = all.reduce((a, b) => (high(b) > high(a) ? b : a))
  return { coat, runs: all.filter((p) => p !== cork && p !== coat) }
}

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
    '$name: the banner wraps 120 degrees round the front, so both notched ends show',
    ({ mesh }) => {
      const turns = sampled(mesh.label!, Infinity).map((p) => turnBetween(FRONT_ANGLE, angleOf(p)))
      expect((Math.max(...turns) * 180) / Math.PI).toBeCloseTo(60, 0)
      expect((Math.min(...turns) * 180) / Math.PI).toBeCloseTo(-60, 0)
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

  const WAXED = CATALOGUE.filter((e) => e.spec.stopper === 'wax')

  it.each(WAXED)(
    '$name: the wax is uneven: its hem wanders round the neck and its top tilts',
    (e) => {
      const { coat } = waxPieces(e)
      const sectors = 12
      const lowest = new Array<number>(sectors).fill(Infinity)
      for (const p of coat) {
        const k = Math.floor(((angleOf(p) + Math.PI) / (2 * Math.PI)) * sectors) % sectors
        lowest[k] = Math.min(lowest[k]!, p[2])
      }
      expect(Math.max(...lowest) - Math.min(...lowest)).toBeGreaterThan(1)
      // The lift moves only heights, so each ring of the lathe keeps its radius: take the widest
      // ring over the cork's top and see how far its heights spread round the neck.
      const rings = new Map<string, number[]>()
      for (const p of coat.filter((q) => q[2] > e.profile.lipZ + 2)) {
        const r = Math.hypot(p[0], p[1])
        if (r < 0.95 * e.profile.stopperSeat.r)
          rings.set(r.toFixed(3), [...(rings.get(r.toFixed(3)) ?? []), p[2]])
      }
      const widest = [...rings.keys()].sort((a, b) => Number(b) - Number(a))[0]!
      const heights = rings.get(widest)!
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.15)
    },
  )

  it.each(WAXED)(
    '$name: three to five runs of clearly different lengths, unevenly spaced, each ending in a bead',
    (e) => {
      const { coat, runs } = waxPieces(e)
      expect(runs.length).toBeGreaterThanOrEqual(3)
      expect(runs.length).toBeLessThanOrEqual(5)
      const ring = e.profile.wax!.ringMm
      const measured = runs.map((run) => {
        const mid = run.reduce((s, p) => [s[0] + p[0], s[1] + p[1], 0] as Vec, [0, 0, 0] as Vec)
        const angle = angleOf(mid)
        const hem = Math.min(
          ...coat.filter((p) => Math.abs(turnBetween(angle, angleOf(p))) < 0.2).map(([, , z]) => z),
        )
        const foot = Math.min(...run.map(([, , z]) => z))
        const top = Math.max(...run.map(([, , z]) => z))
        // Its width by height, foot to top: it narrows from the hem and swells to a bead.
        const side = (p: Vec) => Math.abs(-Math.sin(angle) * p[0] + Math.cos(angle) * p[1])
        const widths = new Array<number>(12).fill(0)
        for (const p of run) {
          const k = Math.min(11, Math.floor(((p[2] - foot) / (top - foot)) * 12))
          widths[k] = Math.max(widths[k]!, side(p))
        }
        const bead = Math.max(...widths.slice(0, 3))
        const stem = Math.min(...widths.slice(2, 8))
        expect(bead / stem, 'a bead at the foot').toBeGreaterThan(1.15)
        return { angle, length: hem - foot }
      })
      const lengths = measured.map((m) => m.length).sort((a, b) => a - b)
      for (let i = 1; i < lengths.length; i++)
        expect(lengths[i]! / lengths[i - 1]!).toBeGreaterThan(1.25)
      if (e.profile.wax!.hemZ - e.profile.wax!.floorZ > 1.2 * ring) {
        expect(lengths[0]! / ring).toBeGreaterThan(0.25)
        expect(lengths[0]! / ring).toBeLessThan(0.4)
        expect(lengths.at(-1)! / ring).toBeGreaterThan(0.9)
        expect(lengths.at(-1)! / ring).toBeLessThan(1.1)
      }
      const angles = measured.map((m) => m.angle).sort((a, b) => a - b)
      const gaps = angles.map((a, i) => (i ? a - angles[i - 1]! : a + 2 * Math.PI - angles.at(-1)!))
      expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(1.5)
    },
  )

  it.each(WAXED)('$name: no wax reaches the shoulder or a tag string', (e) => {
    const { floorZ } = e.profile.wax!
    const outside = sampled(e.mesh.stopper, Infinity).filter(
      ([x, y]) => Math.hypot(x, y) > e.profile.stopperSeat.r,
    )
    const lowest = Math.min(...outside.map(([, , z]) => z))
    expect(lowest).toBeGreaterThanOrEqual(floorZ - 1e-6)
    expect(lowest).toBeGreaterThan(e.profile.shoulderZ + 0.9)
    if (e.spec.label === 'tag') {
      const highestString = Math.max(
        ...tagLayout(e.profile)
          .string.filter(
            ([x, y, z]) => z > e.profile.shoulderZ && Math.hypot(x, y) < 2 * e.profile.neckR,
          )
          .map(([, , z]) => z),
      )
      expect(lowest).toBeGreaterThan(highestString + 0.4 + 0.5)
    }
  })

  it('has no label part without a label, and a wax seal with runs below its coat', () => {
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
