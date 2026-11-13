import { describe, expect, it } from 'vitest'

import {
  allowedOptions,
  type ChoiceParam,
  defaults,
  normalise,
  randomise,
  seededRandom,
} from '../engine/schema.ts'
import { INGREDIENTS } from './ingredients.ts'
import {
  GLASS_TINTS,
  isMixed,
  MAX_POURS,
  POUR_KEYS,
  potionSchema,
  potionSwatchFor,
} from './potionSchema.ts'

const param = (key: string) => potionSchema.params.find((d) => d.key === key)!
const choice = (key: string) => param(key) as ChoiceParam
const weights = (key: string) =>
  Object.fromEntries(choice(key).options.map((o) => [o.value, o.weight ?? 1]))
const slots = (p: Record<string, unknown>) => POUR_KEYS.map((k) => p[k])

describe('potionSchema', () => {
  it('is the potion with its three groups in order', () => {
    expect(potionSchema.itemType).toBe('potion')
    expect(potionSchema.groups).toEqual([
      { key: 'pours', label: 'What goes in' },
      { key: 'bottle', label: 'The bottle' },
      { key: 'finish', label: 'Stopper and label' },
    ])
    expect(POUR_KEYS).toEqual(['pour1', 'pour2', 'pour3'])
    expect(MAX_POURS).toBe(3)
    expect(potionSchema.params.filter((d) => d.group === 'pours').map((d) => d.key)).toEqual([
      'pour1',
      'pour2',
      'pour3',
      'mixed',
    ])
  })

  it('defaults to the first-visit potion, full and not mixed', () => {
    expect(defaults(potionSchema)).toEqual({
      pour1: 'moonmilk',
      pour2: 'rosehip',
      pour3: 'starpetal',
      mixed: 'no',
      shape: 'teardrop',
      neck: 0.4,
      glass: 'clear',
      stopper: 'cork',
      label: 'round',
    })
  })

  it('labels the params as the spec does', () => {
    expect(POUR_KEYS.map((k) => param(k).label)).toEqual([
      'First ingredient',
      'Second ingredient',
      'Third ingredient',
    ])
    expect(param('mixed').label).toBe('Mixed')
    expect(choice('mixed').options.map((o) => o.label)).toEqual(['Not mixed', 'Mixed'])
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
      expect(weights(key).none).toBe(0)
    }
    expect(weights('mixed')).toEqual({ no: 1, yes: 0 })
    expect(weights('glass')).toEqual({ clear: 4, sea: 2, amber: 1, violet: 1, smoky: 1 })
    expect(weights('stopper')).toEqual({ cork: 5, glass: 2, wax: 2 })
    expect(choice('shape').default).toBe('teardrop')
  })

  it('normalises a gap to the ingredients below it', () => {
    const empty = normalise(potionSchema, { pour1: 'none', pour2: 'frogfizz' })
    expect(slots(empty)).toEqual(['none', 'none', 'none'])
    const one = normalise(potionSchema, { pour2: 'none', pour3: 'starpetal' })
    expect(slots(one)).toEqual(['moonmilk', 'none', 'none'])
  })

  it('allows only none above an empty slot, with none first', () => {
    const p = normalise(potionSchema, { pour2: 'none' })
    expect(choice('pour3').allowed!(p)).toEqual(['none'])
    expect(allowedOptions(choice('pour2'), p).map((o) => o.value)[0]).toBe('none')
    expect(choice('pour2').allowed!(p)[0]).toBe('none')
  })

  it('allows the same ingredient in every slot', () => {
    const p = normalise(potionSchema, { pour1: 'frogfizz', pour2: 'frogfizz', pour3: 'frogfizz' })
    expect(slots(p)).toEqual(['frogfizz', 'frogfizz', 'frogfizz'])
  })

  describe('mixed', () => {
    it('is no unless three are in', () => {
      expect(normalise(potionSchema, { pour3: 'none', mixed: 'yes' }).mixed).toBe('no')
      expect(normalise(potionSchema, { pour1: 'none', mixed: 'yes' }).mixed).toBe('no')
      expect(normalise(potionSchema, { mixed: 'yes' }).mixed).toBe('yes')
    })

    it('allows only no while the third slot is empty', () => {
      expect(choice('mixed').allowed!(normalise(potionSchema, { pour3: 'none' }))).toEqual(['no'])
      expect(choice('mixed').allowed!(defaults(potionSchema))).toEqual(['no', 'yes'])
    })

    it('reads through isMixed', () => {
      expect(isMixed(normalise(potionSchema, { mixed: 'yes' }))).toBe(true)
      expect(isMixed(defaults(potionSchema))).toBe(false)
    })

    it('falls back to no for anything else', () => {
      expect(normalise(potionSchema, { mixed: 'maybe' }).mixed).toBe('no')
      expect(normalise(potionSchema, { mixed: true }).mixed).toBe('no')
    })
  })

  describe('a save or link from the four-pour build', () => {
    it('drops a pour4 and falls back from a bogmurk', () => {
      const p = normalise(potionSchema, { pour3: 'frogfizz', pour4: 'emberroot' })
      expect(p).not.toHaveProperty('pour4')
      expect(slots(p)).toEqual(['moonmilk', 'rosehip', 'frogfizz'])
      const murk = normalise(potionSchema, { pour1: 'bogmurk', pour2: 'frogfizz' })
      expect(slots(murk)).toEqual(['moonmilk', 'frogfizz', 'starpetal'])
    })
  })

  describe('Try another', () => {
    it('always pours three and never mixes, over a fixed list of seeds', () => {
      for (const seed of [1, 2, 3, 7, 11, 42, 99, 123, 2024, 31337]) {
        const rng = seededRandom(seed)
        for (let n = 0; n < 100; n++) {
          const p = randomise(potionSchema, rng)
          for (const key of POUR_KEYS) expect(p[key]).not.toBe('none')
          expect(p.mixed).toBe('no')
        }
      }
    })

    it('keeps a locked pours group, mixed included', () => {
      const keep = normalise(potionSchema, { pour1: 'frogfizz', pour2: 'frogfizz', mixed: 'yes' })
      const p = randomise(potionSchema, seededRandom(3), { keep, locked: ['pours'] })
      expect(slots(p)).toEqual(['frogfizz', 'frogfizz', 'starpetal'])
      expect(p.mixed).toBe('yes')
    })

    it('keeps a partly filled locked group as it is', () => {
      const keep = normalise(potionSchema, { pour2: 'none' })
      const p = randomise(potionSchema, seededRandom(3), { keep, locked: ['pours'] })
      expect(slots(p)).toEqual(['moonmilk', 'none', 'none'])
    })
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
