import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { type ShapeId } from './bottles.ts'
import { compilePotion, type PotionSpec } from './compile.ts'
import { INGREDIENTS, type Trait } from './ingredients.ts'
import {
  bubbleAt,
  MOTE_PROGRAMS,
  MAX_MOTES,
  moteBand,
  moteEdgeFade,
  motePool,
  moteShown,
  motesShown,
} from './traits.ts'
import { bandTops, bottleProfile, BASE_MM } from './profile.ts'
import { potionPresets } from './presets.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'
import { floorAt, levelsAt, levelTable } from './tipped.ts'
import { TRAIT_LOOKS, traitLook } from './traits.ts'

const TRAITS: Trait[] = ['clear', 'cloud', 'fizz', 'glitter', 'glow', 'swirl', 'murk']
const SHAPES: ShapeId[] = ['round', 'teardrop', 'tall', 'shoulder', 'gourd']

const potion = (pours: string[], shape: ShapeId = 'teardrop', neck = 0.5): PotionSpec =>
  compilePotion(normalise(potionSchema, { ...withPours(pours as never), shape, neck }))

const kindsOf = (spec: PotionSpec) => spec.layers.map((l) => traitLook(l.trait, l.ingredient).motes)

/** Lean and tip in degrees as one tilt of the bottle's axis from upright, and the up in its frame. */
function posed(leanDeg: number, tipDeg: number) {
  const lean = (leanDeg * Math.PI) / 180
  const tip = (tipDeg * Math.PI) / 180
  const tilt = Math.acos(Math.cos(lean) * Math.cos(tip))
  const s = Math.sin(tilt)
  return { tilt, up: [s * 0.6, s * 0.8, Math.cos(tilt)] as [number, number, number] }
}

function shown(spec: PotionSpec, leanDeg = 0, tipDeg = 0) {
  const profile = bottleProfile(spec)
  const pool = motePool(profile)
  const { tilt, up } = posed(leanDeg, tipDeg)
  const table = levelTable(spec)
  const levels = tilt === 0 ? bandTops(profile, spec.layers.length) : levelsAt(table, tilt)
  const floor = tilt === 0 ? BASE_MM : floorAt(table, tilt)
  return { counts: motesShown(pool, up, levels, floor, kindsOf(spec)), pool, up, levels, floor }
}

const catalogue = (): [string, PotionSpec][] => [
  ...INGREDIENTS.flatMap((i) =>
    SHAPES.map((s): [string, PotionSpec] => [`three ${i.id} ${s}`, potion([i.id, i.id, i.id], s)]),
  ),
  ...potionPresets.map((p): [string, PotionSpec] => [
    p.name,
    compilePotion(normalise(potionSchema, { ...p.params, mixed: 'no' })),
  ]),
]

describe('the traits', () => {
  it('give every trait but clear a shader program or a motes program', () => {
    for (const trait of TRAITS) {
      const look = TRAIT_LOOKS[trait]
      const shaded = Object.values(look.shading).some((w) => w > 0)
      expect(shaded || look.motes !== null, trait).toBe(trait !== 'clear')
    }
  })

  it('draw glitter as gold flecks, silver on Thundercloud', () => {
    const gold = traitLook('glitter', 'starpetal').tint!
    const silver = traitLook('glitter', 'thundercloud').tint!
    expect(traitLook('glitter', 'starpetal').motes).toBe('fleck')
    const chroma = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      return Math.max(r!, g!, b!) - Math.min(r!, g!, b!)
    }
    expect(chroma(gold)).toBeGreaterThan(60)
    expect(chroma(silver)).toBeLessThan(40)
  })

  it("give Snailshine's swirl a pearly sheen and Puffcap's cloud its spores, only on their own trait", () => {
    expect(traitLook('swirl', 'snailshine').shading.pearl).toBeGreaterThan(0)
    expect(traitLook('swirl', 'rosehip').shading.pearl).toBe(0)
    expect(traitLook('cloud', 'puffcap').motes).toBe('spore')
    expect(traitLook('cloud', 'moonmilk').motes).toBeNull()
    expect(traitLook('clear', 'puffcap')).toEqual(TRAIT_LOOKS.clear)
  })

  it('have a motes program for every kind a trait asks for, the table open to more', () => {
    for (const trait of TRAITS) {
      const kind = TRAIT_LOOKS[trait].motes
      if (kind) expect(MOTE_PROGRAMS[kind], trait).toBeDefined()
    }
    for (const i of INGREDIENTS) {
      const kind = traitLook(i.trait, i.id).motes
      if (kind) expect(MOTE_PROGRAMS[kind], i.id).toBeDefined()
    }
    const codes = Object.values(MOTE_PROGRAMS).map((p) => p.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(Math.min(...codes)).toBeGreaterThan(0)
  })
})

