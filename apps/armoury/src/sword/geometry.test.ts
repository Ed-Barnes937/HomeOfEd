import { describe, expect, it } from 'vitest'

import {
  allowedOptions,
  type ChoiceParam,
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
const HILT = ['guard', 'guardEnds', 'discShape', 'langets', 'wrap', 'gripShape', 'pommel', 'gems', 'gemCut']
/** Tests that build hundreds of whole swords. */
const HEAVY = 120_000
const sword = (raw: Record<string, unknown>) => normalise(swordSchema, raw)
const verts = (p: MeshPart) => p.positions.length / 3

/** Every Kind with each allowed hilt option, gem seats on every pommel and guard, slider extremes, and 30 random swords. */
function catalogue(): { name: string; spec: SwordSpec }[] {
  const out: { name: string; p: Params }[] = []
  const choices = swordSchema.params.filter(
    (d): d is ChoiceParam => d.kind === 'choice' && HILT.includes(d.key),
  )
  for (const family of KINDS) {
    const f = FAMILIES[family]
    const base = sword({ family })
    for (const def of choices)
      for (const { value } of allowedOptions(def, base))
        out.push({ name: `${family} ${def.key} ${value}`, p: sword({ family, [def.key]: value }) })
    for (const guard of f.guard)
      for (const pommel of f.pommel)
        out.push({
          name: `${family} ${guard} ${pommel} gems`,
          p: sword({ family, guard, pommel, gems: 'both', gemCut: pommel.length % 2 ? 'marquise' : 'square' }),
        })
    for (const v of [0, 1])
      out.push({
        name: `${family} extremes ${v}`,
        p: sword({ family, bladeLength: v, bladeWidth: v, gripLength: v, pommelSize: v, guardWidth: v, curve: v }),
      })
    if (f.waves)
      out.push({ name: `${family} flame`, p: sword({ family, waves: 'flame', waveCount: 16, bladeLength: 1 }) })
    const rng = seededRandom(3000 + family.length)
    for (let i = 0; i < 30; i++)
      out.push({
        name: `${family} random ${i}`,
        p: randomise(swordSchema, rng, { keep: { family }, locked: ['kind'] }),
      })
  }
  return out.map(({ name, p }) => ({ name, spec: compileSword(p) }))
}
const SWORDS = catalogue()

function inRange(part: MeshPart, name: string) {
  for (const [key, values] of Object.entries(part.attrs))
    for (const v of values) {
      if (!(v >= 0 && v <= 1)) throw new Error(`${name}: ${key} ${v}`)
    }
  for (const v of part.uvs) if (!Number.isFinite(v)) throw new Error(`${name}: uv ${v}`)
}

describe('buildSwordMesh', () => {
  it(
    'builds every sword as three sound closed solids within budget',
    () => {
      const times: Record<string, number[]> = {}
      const most = { blade: 0, fittings: 0, grip: 0, total: 0 }
      for (const { name, spec } of SWORDS) {
        const t0 = performance.now()
        const mesh = buildSwordMesh(spec)
        ;(times[spec.family] ??= []).push(performance.now() - t0)
        for (const key of ['blade', 'fittings', 'grip'] as const) {
          const part = mesh[key]
          expect(openEdges(part), `${name} ${key} open edges`).toBe(0)
          expect(signedVolume(part), `${name} ${key} volume`).toBeGreaterThan(0)
          expect(inwardNormals(part), `${name} ${key} normals`).toBe(0)
          inRange(part, `${name} ${key}`)
          most[key] = Math.max(most[key], verts(part))
        }
        const total = verts(mesh.blade) + verts(mesh.fittings) + verts(mesh.grip)
        most.total = Math.max(most.total, total)
        expect(verts(mesh.blade), name).toBeLessThanOrEqual(45_000)
        expect(verts(mesh.fittings), name).toBeLessThanOrEqual(35_000)
        expect(verts(mesh.grip), name).toBeLessThanOrEqual(45_000)
        expect(total, name).toBeLessThanOrEqual(120_000)
      }
      const summary = Object.entries(times).map(([family, t]) => {
        const sorted = [...t].sort((a, b) => a - b)
        return `${family} median ${sorted[sorted.length >> 1]!.toFixed(1)} ms, worst ${sorted.at(-1)!.toFixed(1)} ms`
      })
      console.log(`whole sword build (${SWORDS.length} swords):\n  ${summary.join('\n  ')}\n  most vertices ${JSON.stringify(most)}`)
    },
    HEAVY,
  )

  it('is the same bytes for the same params', { timeout: HEAVY }, () => {
    for (const family of KINDS) {
      const spec = compileSword(sword({ family, gems: 'both' }))
      const a = buildSwordMesh(spec)
      const b = buildSwordMesh(compileSword(sword({ family, gems: 'both' })))
      for (const key of ['blade', 'fittings', 'grip'] as const) {
        expect(Buffer.from(a[key].positions.buffer)).toEqual(Buffer.from(b[key].positions.buffer))
        expect(Buffer.from(a[key].normals.buffer)).toEqual(Buffer.from(b[key].normals.buffer))
      }
    }
  })

  it(
    'puts the pommel end and the tip on the axis, and everything inside reach',
    () => {
      for (const { name, spec } of SWORDS) {
        const mesh = buildSwordMesh(spec)
        const tip = tipPose(spec)
        expect(Math.abs(tip.position[0]), name).toBeLessThan(1e-6)
        expect(tip.position[1]).toBe(0)
        const p = mesh.blade.positions
        let apex = 0
        for (let v = 0; v < p.length / 3; v++) if (p[v * 3 + 2]! > p[apex * 3 + 2]!) apex = v
        expect(Math.abs(p[apex * 3]!), `${name} tip x`).toBeLessThan(1e-3)
        expect(p[apex * 3 + 2]!, `${name} tip z`).toBeCloseTo(tip.position[2], 3)
        const [rx, ry] = reach(spec)
        for (const part of [mesh.blade, mesh.fittings, mesh.grip])
          for (let k = 0; k < part.positions.length; k += 3) {
            if (Math.abs(part.positions[k]!) > rx) throw new Error(`${name} x ${part.positions[k]} > ${rx}`)
            if (Math.abs(part.positions[k + 1]!) > ry) throw new Error(`${name} y ${part.positions[k + 1]} > ${ry}`)
          }
      }
    },
    HEAVY,
  )

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
      expect(Math.hypot(turned.normals[k]!, turned.normals[k + 2]!)).toBeCloseTo(Math.hypot(n[k]!, n[k + 2]!), 5)
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
  it('overlaps its junctions by at least half a millimetre', { timeout: HEAVY }, () => {
    for (const { name, spec } of SWORDS) {
      const blade = bladePart(spec)
      let minBlade = Infinity
      for (let k = 2; k < blade.positions.length; k += 3) minBlade = Math.min(minBlade, blade.positions[k]!)
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

  it('seats each gem on its part, facing out, and none without a seat', { timeout: HEAVY }, () => {
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
  it('matches the silhouette within 1 mm at the guard ends, the tip and the pommel', { timeout: HEAVY }, () => {
    for (const { name, spec } of SWORDS.filter((_, i) => i % 3 === 0)) {
      const mesh = buildSwordMesh(spec)
      const outline = swordOutline(spec).flat()
      const fit = (z0: number, z1: number): [number, number] => {
        let mesh = 0
        let line = 0
        for (const part of [meshOf.fittings, meshOf.grip, meshOf.blade]) {
          const p = part.positions
          for (let k = 0; k < p.length; k += 3)
            if (p[k + 2]! >= z0 && p[k + 2]! <= z1) mesh = Math.max(mesh, Math.abs(p[k]!))
        }
        for (const [z, y] of outline) if (z >= z0 && z <= z1) line = Math.max(line, Math.abs(y))
        return [mesh, line]
      }
      const meshOf = mesh
      const g = spec.guard
      const [gm, gl] = fit(Math.min(g.from, g.from + g.sweep) - 30, Math.max(g.to, g.to + g.sweep) + 30)
      expect(Math.abs(gm - gl), `${name} guard ends`).toBeLessThan(1)
      const [pm, pl] = fit(-5, spec.pommel.to)
      expect(Math.abs(pm - pl), `${name} pommel`).toBeLessThan(1)
      const tip = Math.max(...outline.map(([z]) => z))
      expect(Math.abs(tip - tipPose(spec).position[2]), `${name} tip`).toBeLessThan(1)
      const pommelEnd = Math.min(...outline.map(([z]) => z))
      let meshEnd = Infinity
      for (let k = 2; k < mesh.fittings.positions.length; k += 3)
        meshEnd = Math.min(meshEnd, mesh.fittings.positions[k]!)
      expect(Math.abs(pommelEnd - meshEnd), `${name} pommel end`).toBeLessThan(1)
    }
  })
})

/** Distance along a ray to the first triangle of a part it meets, or null. */
function firstHit(part: MeshPart, o: [number, number, number], d: [number, number, number]): number | null {
  const p = part.positions
  const ix = part.indices
  let best: number | null = null
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t]! * 3
    const b = ix[t + 1]! * 3
    const c = ix[t + 2]! * 3
    const e1 = [p[b]! - p[a]!, p[b + 1]! - p[a + 1]!, p[b + 2]! - p[a + 2]!]
    const e2 = [p[c]! - p[a]!, p[c + 1]! - p[a + 1]!, p[c + 2]! - p[a + 2]!]
    const h = [d[1] * e2[2]! - d[2] * e2[1]!, d[2] * e2[0]! - d[0] * e2[2]!, d[0] * e2[1]! - d[1] * e2[0]!]
    const det = e1[0]! * h[0]! + e1[1]! * h[1]! + e1[2]! * h[2]!
    if (Math.abs(det) < 1e-12) continue
    const s = [o[0] - p[a]!, o[1] - p[a + 1]!, o[2] - p[a + 2]!]
    const u = (s[0]! * h[0]! + s[1]! * h[1]! + s[2]! * h[2]!) / det
    if (u < 0 || u > 1) continue
    const q = [s[1]! * e1[2]! - s[2]! * e1[1]!, s[2]! * e1[0]! - s[0]! * e1[2]!, s[0]! * e1[1]! - s[1]! * e1[0]!]
    const v = (d[0] * q[0]! + d[1] * q[1]! + d[2] * q[2]!) / det
    if (v < 0 || u + v > 1) continue
    const dist = (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) / det
    if (dist > 0 && (best === null || dist < best)) best = dist
  }
  return best
}
