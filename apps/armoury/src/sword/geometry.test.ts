import { afterAll, describe, expect, it } from 'vitest'

import {
  allowedOptions,
  type ChoiceParam,
  isVisible,
  normalise,
  type Params,
  randomise,
  seededRandom,
} from '../engine/schema.ts'
import { bladePart } from './blade.ts'
import { compileSword, type SwordSpec } from './compile.ts'
import { FAMILIES, type Family } from './families.ts'
import { buildSwordMesh, reach, swordGemPoses, tipPose } from './geometry.ts'
import { gripPart, guardPart, pommelPart } from './hilt.ts'
import { swordOutline } from './outline.ts'
import { computeNormals, inwardNormals, type MeshPart, openEdges, signedVolume } from './sweep.ts'
import { swordSchema } from './swordSchema.ts'

const KINDS = Object.keys(FAMILIES) as Family[]
const HILT = [
  'guard',
  'guardEnds',
  'discShape',
  'langets',
  'wrap',
  'gripShape',
  'pommel',
  'gems',
  'gemCut',
]
const PARTS = ['blade', 'fittings', 'grip'] as const
const sword = (raw: Record<string, unknown>) => normalise(swordSchema, raw)
const verts = (p: MeshPart) => p.positions.length / 3
const CHOICES = swordSchema.params.filter(
  (d): d is ChoiceParam => d.kind === 'choice' && HILT.includes(d.key),
)
const GEMS = CHOICES.find((d) => d.key === 'gems')!

/**
 * Each Kind with sword i taking option i of every hilt choice it allows (sword 0 is its signature),
 * the most gems that fit and its hilt sliders at most then least, its slider extremes with a gem in
 * the pommel then the guard, its heaviest (most waves, every size at most, corded), and 3 random swords.
 */
function catalogue(): { name: string; family: Family; p: Params; spec: SwordSpec }[] {
  const out: { name: string; family: Family; p: Params }[] = []
  for (const family of KINDS) {
    const f = FAMILIES[family]
    const base = sword({ family })
    const cycled = CHOICES.filter((def) => def !== GEMS)
    const options = cycled.map(
      (def) => [def.key, allowedOptions(def, base).map((o) => o.value)] as const,
    )
    const n = Math.max(
      ...cycled.map((def, k) => (isVisible(def, base) ? options[k]![1].length : 1)),
    )
    out.push({ name: `${family} signature`, family, p: base })
    for (let i = 1; i < n; i++) {
      const size = i % 2
      const picked = sword({
        ...Object.fromEntries(
          options.map(([key, values]) => [key, values[i % values.length]] as const),
        ),
        family,
        gripLength: size,
        pommelSize: size,
        guardWidth: size,
      })
      const gems = allowedOptions(GEMS, picked).at(-1)!.value
      out.push({ name: `${family} hilt ${i}`, family, p: sword({ ...picked, gems }) })
    }
    for (const v of [0, 1])
      out.push({
        name: `${family} extremes ${v}`,
        family,
        p: sword({
          family,
          bladeLength: v,
          bladeWidth: v,
          gripLength: v,
          pommelSize: v,
          guardWidth: v,
          curve: v,
          gems: v ? 'guard' : 'pommel',
        }),
      })
    if (f.waves)
      out.push({
        name: `${family} heaviest`,
        family,
        p: sword({
          family,
          waves: 'flame',
          waveCount: 16,
          bladeLength: 1,
          bladeWidth: 1,
          gripLength: 1,
          pommelSize: 1,
          guardWidth: 1,
          wrap: 'cord',
        }),
      })
    const rng = seededRandom(3000 + family.length)
    for (let i = 0; i < 3; i++)
      out.push({
        name: `${family} random ${i}`,
        family,
        p: randomise(swordSchema, rng, { keep: { family }, locked: ['kind'] }),
      })
  }
  return out.map((s) => ({ ...s, spec: compileSword(s.p) }))
}
const SWORDS = catalogue()

function outOfRange(part: MeshPart): string | null {
  for (const [key, values] of Object.entries(part.attrs))
    for (const v of values) if (!(v >= 0 && v <= 1)) return `${key} ${v}`
  for (const v of part.uvs) if (!Number.isFinite(v)) return `uv ${v}`
  return null
}