describe("the motes' layout", () => {
  it('lies inside the cavity, clear of its wall, at every shape and neck', () => {
    for (const shape of SHAPES)
      for (const neck of [0, 1]) {
        const profile = bottleProfile(potion(['bluebell'], shape, neck))
        const { rest, count } = motePool(profile)
        expect(count, shape).toBeLessThanOrEqual(MAX_MOTES)
        for (let i = 0; i < count; i++) {
          const [x, y, z] = [rest[3 * i]!, rest[3 * i + 1]!, rest[3 * i + 2]!]
          expect(z, shape).toBeGreaterThan(BASE_MM)
          expect(z, shape).toBeLessThan(profile.cavityTopZ)
          expect(Math.hypot(x, y), shape).toBeLessThan(profile.innerR(z) - 0.5)
        }
      }
  })

  it('is the same every time for a bottle', () => {
    const profile = bottleProfile(potion(['starpetal', 'starpetal', 'starpetal']))
    expect(motePool(profile).rest).toEqual(motePool(profile).rest)
  })

  it("does not repeat one band's pattern in the band above, so three of one are not stamped", () => {
    const profile = bottleProfile(potion(['starpetal', 'starpetal', 'starpetal']))
    const [top0, top1] = bandTops(profile, 2) as [number, number]
    const { rest, count } = motePool(profile)
    const points = Array.from({ length: count }, (_, i) => [
      rest[3 * i]!,
      rest[3 * i + 1]!,
      rest[3 * i + 2]!,
    ])
    const below = points.filter(([, , z]) => z! > BASE_MM && z! <= top0)
    const above = points.filter(([, , z]) => z! > top0 && z! <= top1)
    const shift = top0 - BASE_MM
    const repeated = below.filter(([x, y, z]) =>
      above.some(([u, v, w]) => Math.hypot(u! - x!, v! - y!, w! - z! - shift) < 1),
    )
    expect(below.length).toBeGreaterThan(20)
    expect(repeated.length).toBeLessThan(0.15 * below.length)
  })

  it('puts each mote in the band its height falls in, none above the surface', () => {
    const levels = [20, 40, 60]
    expect(moteBand([0, 0, 10], [0, 0, 1], levels, 5)).toBe(0)
    expect(moteBand([0, 0, 45], [0, 0, 1], levels, 5)).toBe(2)
    expect(moteBand([0, 0, 61], [0, 0, 1], levels, 5)).toBe(-1)
    expect(moteBand([30, 0, 30], [0.6, 0, 0.8], levels, 5)).toBe(2)
    expect(moteBand([0, 0, 30], [0, 0, 1], levels.slice(0, 1), 5)).toBe(-1)
  })

  it(`shows at most ${MAX_MOTES} in every three-layer potion of the catalogue, and in a whole bottle of each`, () => {
    for (const [name, spec] of catalogue()) {
      const { counts } = shown(spec)
      expect(
        counts.reduce((a, b) => a + b, 0),
        name,
      ).toBeLessThanOrEqual(MAX_MOTES)
    }
    for (const i of INGREDIENTS) {
      const spec = potion([i.id, i.id, i.id], 'round')
      const profile = bottleProfile(spec)
      const kind = traitLook(i.trait, i.id).motes
      const whole = motesShown(motePool(profile), [0, 0, 1], [profile.fullZ], BASE_MM, [kind])
      expect(whole[0], i.id).toBeLessThanOrEqual(MAX_MOTES)
    }
  })

  it("shows none of a mote at its band's edges, all of it well inside", () => {
    expect(moteEdgeFade(10, 10, 30)).toBe(0)
    expect(moteEdgeFade(30, 10, 30)).toBe(0)
    expect(moteEdgeFade(20, 10, 30)).toBe(1)
    expect(moteEdgeFade(9, 10, 30)).toBe(0)
    expect(moteEdgeFade(31, 10, 30)).toBe(0)
    expect(moteEdgeFade(10.2, 10, 10.4)).toBeGreaterThan(0)
  })

  it('lets a mote change band only while it is not shown, as the levels move under it', () => {
    const profile = bottleProfile(potion(['frogfizz', 'starpetal', 'puffcap'], 'round'))
    const pool = motePool(profile)
    const tops = bandTops(profile, 3)
    const up = [0, 0, 1] as const
    const at = (i: number) => pool.rest.subarray(3 * i, 3 * i + 3)
    let before: { band: number; shown: number }[] = []
    let switched = 0
    for (let step = 0; step <= 600; step++) {
      const lift = 6 * Math.sin((step / 600) * Math.PI * 2)
      const levels = tops.map((h) => h + lift)
      const now = Array.from({ length: pool.count }, (_, i) => ({
        band: moteBand(at(i), up, levels, BASE_MM),
        shown: moteShown(at(i), up, levels, BASE_MM),
      }))
      now.forEach((mote, i) => {
        const was = before[i]
        if (!was || was.band === mote.band) return
        switched++
        expect(was.shown, `mote ${i} leaving band ${was.band} at step ${step}`).toBeLessThan(0.01)
        expect(mote.shown, `mote ${i} joining band ${mote.band} at step ${step}`).toBeLessThan(0.01)
      })
      before = now
    }
    expect(switched).toBeGreaterThan(10)
  })
})

