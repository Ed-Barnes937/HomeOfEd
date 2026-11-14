import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { type ShapeId } from './bottles.ts'
import { compilePotion, type PotionSpec } from './compile.ts'
import { INGREDIENTS, type Trait } from './ingredients.ts'
import { MOTE_PROGRAMS, MAX_MOTES, motePool, motesShown, moteBand } from './traits.ts'
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

  it('is the same every time for a bottle, so a repeated band is not a stamped pattern', () => {
    const profile = bottleProfile(potion(['starpetal', 'starpetal', 'starpetal']))
    expect(motePool(profile).rest).toEqual(motePool(profile).rest)
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