/** What the tests need from each catalogue sword, built once. */
interface Facts {
  ms: number
  parts: Record<
    (typeof PARTS)[number],
    { open: number; volume: number; inward: number; outOfRange: string | null; verts: number }
  >
  /** The blade vertex furthest along z, as x and z. */
  apex: [number, number]
  /** The first vertex outside reach, or null. */
  outsideReach: string | null
  /** Widest |x| of the mesh and of the outline across the guard, and across the pommel. */
  guardFit: [mesh: number, line: number]
  pommelFit: [mesh: number, line: number]
  /** The lowest z of the fittings. */
  fittingsEnd: number
}
const facts = new Map<SwordSpec, Facts>()
function factsOf(spec: SwordSpec): Facts {
  const known = facts.get(spec)
  if (known) return known
  const t0 = performance.now()
  const mesh = buildSwordMesh(spec)
  const ms = performance.now() - t0
  const parts = Object.fromEntries(
    PARTS.map((key) => {
      const part = mesh[key]
      return [
        key,
        {
          open: openEdges(part),
          volume: signedVolume(part),
          inward: inwardNormals(part),
          outOfRange: outOfRange(part),
          verts: verts(part),
        },
      ]
    }),
  ) as Facts['parts']
  const p = mesh.blade.positions
  let apex = 0
  for (let v = 0; v < p.length / 3; v++) if (p[v * 3 + 2]! > p[apex * 3 + 2]!) apex = v
  const [rx, ry] = reach(spec)
  let outsideReach: string | null = null
  for (const part of [mesh.blade, mesh.fittings, mesh.grip])
    for (let k = 0; k < part.positions.length && !outsideReach; k += 3) {
      if (Math.abs(part.positions[k]!) > rx) outsideReach = `x ${part.positions[k]} > ${rx}`
      else if (Math.abs(part.positions[k + 1]!) > ry)
        outsideReach = `y ${part.positions[k + 1]} > ${ry}`
    }
  const outline = swordOutline(spec).flat()
  const fit = (z0: number, z1: number): [number, number] => {
    let widest = 0
    let line = 0
    for (const part of [mesh.fittings, mesh.grip, mesh.blade]) {
      const q = part.positions
      for (let k = 0; k < q.length; k += 3)
        if (q[k + 2]! >= z0 && q[k + 2]! <= z1) widest = Math.max(widest, Math.abs(q[k]!))
    }
    for (const [z, y] of outline) if (z >= z0 && z <= z1) line = Math.max(line, Math.abs(y))
    return [widest, line]
  }
  const g = spec.guard
  let fittingsEnd = Infinity
  for (let k = 2; k < mesh.fittings.positions.length; k += 3)
    fittingsEnd = Math.min(fittingsEnd, mesh.fittings.positions[k]!)
  const out: Facts = {
    ms,
    parts,
    apex: [p[apex * 3]!, p[apex * 3 + 2]!],
    outsideReach,
    guardFit: fit(Math.min(g.from, g.from + g.sweep) - 30, Math.max(g.to, g.to + g.sweep) + 30),
    pommelFit: fit(-5, spec.pommel.to),
    fittingsEnd,
  }
  facts.set(spec, out)
  return out
}

