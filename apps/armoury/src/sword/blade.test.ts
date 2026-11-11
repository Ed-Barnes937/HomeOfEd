import { describe, expect, it } from 'vitest'

import { normalise, type Params, randomise, seededRandom } from '../engine/schema.ts'
import { bladePart, bladeSectionAt, bladeStations, centreLineAt, halfThicknessAt } from './blade.ts'
import { compileSword, type SwordSpec } from './compile.ts'
import { sample } from './curve.ts'
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

/** What the tests need from each catalogue blade, built once. */
interface Facts {
  verts: number
  ms: number
  open: number
  volume: number
  inward: number
  minZ: number
  tipOnLine: boolean
  minAlong: number
  maxAlong: number
  maxAcross: number
}
const facts = new Map<SwordSpec, Facts>()
function factsOf(spec: SwordSpec): Facts {
  const known = facts.get(spec)
  if (known) return known
  const t0 = performance.now()
  const part = bladePart(spec)
  const ms = performance.now() - t0
  const { positions: p, uvs } = part
  const line = centreLineAt(spec, spec.blade.to)
  let minZ = Infinity
  let tipOnLine = false
  for (let k = 0; k < p.length; k += 3) {
    minZ = Math.min(minZ, p[k + 2]!)
    if (Math.abs(p[k]! - line.x) < 1e-3 && p[k + 1] === 0 && Math.abs(p[k + 2]! - line.z) < 1e-3)
      tipOnLine = true
  }
  let [minAlong, maxAlong, maxAcross] = [Infinity, 0, 0]
  for (let k = 0; k < uvs.length; k += 2) {
    maxAcross = Math.max(maxAcross, Math.abs(uvs[k]!))
    maxAlong = Math.max(maxAlong, uvs[k + 1]!)
    minAlong = Math.min(minAlong, uvs[k + 1]!)
  }
  const out: Facts = {
    verts: p.length / 3,
    ms,
    open: openEdges(part),
    volume: signedVolume(part),
    inward: inwardNormals(part),
    minZ,
    tipOnLine,
    minAlong,
    maxAlong,
    maxAcross,
  }
  facts.set(spec, out)
  return out
}

describe('bladePart', () => {
  it(
    'is a sound closed solid within budget for every blade',
    () => {
      let worst = { ms: 0, name: '' }
      let most = { verts: 0, name: '' }
      for (const { name, spec } of BLADES) {
        const f = factsOf(spec)
        if (f.ms > worst.ms) worst = { ms: f.ms, name }
        if (f.verts > most.verts) most = { verts: f.verts, name }
        expect(f.open, name).toBe(0)
        expect(f.volume, name).toBeGreaterThan(0)
        expect(f.inward, name).toBe(0)
        expect(f.verts, name).toBeLessThanOrEqual(BUDGET)
      }
      console.log(
        `blade: slowest build ${worst.ms.toFixed(1)} ms (${worst.name}), most vertices ${most.verts} (${most.name})`,
      )
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
        const f = factsOf(spec)
        expect(f.minZ, name).toBeLessThanOrEqual(spec.blade.from - 0.5)
        expect(f.tipOnLine, name).toBe(true)
      }
      const spec = BLADES[0]!.spec
      const tip = bladeStations(spec).at(-1)!
      const line = centreLineAt(spec, spec.blade.to)
      expect(tip.section).toHaveLength(0)
      expect(tip.centre).toEqual([line.x, 0, line.z])
    },
    HEAVY,
  )

  it(
    'lays uv in mm, along about the blade length',
    () => {
      for (const { name, spec } of BLADES) {
        const f = factsOf(spec)
        const B = spec.blade.to - spec.blade.from
        expect(f.minAlong, name).toBe(0)
        expect(f.maxAlong, name).toBeGreaterThan(B)
        expect(f.maxAlong, name).toBeLessThan(B * 1.15)
        expect(f.maxAcross, name).toBeGreaterThan(8)
        expect(f.maxAcross, name).toBeLessThan(60)
      }
    },
    HEAVY,
  )
})

