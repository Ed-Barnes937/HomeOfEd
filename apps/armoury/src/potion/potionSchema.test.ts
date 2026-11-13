import { describe, expect, it } from 'vitest'

import {
  allowedOptions,
  type ChoiceParam,
  defaults,
  normalise,
  randomise,
  seededRandom,
} from '../engine/schema.ts'
import { type IngredientId, INGREDIENTS, MURK } from './ingredients.ts'
import { GLASS_TINTS, MAX_POURS, POUR_KEYS, potionSchema, potionSwatchFor } from './potionSchema.ts'
import { withPours } from './pours.ts'

const param = (key: string) => potionSchema.params.find((d) => d.key === key)!
const choice = (key: string) => param(key) as ChoiceParam
const weights = (key: string) =>
  Object.fromEntries(choice(key).options.map((o) => [o.value, o.weight ?? 1]))

// What `randomise` draws a slot from: the allowed options, given the pours below it.
const weightsGiven = (key: string, below: IngredientId[]) =>
  Object.fromEntries(
    allowedOptions(choice(key), withPours(below)).map((o) => [o.value, o.weight ?? 1]),
  )
const oddsOf = (key: string, below: IngredientId[], value: string) => {
  const w = weightsGiven(key, below)
  return (w[value] ?? 0) / Object.values(w).reduce((a, b) => a + b, 0)
}
const fullBelow = (slot: number, id: IngredientId) => Array<IngredientId>(slot).fill(id)

describe('potionSchema', () => {
  it('is the potion with its three groups in order', () => {
    expect(potionSchema.itemType).toBe('potion')
    expect(potionSchema.groups).toEqual([
      { key: 'pours', label: 'What goes in' },
      { key: 'bottle', label: 'The bottle' },
      { key: 'finish', label: 'Stopper and label' },
    ])
    expect(POUR_KEYS).toEqual(['pour1', 'pour2', 'pour3', 'pour4'])
    expect(MAX_POURS).toBe(4)
  })

  it('defaults to the first-visit potion', () => {
    expect(defaults(potionSchema)).toEqual({
      pour1: 'moonmilk',
      pour2: 'rosehip',
      pour3: 'starpetal',
      pour4: 'none',
      shape: 'teardrop',
      neck: 0.4,
      glass: 'clear',
      stopper: 'cork',
      label: 'round',
    })
  })

  it('labels the params as the spec does', () => {
    expect(POUR_KEYS.map((k) => param(k).label)).toEqual([
      'First pour',
      'Second pour',
      'Third pour',
      'Fourth pour',
    ])
    expect(param('neck')).toMatchObject({ min: 0, max: 1, step: 0.05, ends: ['Short', 'Long'] })
    expect(choice('shape').options.map((o) => o.label)).toEqual([
      'Round flask',
      'Teardrop flask',
      'Tall bottle',
      'Square shoulders',
      'Gourd bottle',
    ])
    expect(choice('stopper').options.map((o) => o.label)).toEqual([
      'Cork',
      'Glass stopper',
      'Sealed with wax',
    ])
    expect(choice('label').options.map((o) => o.label)).toEqual([
      'No label',
      'Round',
      'Banner',
      'Tag on a string',
    ])
  })

  it('orders and weights the options', () => {
    for (const key of POUR_KEYS) {
      expect(choice(key).options.map((o) => o.value)).toEqual([
        'none',
        ...INGREDIENTS.map((i) => i.id),
      ])
    }
    expect(weights('pour1').none).toBe(0)
    expect(weights('pour2').none).toBe(0)
    expect(weights('pour3').none).toBe(2)
    expect(weights('pour4').none).toBe(2)
    expect(weights('glass')).toEqual({ clear: 4, sea: 2, amber: 1, violet: 1, smoky: 1 })
    expect(weights('stopper')).toEqual({ cork: 5, glass: 2, wax: 2 })
    expect(choice('shape').default).toBe('teardrop')
  })

  it('normalises a gap to the pours below it', () => {
    const empty = normalise(potionSchema, { pour1: 'none', pour2: 'frogfizz' })
    expect(POUR_KEYS.map((k) => empty[k])).toEqual(['none', 'none', 'none', 'none'])
    const one = normalise(potionSchema, { pour2: 'none', pour3: 'starpetal' })
    expect(POUR_KEYS.map((k) => one[k])).toEqual(['moonmilk', 'none', 'none', 'none'])
  })

  it('allows only none above an empty slot, with none first', () => {
    const p = normalise(potionSchema, { pour3: 'none' })
    expect(choice('pour4').allowed!(p)).toEqual(['none'])
    expect(allowedOptions(choice('pour3'), p).map((o) => o.value)[0]).toBe('none')
    expect(choice('pour2').allowed!(p)[0]).toBe('none')
  })

  describe('the murky rule, from the weights', () => {
    it('gives Bog murk the weight of every other ingredient in every slot', () => {
      POUR_KEYS.forEach((key, slot) => {
        const w = weightsGiven(key, fullBelow(slot, MURK))
        for (const i of INGREDIENTS) expect(w[i.id]).toBe(w[MURK])
      })
    })

    it('makes four Bog murks as likely as four of any other ingredient', () => {
      const chance = (id: IngredientId) =>
        POUR_KEYS.reduce((acc, key, slot) => acc * oddsOf(key, fullBelow(slot, id), id), 1)
      for (const i of INGREDIENTS) expect(chance(i.id)).toBeCloseTo(chance(MURK), 12)
    })

    it('never gives fewer than two pours over 1000 seeded Try anothers', () => {
      const rng = seededRandom(7)
      for (let n = 0; n < 1000; n++) {
        const p = randomise(potionSchema, rng)
        expect(p.pour1).not.toBe('none')
        expect(p.pour2).not.toBe('none')
        if (p.pour3 === 'none') expect(p.pour4).toBe('none')
      }
    })
  })

  it('gives two, three and four pours the odds the ADR states', () => {
    const id: IngredientId = 'frogfizz'
    const none = (slot: number) => oddsOf(POUR_KEYS[slot]!, fullBelow(slot, id), 'none')
    expect(none(0)).toBe(0)
    expect(none(1)).toBe(0)
    const two = none(2)
    const three = (1 - none(2)) * none(3)
    const four = (1 - none(2)) * (1 - none(3))
    expect(two).toBeCloseTo(22 / 121, 12)
    expect(three).toBeCloseTo(18 / 121, 12)
    expect(four).toBeCloseTo(81 / 121, 12)
    expect([two, three, four].map((x) => Math.round(x * 100))).toEqual([18, 15, 67])
  })

  it('keeps a locked pours group under Try another', () => {
    const keep = normalise(potionSchema, { pour1: 'bogmurk', pour2: 'frogfizz', pour3: 'none' })
    const p = randomise(potionSchema, seededRandom(3), { keep, locked: ['pours'] })
    expect(POUR_KEYS.map((k) => p[k])).toEqual(['bogmurk', 'frogfizz', 'none', 'none'])
  })
})

describe('potionSwatchFor', () => {
  it('gives pours their ingredient colour and none nothing', () => {
    expect(potionSwatchFor('pour2', 'rosehip')).toBe('#d9467a')
    expect(potionSwatchFor('pour1', 'none')).toBeUndefined()
  })

  it('gives each glass a tint', () => {
    for (const [v, tint] of Object.entries(GLASS_TINTS)) {
      expect(tint).toMatch(/^#[0-9a-f]{6}$/)
      expect(potionSwatchFor('glass', v)).toBe(tint)
    }
  })

  it('gives other params nothing', () => {
    expect(potionSwatchFor('shape', 'round')).toBeUndefined()
  })
})