describe('buildSwordMesh', () => {
  it('is built for every hilt option a Kind shows on its signature sword', () => {
    const missing: string[] = []
    for (const def of CHOICES)
      for (const family of KINDS)
        for (const { value } of allowedOptions(def, sword({ family }))) {
          const shown = sword({ family, [def.key]: value })
          if (shown[def.key] !== value || !isVisible(def, shown)) continue
          if (!SWORDS.some(({ p }) => p[def.key] === value && isVisible(def, p)))
            missing.push(`${def.key} ${value}`)
        }
    expect([...new Set(missing)]).toEqual([])
  })

  it.each(SWORDS)('builds $name as three sound closed solids within budget', ({ name, spec }) => {
    const f = factsOf(spec)
    for (const key of PARTS) {
      const part = f.parts[key]
      expect(part.open, `${name} ${key} open edges`).toBe(0)
      expect(part.volume, `${name} ${key} volume`).toBeGreaterThan(0)
      expect(part.inward, `${name} ${key} normals`).toBe(0)
      expect(part.outOfRange, `${name} ${key}`).toBeNull()
    }
    const total = f.parts.blade.verts + f.parts.fittings.verts + f.parts.grip.verts
    expect(f.parts.blade.verts, name).toBeLessThanOrEqual(45_000)
    expect(f.parts.fittings.verts, name).toBeLessThanOrEqual(35_000)
    expect(f.parts.grip.verts, name).toBeLessThanOrEqual(45_000)
    expect(total, name).toBeLessThanOrEqual(120_000)
  })

  afterAll(() => {
    const built = [...facts.values()]
    if (built.length === 0) return
    const ms = built.map((f) => f.ms).sort((a, b) => a - b)
    const most = (count: (f: Facts) => number) => Math.max(...built.map(count))
    const vertices = {
      ...Object.fromEntries(PARTS.map((key) => [key, most((f) => f.parts[key].verts)])),
      total: most((f) => PARTS.reduce((n, key) => n + f.parts[key].verts, 0)),
    }
    console.log(
      `whole sword build (${built.length} swords): median ${ms[ms.length >> 1]!.toFixed(1)} ms, worst ${ms.at(-1)!.toFixed(1)} ms, most vertices ${JSON.stringify(vertices)}`,
    )
  })

  it('is the same bytes for the same params', () => {
    const same = (a: Float32Array, b: Float32Array) =>
      Buffer.from(a.buffer).equals(Buffer.from(b.buffer))
    for (const family of KINDS) {
      const spec = compileSword(sword({ family, gems: 'both' }))
      const a = buildSwordMesh(spec)
      const b = buildSwordMesh(compileSword(sword({ family, gems: 'both' })))
      for (const key of PARTS) {
        expect(same(a[key].positions, b[key].positions), `${family} ${key} positions`).toBe(true)
        expect(same(a[key].normals, b[key].normals), `${family} ${key} normals`).toBe(true)
      }
    }
  })

  it('puts the pommel end and the tip on the axis, and everything inside reach', () => {
    for (const { name, spec } of SWORDS) {
      const f = factsOf(spec)
      const tip = tipPose(spec)
      expect(Math.abs(tip.position[0]), name).toBeLessThan(1e-6)
      expect(tip.position[1]).toBe(0)
      expect(Math.abs(f.apex[0]), `${name} tip x`).toBeLessThan(1e-3)
      expect(f.apex[1], `${name} tip z`).toBeCloseTo(tip.position[2], 3)
      expect(f.outsideReach, name).toBeNull()
    }
  })
  it('turns a curved blade with its exact normals, never recomputing them', () => {
    const spec = compileSword(sword({ family: 'sabre', curve: 1 }))
    const straight = bladePart(spec)
    const turned = buildSwordMesh(spec).blade
    const tip = tipPose(spec).position
    expect(tip[2]).toBeLessThan(spec.lengthMm)
    const recomputed = { ...turned, normals: new Float32Array(turned.normals.length) }
    computeNormals(recomputed)
    let differs = 0
    const n = straight.normals
    for (let k = 0; k < n.length; k += 3) {
      // Rotation about y keeps each normal's y and its length in x-z.
      expect(turned.normals[k + 1]).toBeCloseTo(n[k + 1]!, 6)
      expect(Math.hypot(turned.normals[k]!, turned.normals[k + 2]!)).toBeCloseTo(
        Math.hypot(n[k]!, n[k + 2]!),
        5,
      )
      const d = Math.hypot(
        recomputed.normals[k]! - turned.normals[k]!,
        recomputed.normals[k + 1]! - turned.normals[k + 1]!,
        recomputed.normals[k + 2]! - turned.normals[k + 2]!,
      )
      if (d > 0.05) differs++
    }
    expect(differs).toBeGreaterThan(100)
    // The same rigid turn maps every straight position and normal onto the built ones.
    const p = straight.positions
    const q = turned.positions
    const [c, s] = (() => {
      const a = Math.atan2(q[2]! - 0, q[0]!) - Math.atan2(p[2]!, p[0]!)
      return [Math.cos(a), Math.sin(a)]
    })()
    for (let k = 0; k < p.length; k += 3 * 97) {
      expect(q[k]).toBeCloseTo(p[k]! * c - p[k + 2]! * s, 2)
      expect(turned.normals[k]).toBeCloseTo(n[k]! * c - n[k + 2]! * s, 4)
      expect(turned.normals[k + 2]).toBeCloseTo(n[k]! * s + n[k + 2]! * c, 4)
    }
  })
})