describe('the outline', () => {
  it('eases into every point: no turn over a degree where the point starts', () => {
    const bad: string[] = []
    for (const family of KINDS) {
      const f = FAMILIES[family]
      for (const tip of f.tip)
        for (const profile of f.profile)
          for (const bladeWidth of [0, 1])
            for (const taper of tip === 'rounded' ? [0, 0.4] : [0, 1])
              for (const kissakiSize of [0, 1]) {
                const spec = compileSword(
                  sword({ family, tip, profile, bladeWidth, taper, kissakiSize }),
                )
                const { halfWidth, backWidth, tipFrom } = spec.blade
                const B = spec.blade.to - spec.blade.from
                for (const curve of [halfWidth, backWidth ?? halfWidth]) {
                  const w = (z: number) => sample(curve, z / B)
                  const h = 0.5
                  for (let z = tipFrom * B - 1; z <= tipFrom * B + 1; z += 0.1) {
                    const turn = Math.abs(
                      Math.atan2(w(z + h) - w(z), h) - Math.atan2(w(z) - w(z - h), h),
                    )
                    if (turn > Math.PI / 180)
                      bad.push(`${family} ${tip} ${profile} w${bladeWidth} t${taper}`)
                  }
                }
              }
    }
    expect([...new Set(bad)]).toEqual([])
  })
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

describe('edges, ricasso, false edge and kissaki', () => {
  it('leaves the faces alone where the ricasso ends: only the edge zone changes', () => {
    const plain = compileSword(sword({ family: 'greatsword', middle: 'ridge', ricasso: 'none' }))
    const ricasso = compileSword(sword({ family: 'greatsword', middle: 'ridge', ricasso: 'long' }))
    const end = ricasso.blade.from + ricasso.blade.ricasso
    for (let z = end - 5; z <= end + 15; z += 1) {
      const a = bladeSectionAt(plain, z)
      const b = bladeSectionAt(ricasso, z)
      for (const x of [0, a.edge.width / 2, a.edge.width - a.edge.bevel - 0.5])
        expect(b.half(x)).toBeCloseTo(a.half(x), 9)
    }
    expect(2 * bladeSectionAt(ricasso, end - 5).edge.end).toBeGreaterThan(0.8)
    expect(2 * bladeSectionAt(ricasso, end + 15).edge.end).toBeCloseTo(ricasso.blade.edgeFlat, 9)
  })

  it("grows the Sabre's false edge in smoothly before the point and sharpens the back at the tip", () => {
    const spec = compileSword(sword({ family: 'sabre', tip: 'curvedPoint' }))
    const { from, to, tipFrom } = spec.blade
    const B = to - from
    const before = bladeSectionAt(spec, from + (tipFrom - 0.26) * B)
    expect(before.back.sharp).toBe(0)
    expect(before.back.end / before.T).toBeGreaterThan(0.85)
    let last = before.back.bevel
    for (let u = tipFrom - 0.26; u < tipFrom; u += 0.005) {
      const bevel = bladeSectionAt(spec, from + u * B).back.bevel
      expect(Math.abs(bevel - last)).toBeLessThan(0.2)
      last = bevel
    }
    expect(2 * bladeSectionAt(spec, to - 15).back.end).toBeLessThan(0.6)
  })

  it('rounds a Katana into its edge with no bevel crease, and creases across at the yokote', () => {
    const spec = compileSword(sword({ family: 'katana' }))
    const { from, to, tipFrom } = spec.blade
    const s = bladeSectionAt(spec, from + 300)
    const start = s.edge.width - s.edge.bevel
    const slope = (a: number, b: number) => (s.half(a) - s.half(b)) / (b - a)
    expect(slope(start, start + 0.2) / slope(start - 0.2, start)).toBeLessThan(1.1)
    const yokote = from + tipFrom * (to - from)
    const x = bladeSectionAt(spec, yokote).crest
    const along = (z: number) =>
      bladeSectionAt(spec, z + 0.1).half(x) - bladeSectionAt(spec, z).half(x)
    expect(along(yokote + 0.5)).toBeLessThan(along(yokote - 0.6) - 0.002)
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
      if (spec.family !== 'katana') hasCreaseAt(xs, section.edge.width - section.edge.bevel)
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
          const fromEnd = Math.min(section.edge.width - c.x, c.x + section.back.width)
          if (c.edge > 0 && fromEnd > spec.blade.edgeBevel + 1e-4)
            bad.push(`${name} aEdge ${fromEnd.toFixed(2)} mm in from the end at z ${c.z}`)
          const inFuller = spec.blade.fullers.some(
            (f, k) =>
              c.z >= f.from &&
              c.z <= f.to &&
              Math.abs(c.x - section.fullers[k]!.x) <= section.fullers[k]!.halfWidth + 1e-4,
          )
          if (c.fuller > 0 && !inFuller)
            bad.push(`${name} aFuller outside a fuller at ${c.x}, ${c.z}`)
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

  it('bends as an even arc that tightens only gently toward the tip', () => {
    for (const family of ['sabre', 'katana'] as const)
      for (const curve of [0, 0.5, 1])
        for (const bladeLength of [0, 1]) {
          const spec = compileSword(sword({ family, curve, bladeLength }))
          const { from, to } = spec.blade
          const name = `${family} curve ${curve} length ${bladeLength}`
          let max = 0
          let sum = 0
          const n = 200
          for (let i = 0; i <= n; i++) {
            const k = centreLineAt(spec, from + ((to - from) * i) / n).curvature
            max = Math.max(max, k)
            sum += k
          }
          expect(max / (sum / (n + 1)), name).toBeLessThanOrEqual(2)
          expect((centreLineAt(spec, to).angle * 180) / Math.PI, name).toBeLessThanOrEqual(45)
        }
  })

  it('reaches no deeper than halfway down the blade on a Katana', () => {
    for (const curve of [0, 1]) {
      const peak = compileSword(sword({ family: 'katana', curve })).blade.curve!.peak
      expect(peak).toBeLessThanOrEqual(0.5)
    }
  })

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