describe("the bubbles' rise", () => {
  const rest = [3.3, -7.1, 24] as const
  const seeds = [
    [0.1, 0.2, 0.9, 0.3],
    [0.6, 0.85, 0.15, 0.5],
    [0.3, 0.05, 0.6, 0.95],
  ] as const
  const RISE = 20
  const distance = (a: readonly number[], b: readonly number[]) =>
    Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)

  interface Frame {
    t: number
    up: readonly number[]
    lo: number
    hi: number
  }

  /** Each step moves a shown bubble no further than its own rise, the band's move and `reach` allow. */
  function expectSmooth(frames: Frame[], seed: readonly number[], reach: number) {
    let prev: { frame: Frame; at: ReturnType<typeof bubbleAt> } | null = null
    for (const frame of frames) {
      const at = bubbleAt(rest, seed, frame.up, 0, frame.lo, frame.hi, frame.t, RISE)
      if (prev && (prev.at.fade > 0.01 || at.fade > 0.01)) {
        const span = Math.max(frame.hi - frame.lo, prev.frame.hi - prev.frame.lo)
        const allowed =
          (12 * (frame.t - prev.frame.t) * span) / RISE +
          Math.abs(frame.hi - prev.frame.hi) +
          Math.abs(frame.lo - prev.frame.lo) +
          reach
        expect(distance(prev.at.p, at.p), `t ${frame.t.toFixed(3)}`).toBeLessThanOrEqual(allowed)
      }
      prev = { frame, at }
    }
  }

  it('rises smoothly through a band whose top sloshes, a minute after the page opened', () => {
    for (const seed of seeds) {
      const frames = Array.from({ length: 240 }, (_, i) => {
        const t = 61 + i / 120
        return { t, up: [0, 0, 1], lo: 10, hi: 32 + 1.5 * Math.sin(t * 9) }
      })
      expectSmooth(frames, seed, 0.1)
    }
  })

  it('rises smoothly through a top band whose level climbs, as a pour raises it', () => {
    for (const seed of seeds) {
      const frames = Array.from({ length: 240 }, (_, i) => ({
        t: 75 + i / 120,
        up: [0, 0, 1],
        lo: 30,
        hi: 32 + 12 * (i / 240),
      }))
      expectSmooth(frames, seed, 0.1)
    }
  })

  it('keeps each bubble in its own stream as the surface swings, never jumping to another', () => {
    for (const seed of seeds) {
      const frames = Array.from({ length: 240 }, (_, i) => {
        const swing = ((12 * Math.PI) / 180) * Math.sin((i / 240) * Math.PI * 4)
        const turn = (i / 240) * Math.PI * 2
        const up = [
          Math.sin(swing) * Math.cos(turn),
          Math.sin(swing) * Math.sin(turn),
          Math.cos(swing),
        ]
        return { t: 61 + i / 120, up, lo: 10, hi: 32 }
      })
      expectSmooth(frames, seed, 0.6)
    }
  })

  it('stays finite with the bottle tipped flat towards the eye', () => {
    const { p, fade } = bubbleAt(rest, seeds[0], [0, 1, 0], 0, -20, 10, 3, RISE)
    expect(p.every(Number.isFinite)).toBe(true)
    expect(Number.isFinite(fade)).toBe(true)
  })

  it('climbs from the floor to the top of its band and is gone at both ends', () => {
    const heights: number[] = []
    for (let t = 0; t < 4; t += 0.01) {
      const { p, rise, fade } = bubbleAt(rest, seeds[1], [0, 0, 1], 0, 10, 30, t, RISE)
      heights.push(p[2])
      expect(p[2]).toBeGreaterThanOrEqual(10)
      expect(p[2]).toBeLessThanOrEqual(30)
      if (rise < 0.003 || rise > 0.997) expect(fade).toBeLessThan(0.01)
    }
    expect(Math.min(...heights)).toBeLessThan(11)
    expect(Math.max(...heights)).toBeGreaterThan(29)
  })
})

describe("the motes' layout, posed", () => {
  it('keeps every band with motes well filled, upright, leaned 59, tipped 44 and both', () => {
    for (const shape of SHAPES) {
      const spec = potion(['frogfizz', 'starpetal', 'puffcap'], shape)
      for (const [lean, tip] of [
        [0, 0],
        [59, 0],
        [0, 44],
        [59, 44],
      ] as const) {
        const { counts } = shown(spec, lean, tip)
        counts.forEach((n, band) => {
          const kind = kindsOf(spec)[band]!
          expect(n, `${shape} ${lean}:${tip} band ${band}`).toBeGreaterThanOrEqual(
            MOTE_PROGRAMS[kind].least,
          )
        })
      }
    }
  })
})
