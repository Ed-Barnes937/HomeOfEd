import { describe, expect, it } from 'vitest'

import { normalise, type Params, randomise, seededRandom } from '../engine/schema.ts'
import { bladePart, bladeSectionAt, bladeStations, centreLineAt, halfThicknessAt } from './blade.ts'
import { compileSword, type SwordSpec } from './compile.ts'
import { FAMILIES, type Family } from './families.ts'
import { inwardNormals, openEdges, signedVolume } from './sweep.ts'
import { swordSchema } from './swordSchema.ts'

const KINDS = Object.keys(FAMILIES) as Family[]
const PER_KIND = ['profile', 'middle', 'tip', 'ricasso'] as const
const BUDGET = 45_000
/** The tests that build every blade in the catalogue. */
const HEAVY = 60_000
const sword = (raw: Record<string, unknown>) => normalise(swordSchema, raw)

/** Every Kind with every allowed blade option and wave setting, its slider extremes, and 30 random swords. */
function catalogue(): { name: string; spec: SwordSpec }[] {
  const out: { name: string; p: Params }[] = []
  for (const family of KINDS) {
    const f = FAMILIES[family]
    for (const key of PER_KIND)
      for (const value of f[key])
        out.push({
          name: `${family} ${key} ${value}`,
          p: sword({ family, [key]: value, taper: value === 'rounded' ? 0.3 : 0.5 }),
        })
    for (const v of [0, 1])
      out.push({
        name: `${family} extremes ${v}`,
        p: sword({ family, bladeLength: v, bladeWidth: v, taper: v, curve: v, kissakiSize: v }),
      })
    if (f.waves)
      for (const waveCount of [4, 16])
        for (const middle of f.middle)
          out.push({
            name: `${family} flame ${waveCount} ${middle}`,
            p: sword({ family, waves: 'flame', waveCount, middle, bladeLength: 1 }),
          })
    const rng = seededRandom(2000 + family.length)
    for (let i = 0; i < 30; i++)
      out.push({
        name: `${family} random ${i}`,
        p: randomise(swordSchema, rng, { keep: { family }, locked: ['kind'] }),
      })
  }
  return out.map(({ name, p }) => ({ name, spec: compileSword(p) }))
}
const BLADES = catalogue()
const bladeOf = (raw: Record<string, unknown>) => compileSword(sword(raw)).blade

/** Each station's columns with their attributes, and the section at that station's straight z. */
const columnsOf = (spec: SwordSpec) =>
  bladeStations(spec).flatMap((s, j, all) => {
    const z = spec.blade.from - 1 + s.uvAlong
    const section = j < all.length - 1 ? bladeSectionAt(spec, z) : null
    return Array.from({ length: s.section.length / 2 }, (_, i) => ({
      z,
      section: section!,
      x: s.section[i * 2]!,
      y: s.section[i * 2 + 1]!,
      edge: s.attrs!.aEdge![i]!,
      fuller: s.attrs!.aFuller![i]!,
      along: s.attrs!.aAlong![i]!,
      shade: s.attrs!.aShade![i]!,
    }))
  })