describe('the hilt', () => {
  it.each(KINDS)('overlaps its junctions by at least half a millimetre on every %s', (family) => {
    for (const { name, spec } of SWORDS.filter((s) => s.family === family)) {
      const blade = bladePart(spec)
      let minBlade = Infinity
      for (let k = 2; k < blade.positions.length; k += 3)
        minBlade = Math.min(minBlade, blade.positions[k]!)
      expect(minBlade, `${name} blade into guard`).toBeLessThanOrEqual(spec.blade.from - 0.5)
      const grip = gripPart(spec)
      let [lo, hi] = [Infinity, -Infinity]
      for (let k = 2; k < grip.positions.length; k += 3) {
        lo = Math.min(lo, grip.positions[k]!)
        hi = Math.max(hi, grip.positions[k]!)
      }
      expect(lo, `${name} grip into pommel`).toBeLessThanOrEqual(spec.pommel.to - 0.5)
      expect(hi, `${name} grip into guard`).toBeGreaterThanOrEqual(spec.guard.from + 0.5)
    }
  })

  it('seats each gem on its part, facing out, and none without a seat', () => {
    for (const { name, spec } of SWORDS) {
      const poses = swordGemPoses(spec)
      expect(poses.length, name).toBe(spec.gems.length)
      if (spec.blade.curve || poses.length === 0) continue
      for (const pose of poses) {
        const host = pose.at === 'pommel' ? pommelPart(spec) : guardPart(spec)
        // Nudged off the exact centre, where a ray would graze the vertex every face shares.
        const from = pose.position.map((v, i) => v + pose.normal[i]! * 20 + 0.013 * (i + 1)) as [
          number,
          number,
          number,
        ]
        const back = pose.normal.map((v) => -v) as [number, number, number]
        const hit = firstHit(host, from, back)
        expect(hit, `${name} ${pose.at}`).not.toBeNull()
        expect(Math.abs(hit! - 20), `${name} ${pose.at} on the surface`).toBeLessThan(0.6)
      }
    }
  })
})

describe('swordOutline against the mesh', () => {
  it('matches the silhouette within 1 mm at the guard ends, the tip and the pommel', () => {
    for (const { name, spec } of SWORDS) {
      const f = factsOf(spec)
      const outline = swordOutline(spec).flat()
      const [gm, gl] = f.guardFit
      expect(Math.abs(gm - gl), `${name} guard ends`).toBeLessThan(1)
      const [pm, pl] = f.pommelFit
      expect(Math.abs(pm - pl), `${name} pommel`).toBeLessThan(1)
      const tip = Math.max(...outline.map(([z]) => z))
      expect(Math.abs(tip - tipPose(spec).position[2]), `${name} tip`).toBeLessThan(1)
      const pommelEnd = Math.min(...outline.map(([z]) => z))
      expect(Math.abs(pommelEnd - f.fittingsEnd), `${name} pommel end`).toBeLessThan(1)
    }
  })
})

/** Distance along a ray to the first triangle of a part it meets, or null. */
function firstHit(
  part: MeshPart,
  o: [number, number, number],
  d: [number, number, number],
): number | null {
  const p = part.positions
  const ix = part.indices
  let best: number | null = null
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t]! * 3
    const b = ix[t + 1]! * 3
    const c = ix[t + 2]! * 3
    const e1 = [p[b]! - p[a]!, p[b + 1]! - p[a + 1]!, p[b + 2]! - p[a + 2]!]
    const e2 = [p[c]! - p[a]!, p[c + 1]! - p[a + 1]!, p[c + 2]! - p[a + 2]!]
    const h = [
      d[1] * e2[2]! - d[2] * e2[1]!,
      d[2] * e2[0]! - d[0] * e2[2]!,
      d[0] * e2[1]! - d[1] * e2[0]!,
    ]
    const det = e1[0]! * h[0]! + e1[1]! * h[1]! + e1[2]! * h[2]!
    if (Math.abs(det) < 1e-12) continue
    const s = [o[0] - p[a]!, o[1] - p[a + 1]!, o[2] - p[a + 2]!]
    const u = (s[0]! * h[0]! + s[1]! * h[1]! + s[2]! * h[2]!) / det
    if (u < 0 || u > 1) continue
    const q = [
      s[1]! * e1[2]! - s[2]! * e1[1]!,
      s[2]! * e1[0]! - s[0]! * e1[2]!,
      s[0]! * e1[1]! - s[1]! * e1[0]!,
    ]
    const v = (d[0] * q[0]! + d[1] * q[1]! + d[2] * q[2]!) / det
    if (v < 0 || u + v > 1) continue
    const dist = (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) / det
    if (dist > 0 && (best === null || dist < best)) best = dist
  }
  return best
}
