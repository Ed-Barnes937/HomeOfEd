import { describe, expect, it } from 'vitest'

import { defaults, normalise, randomise, seededRandom } from '../engine/schema.ts'
import { compileWand } from './compile.ts'
import { crystalSolid } from './crystals.ts'
import { crystalMesh, endPoses, tipPose } from './geometry.ts'
import { wandSchema } from './wandSchema.ts'

/** Params as saved before `key` existed. */
const without = (params: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(params).filter(([k]) => k !== key))

const wand = (extra: Record<string, unknown> = {}) =>
  compileWand(normalise(wandSchema, { ...defaults(wandSchema), ...extra }))

const SHAPES = ['hex', 'double', 'cluster', 'shard', 'teardrop'] as const
const COLOURS = ['amethyst', 'emerald', 'ruby', 'sapphire', 'citrine', 'clear', 'smoky'] as const

const vertices = (positions: number[]) =>
  Array.from({ length: positions.length / 3 }, (_, k) => positions.slice(3 * k, 3 * k + 3))

const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i]!, 0)
const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]!)
const cross = ([ax, ay, az]: number[], [bx, by, bz]: number[]) => [
  ay! * bz! - az! * by!,
  az! * bx! - ax! * bz!,
  ax! * by! - ay! * bx!,
]

/** Triangles whose front faces point into their own piece of the solid, where they'd be culled. */
function inwardTriangles({ positions, indices }: { positions: number[]; indices: number[] }) {
  const vs = vertices(positions)
  // Each separate piece (the cluster has five) is judged from its own middle.
  const piece = vs.map((_, i) => i)
  const find = (i: number): number => (piece[i] === i ? i : (piece[i] = find(piece[i]!)))
  for (let t = 0; t < indices.length; t += 3)
    for (const k of [1, 2]) piece[find(indices[t + k]!)] = find(indices[t]!)
  const middles = new Map<number, number[]>()
  vs.forEach((v, i) => {
    const m = middles.get(find(i)) ?? [0, 0, 0, 0]
    middles.set(find(i), [m[0]! + v[0]!, m[1]! + v[1]!, m[2]! + v[2]!, m[3]! + 1])
  })
  let inward = 0
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => vs[indices[t + k]!]!)
    const m = middles.get(find(indices[t]!))!
    const middle = [m[0]! / m[3]!, m[1]! / m[3]!, m[2]! / m[3]!]
    const centre = [0, 1, 2].map((i) => (a![i]! + b![i]! + c![i]!) / 3)
    if (dot(cross(sub(b!, a!), sub(c!, a!)), sub(centre, middle)) <= 0) inward++
  }
  return inward
}

describe('crystal colour', () => {
  it("matches the core by default, glowing in the core's colour", () => {
    expect(wand({ tipGem: 'crystal', core: 'starlight' }).gemColour.glow).toBe('#ffc95c')
    expect(wand({ tipGem: 'crystal', core: 'moonstone' }).gemColour.glow).toBe('#8fe3ff')
  })

  it('a wand saved before crystal colours opens matching its core', () => {
    const old = without(defaults(wandSchema), 'gemColour')
    const spec = compileWand(normalise(wandSchema, { ...old, gems: 'ring', core: 'emberstone' }))
    expect(spec.gemColour).toEqual(wand({ gems: 'ring', core: 'emberstone' }).gemColour)
    expect(spec.gemColour.glow).toBe('#ff7a45')
  })

  it('a chosen colour is the same whatever the core, and differs from every other', () => {
    const glows = COLOURS.map((gemColour) => {
      const colour = wand({ gems: 'line', gemColour, core: 'starlight' }).gemColour
      expect(wand({ gems: 'line', gemColour, core: 'wildwood' }).gemColour).toEqual(colour)
      return colour.glow
    })
    expect(new Set(glows).size).toBe(COLOURS.length)
  })

  it('the stone is darker than its glow, so it reads as lit from inside', () => {
    const luma = (hex: string) => {
      const n = parseInt(hex.slice(1), 16)
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
    }
    for (const gemColour of ['core', ...COLOURS]) {
      const { glow, body } = wand({ gemColour }).gemColour
      expect(luma(body)).toBeLessThan(0.75 * luma(glow))
    }
  })

  it('Try another mostly matches the core', () => {
    const rng = seededRandom(8)
    const rolls = Array.from({ length: 2000 }, () => randomise(wandSchema, rng))
    const share = rolls.filter((p) => p.gemColour === 'core').length / rolls.length
    expect(share).toBeGreaterThan(0.45)
    expect(share).toBeLessThan(0.7)
  })
})