describe('bladePart', () => {
  it(
    'is a sound closed solid within budget for every blade',
    () => {
      let worst = { ms: 0, name: '' }
      let most = { verts: 0, name: '' }
      for (const { name, spec } of BLADES) {
        const t0 = performance.now()
        const part = bladePart(spec)
        const ms = performance.now() - t0
        if (ms > worst.ms) worst = { ms, name }
        const verts = part.positions.length / 3
        if (verts > most.verts) most = { verts, name }
        expect(openEdges(part), name).toBe(0)
        expect(signedVolume(part), name).toBeGreaterThan(0)
        expect(inwardNormals(part), name).toBe(0)
        expect(verts, name).toBeLessThanOrEqual(BUDGET)
      }
      console.log(
        `blade: worst build ${worst.ms.toFixed(1)} ms (${worst.name}), most vertices ${most.verts} (${most.name})`,
      )
      expect(worst.ms).toBeLessThan(30)
    },
    HEAVY,
  )

  it(
    'builds the same bytes from the same spec',
    () => {
      for (const { spec } of BLADES.filter((_, i) => i % 9 === 0)) {
        const a = bladePart(spec)
        const b = bladePart(structuredClone(spec))
        expect(Buffer.from(a.positions.buffer).equals(Buffer.from(b.positions.buffer))).toBe(true)
        expect(Buffer.from(a.normals.buffer).equals(Buffer.from(b.normals.buffer))).toBe(true)
        expect(Buffer.from(a.indices.buffer).equals(Buffer.from(b.indices.buffer))).toBe(true)
      }
    },
    HEAVY,
  )

  it(
    'runs below the shoulder for the guard and closes to a point on the centre line',
    () => {
      for (const { name, spec } of BLADES) {
        const { positions } = bladePart(spec)
        let minZ = Infinity
        for (let k = 2; k < positions.length; k += 3) minZ = Math.min(minZ, positions[k]!)
        expect(minZ, name).toBeLessThanOrEqual(spec.blade.from - 0.5)
        const tip = bladeStations(spec).at(-1)!
        const line = centreLineAt(spec, spec.blade.to)
        expect(tip.section).toHaveLength(0)
        expect(tip.centre, name).toEqual([line.x, 0, line.z])
        let found = false
        for (let k = 0; k < positions.length && !found; k += 3)
          found =
            Math.abs(positions[k]! - line.x) < 1e-3 &&
            positions[k + 1] === 0 &&
            Math.abs(positions[k + 2]! - line.z) < 1e-3
        expect(found, name).toBe(true)
      }
    },
    HEAVY,
  )

  it(
    'lays uv in mm, along about the blade length',
    () => {
      for (const { name, spec } of BLADES) {
        const { uvs } = bladePart(spec)
        const B = spec.blade.to - spec.blade.from
        let maxAlong = 0
        let maxAcross = 0
        let minAlong = 0
        for (let k = 0; k < uvs.length; k += 2) {
          maxAcross = Math.max(maxAcross, Math.abs(uvs[k]!))
          maxAlong = Math.max(maxAlong, uvs[k + 1]!)
          minAlong = Math.min(minAlong, uvs[k + 1]!)
        }
        expect(minAlong, name).toBe(0)
        expect(maxAlong, name).toBeGreaterThan(B)
        expect(maxAlong, name).toBeLessThan(B * 1.15)
        expect(maxAcross, name).toBeGreaterThan(8)
        expect(maxAcross, name).toBeLessThan(60)
      }
    },
    HEAVY,
  )
})

describe('the thickness field', () => {
  it(
    'is positive everywhere, with no fuller deeper than 35% of the local half-thickness',
    () => {
      const thin: string[] = []
      const deep: string[] = []
      for (const { name, spec } of BLADES) {
        const { from, to } = spec.blade
        for (let z = from - 1; z < to; z += (to - from) / 97) {
          for (let s = -1; s <= 1.0001; s += 0.05)
            if (!(halfThicknessAt(spec, s, z) > 0.1)) thin.push(`${name} s ${s} z ${z}`)
          const section = bladeSectionAt(spec, z)
          for (let x = -section.back.width; x <= section.edge.width; x += 0.5) {
            const base = section.base(x)
            if (base - section.half(x) > 0.35 * base + 1e-9) deep.push(`${name} x ${x} z ${z}`)
          }
        }
      }
      expect(thin).toEqual([])
      expect(deep).toEqual([])
    },
    HEAVY,
  )

  it('ends in an edge flat, never a knife line, and peaks at the crest', () => {
    const spec = compileSword(sword({ family: 'knight', middle: 'flat' }))
    const z = spec.blade.from + 300
    expect(2 * halfThicknessAt(spec, 1, z)).toBeCloseTo(spec.blade.edgeFlat, 6)
    expect(2 * halfThicknessAt(spec, -1, z)).toBeCloseTo(spec.blade.edgeFlat, 6)
    const middle = halfThicknessAt(spec, 0, z)
    for (let s = -1; s <= 1; s += 0.1)
      expect(halfThicknessAt(spec, s, z)).toBeLessThanOrEqual(middle + 1e-9)
  })

  it('cuts the edge bevel steeper than the face, so it catches its own line of light', () => {
    for (const middle of ['flat', 'ridge']) {
      const spec = compileSword(sword({ family: 'longsword', middle }))
      const section = bladeSectionAt(spec, spec.blade.from + 250)
      const start = section.edge.width - section.edge.bevel
      const slope = (a: number, b: number) => (section.half(a) - section.half(b)) / (b - a)
      const bevel = slope(start + 0.5, section.edge.width - 0.1)
      const face = slope(start - 1, start - 0.3)
      expect(bevel, middle).toBeGreaterThan(1.5 * face)
      expect(face, middle).toBeGreaterThan(0)
    }
  })

  it('crowns flat faces by at least 0.2 mm across their width', () => {
    const spec = compileSword(sword({ family: 'sabre', middle: 'flat' }))
    const section = bladeSectionAt(spec, spec.blade.from + 200)
    const a = section.crest
    const b = section.edge.width - section.edge.bevel
    const chord = (section.half(a) + section.half(b)) / 2
    expect(section.half((a + b) / 2) - chord).toBeGreaterThanOrEqual(0.2 - 1e-9)
  })
})