describe('crystal tip shapes', () => {
  it('a wand saved before tip shapes opens with the hex point', () => {
    const old = without(defaults(wandSchema), 'crystalShape')
    const spec = compileWand(normalise(wandSchema, { ...old, tipGem: 'crystal' }))
    expect(spec.crystal!.shape).toBe('hex')
  })

  it.each(SHAPES)(
    'a %s replaces the end, ending exactly at the length with the spell on its point',
    (crystalShape) => {
      for (const lengthCm of [28, 38]) {
        const spec = wand({ tipGem: 'crystal', crystalShape, lengthCm })
        expect(spec.lengthMm).toBe(lengthCm * 10)
        const mesh = crystalMesh(spec)!
        const zs = vertices(mesh.positions).map((v) => v[2]!)
        expect(Math.max(...zs)).toBeCloseTo(spec.lengthMm, 6)
        expect(Math.min(...zs)).toBeGreaterThanOrEqual(spec.crystal!.from - 1e-9)
        const tip = tipPose(spec)
        expect(tip.position).toEqual(mesh.point)
        expect(tip.position[2]).toBeCloseTo(spec.lengthMm, 6)
        expect(tip.direction).toEqual([0, 0, 1])
        expect(mesh.indices.every((i) => i < mesh.positions.length / 3)).toBe(true)
      }
    },
  )

  it.each(SHAPES)('a %s on a bent branch keeps the spell on its point', (crystalShape) => {
    const spec = wand({
      kind: 'branch',
      lengthCm: 38,
      bend: 1,
      wiggle: 1,
      tipGem: 'crystal',
      crystalShape,
    })
    const mesh = crystalMesh(spec)!
    const base = endPoses(spec).crystal!
    const length = spec.lengthMm - spec.crystal!.from
    const tip = tipPose(spec)
    expect(tip.position).toEqual(mesh.point)
    expect(tip.direction).toEqual(base.direction)
    // Nothing reaches past the point along the way the crystal stands.
    const reach = (v: number[]) =>
      dot(
        v.map((c, i) => c - base.position[i]!),
        base.direction,
      )
    expect(reach(mesh.point)).toBeCloseTo(length, 6)
    for (const v of vertices(mesh.positions)) expect(reach(v)).toBeLessThanOrEqual(length + 1e-9)
  })

  it.each(SHAPES)('a %s stands in its cup and stays a tip', (crystalShape) => {
    const spec = wand({ tipGem: 'crystal', crystalShape })
    const { radius, from } = spec.crystal!
    const mesh = crystalMesh(spec)!
    for (const [x, y, z] of vertices(mesh.positions)) {
      // Below the cup's rounded lip, the crystal is inside it.
      if (z! < spec.bodyTo - 1.2) expect(Math.hypot(x!, y!)).toBeLessThan(spec.profile(z!) + 1e-9)
      expect(Math.hypot(x!, y!)).toBeLessThan(2 * radius)
    }
    expect(from).toBeLessThan(spec.bodyTo)
  })

  it.each(SHAPES)('every face of a %s faces out, so none is culled', (crystalShape) => {
    for (const [radius, length] of [
      [4, 20],
      [5.67, 28.4],
      [6.53, 32.7],
    ])
      expect(inwardTriangles(crystalSolid(crystalShape, radius!, length!))).toBe(0)
  })

  it("a raw shard's broken top sits above the ring below it, so its sides never fold", () => {
    // The shard is five-sided: the base centre, four rings of five corners, then its point.
    const corners = vertices(crystalSolid('shard', 5.67, 28.4).positions)
    for (let i = 0; i < 5; i++) expect(corners[16 + i]![2]).toBeGreaterThan(corners[11 + i]![2]!)
  })

  it('each shape is its own, and the same every time', () => {
    const meshes = SHAPES.map((crystalShape) =>
      crystalMesh(wand({ tipGem: 'crystal', crystalShape })),
    )
    expect(crystalMesh(wand({ tipGem: 'crystal', crystalShape: 'shard' }))).toEqual(meshes[3])
    expect(new Set(meshes.map((m) => JSON.stringify(m!.positions))).size).toBe(SHAPES.length)
  })

  it('a wand without a crystal has no crystal mesh', () => {
    expect(crystalMesh(wand())).toBeNull()
  })

  it('Try another mostly gives the hex point', () => {
    const rng = seededRandom(9)
    const rolls = Array.from({ length: 2000 }, () => randomise(wandSchema, rng))
    const share = rolls.filter((p) => p.crystalShape === 'hex').length / rolls.length
    expect(share).toBeGreaterThan(0.5)
    expect(share).toBeLessThan(0.75)
  })
})