describe('feature-aligned columns', () => {
  /** The section's columns on the top face at the station nearest z, as x. */
  const topColumns = (spec: SwordSpec, z: number) => {
    const stations = bladeStations(spec)
    const zOf = (s: (typeof stations)[number]) => spec.blade.from - 1 + s.uvAlong
    const s = stations.reduce((a, b) => (Math.abs(zOf(b) - z) < Math.abs(zOf(a) - z) ? b : a))
    const xs: number[] = []
    for (let i = 0; i < s.section.length / 2; i++)
      if (s.section[i * 2 + 1]! > 0) xs.push(s.section[i * 2]!)
    return { xs, z: zOf(s), count: s.section.length / 2 }
  }
  const hasCreaseAt = (xs: number[], x: number) => {
    expect(xs.some((c) => Math.abs(c - x) < 1e-3)).toBe(true)
    expect(xs.some((c) => c < x - 0.14 && c > x - 0.31)).toBe(true)
    expect(xs.some((c) => c > x + 0.14 && c < x + 0.31)).toBe(true)
  }

  it('puts a column and two supports on every crease: bevel start, ridge, fuller rims', () => {
    for (const raw of [
      { family: 'longsword', middle: 'ridge' },
      { family: 'knight', middle: 'groove2' },
      { family: 'longsword', middle: 'groove3' },
      { family: 'katana', middle: 'ridgeGroove' },
      { family: 'sabre', middle: 'groove1' },
    ]) {
      const spec = compileSword(sword(raw))
      const f = spec.blade.fullers[0]
      const { xs, z, count } = topColumns(
        spec,
        f ? (f.from + f.to - f.fade) / 2 : spec.blade.from + 250,
      )
      const section = bladeSectionAt(spec, z)
      hasCreaseAt(xs, section.edge.width - section.edge.bevel)
      if (spec.blade.edges === 'double') hasCreaseAt(xs, -section.back.width + section.back.bevel)
      if (raw.middle !== 'groove2' && raw.middle !== 'groove3') hasCreaseAt(xs, section.crest)
      for (const fuller of section.fullers) {
        hasCreaseAt(xs, fuller.x - fuller.rim)
        hasCreaseAt(xs, fuller.x + fuller.rim)
      }
      expect(count).toBeGreaterThanOrEqual(56)
      expect(count).toBeLessThanOrEqual(76)
    }
  })

  it('rings closer near the tip and the fuller ends than on plain stretches', () => {
    const spec = compileSword(sword({ family: 'greatsword', middle: 'groove1', bladeLength: 1 }))
    const zs = bladeStations(spec).map((s) => s.centre[2])
    const gapNear = (z: number) => {
      const i = zs.findIndex((v) => v >= z)
      return zs[i]! - zs[i - 1]!
    }
    const { from, to } = spec.blade
    const fuller = spec.blade.fullers[0]!
    expect(gapNear(to - 0.01)).toBeLessThanOrEqual(0.5)
    expect(gapNear(fuller.to)).toBeLessThanOrEqual(0.6)
    expect(gapNear(from + 0.01)).toBeLessThanOrEqual(0.6)
    const plain = gapNear((fuller.from + fuller.to) / 2 - 100)
    expect(plain).toBeGreaterThanOrEqual(2)
    expect(plain).toBeLessThanOrEqual(4)
  })
})

describe('attributes', () => {
  it(
    'stay in 0-1, with aEdge only on the bevel and aFuller only inside a fuller',
    () => {
      const bad: string[] = []
      for (const { name, spec } of BLADES.filter((_, i) => i % 3 === 0)) {
        for (const c of columnsOf(spec)) {
          if ([c.edge, c.fuller, c.along, c.shade].some((v) => !(v >= 0 && v <= 1)))
            bad.push(`${name} out of range at ${c.x}, ${c.z}`)
          const { section } = c
          if (c.edge > 0) {
            const onEdge = c.x >= section.crest
            const fromEnd = onEdge ? section.edge.width - c.x : c.x + section.back.width
            const bevel = onEdge ? section.edge.bevel : section.back.bevel
            if (fromEnd > bevel + 1e-4) bad.push(`${name} aEdge at ${c.x}, ${c.z}`)
          }
          if (c.fuller > 0 && !section.fullers.some((f) => Math.abs(c.x - f.x) <= f.rim + 1e-4))
            bad.push(`${name} aFuller at ${c.x}, ${c.z}`)
        }
      }
      expect(bad).toEqual([])
    },
    HEAVY,
  )

  it('marks the bevel, the fuller floor, the run from shoulder to tip and the shoulder shade', () => {
    const spec = compileSword(sword({ family: 'knight', middle: 'groove1' }))
    const cols = columnsOf(spec)
    const f = spec.blade.fullers[0]!
    const mid = (f.from + f.to - f.fade) / 2
    const at = (z: number) => cols.filter((c) => Math.abs(c.z - z) < 2)
    expect(at(mid).some((c) => c.edge === 1)).toBe(true)
    expect(at(mid).some((c) => c.fuller === 1)).toBe(true)
    expect(Math.max(...cols.map((c) => c.along))).toBeGreaterThan(0.999)
    expect(Math.max(...bladePart(spec).attrs.aAlong!)).toBe(1)
    expect(Math.min(...cols.map((c) => c.along))).toBe(0)
    expect(Math.min(...at(spec.blade.from).map((c) => c.shade))).toBeLessThan(0.8)
    expect(Math.min(...at(mid).map((c) => c.shade))).toBe(1)
  })
})

describe('the curve', () => {
  it('starts straight at the shoulder and bends toward the spine', () => {
    for (const family of ['sabre', 'katana'] as const) {
      const spec = compileSword(sword({ family, curve: 1 }))
      const start = centreLineAt(spec, spec.blade.from)
      expect(start.x).toBe(0)
      expect(start.angle).toBe(0)
      expect(centreLineAt(spec, spec.blade.from + 1).angle).toBeLessThan(2e-3)
      expect(centreLineAt(spec, spec.blade.to).x).toBeLessThan(0)
    }
  })

  it.each([0, 0.5, 1])(
    'reaches its depth off the shoulder-to-tip chord at its peak (curve %s)',
    (curve) => {
      for (const family of ['sabre', 'katana'] as const) {
        const spec = compileSword(sword({ family, curve }))
        const { from, to } = spec.blade
        const { depthMm, peak } = spec.blade.curve!
        const tip = centreLineAt(spec, to)
        const cz = tip.z - from
        const len = Math.hypot(tip.x, cz)
        let deepest = 0
        let at = 0
        for (let z = from; z <= to; z += 0.5) {
          const p = centreLineAt(spec, z)
          const sag = Math.abs(p.x * cz - (p.z - from) * tip.x) / len
          if (sag > deepest) [deepest, at] = [sag, (z - from) / (to - from)]
        }
        expect(deepest).toBeCloseTo(depthMm, 1)
        expect(Math.abs(at - peak)).toBeLessThan(0.01)
      }
    },
  )

  it('keeps the blade its length along the curve, so steel and fullers never stretch', () => {
    const spec = compileSword(sword({ family: 'sabre', curve: 1, bladeLength: 1 }))
    const stations = bladeStations(spec)
    let along = 0
    for (let i = 1; i < stations.length; i++) {
      const [a, b] = [stations[i - 1]!.centre, stations[i]!.centre]
      along += Math.hypot(b[0] - a[0], b[2] - a[2])
      expect(stations[i]!.uvAlong - stations[i - 1]!.uvAlong).toBeCloseTo(
        Math.hypot(b[0] - a[0], b[2] - a[2]),
        2,
      )
    }
    const B = spec.blade.to - spec.blade.from
    expect(along).toBeCloseTo(B + 1, 1)
    const tip = centreLineAt(spec, spec.blade.to)
    const chord = Math.hypot(tip.x, tip.z - spec.blade.from)
    expect(chord).toBeLessThan(B)
    expect(chord).toBeGreaterThan(0.9 * B)
  })

  it(
    'never bends tighter than twice the local half-width, so the inside never folds',
    () => {
      for (const { name, spec } of BLADES.filter(({ spec }) => spec.blade.curve)) {
        const { from, to } = spec.blade
        for (let z = from; z < to; z += 2) {
          const { curvature } = centreLineAt(spec, z)
          const s = bladeSectionAt(spec, z)
          expect(curvature * 2 * Math.max(s.edge.width, s.back.width), `${name} ${z}`).toBeLessThan(
            1,
          )
        }
      }
    },
    HEAVY,
  )

  it('keeps straight Kinds straight', () => {
    expect(bladeOf({ family: 'longsword' }).curve).toBeNull()
    const spec = compileSword(sword({ family: 'longsword' }))
    expect(centreLineAt(spec, spec.blade.to)).toEqual({
      x: 0,
      z: spec.blade.to,
      angle: 0,
      curvature: 0,
    })
  })
})
