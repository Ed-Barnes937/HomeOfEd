import { describe, expect, it } from 'vitest'

import { normalise, type Params } from '../engine/schema.ts'
import { SECRET_BLENDS } from './blends.ts'
import { BOTTLES, type ShapeId } from './bottles.ts'
import {
  countInWords,
  nameFrom,
  potionGlowColour,
  potionLore,
  potionName,
  potionNumber,
  potionShelfLine,
  potionTagLine,
} from './describe.ts'
import { isForbiddenName } from './doNotUse.ts'
import { EFFECTS } from './effects.ts'
import { ingredient, INGREDIENTS, type IngredientId } from './ingredients.ts'
import { potionPresets } from './presets.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'

const potion = (pours: IngredientId[], rest: Params = {}) =>
  normalise(potionSchema, { ...withPours(pours), ...rest })
const sentences = (text: string) => text.split(/[.!?]/).filter((s) => s.trim() !== '')
const DRINKING =
  /\b(drink|drinks|drank|sip|sips|taste|tastes|tasty|swallow|gulp|gulps|yum|delicious|eat|eats)\b/i
const SHAPES = Object.keys(BOTTLES) as ShapeId[]

const catalogue = (): Params[] => {
  const ids = INGREDIENTS.map((i) => i.id)
  const out: Params[] = [potion([])]
  for (const shape of SHAPES) {
    for (const a of ids) {
      out.push(potion([a], { shape }), potion([a, a, a, a], { shape }))
      for (const b of ids) out.push(potion([a, b], { shape }))
    }
  }
  for (const blend of SECRET_BLENDS) out.push(potion(blend.pours))
  for (const preset of potionPresets) out.push(normalise(potionSchema, preset.params))
  return out
}

describe('countInWords', () => {
  it('spells one to four, singular for one', () => {
    expect([1, 2, 3, 4].map(countInWords)).toEqual([
      'One pour',
      'Two pours',
      'Three pours',
      'Four pours',
    ])
  })
})

describe('potionName', () => {
  it('names an empty bottle', () => {
    expect(potionName(potion([]))).toBe('An Empty Bottle')
  })

  it('names a secret blend by its own name, ahead of every other rule', () => {
    expect(potionName(potion(['bogmurk', 'bogmurk', 'bogmurk', 'bogmurk']))).toBe(
      'Bottom of the Pond',
    )
    expect(potionName(potion(['thundercloud', 'moonmilk']))).toBe('The Moon Behind the Storm')
  })

  it('calls two or more of one ingredient Pure, with its label in title case', () => {
    expect(potionName(potion(['starpetal', 'starpetal']))).toBe('Pure Starpetal')
    expect(potionName(potion(['bluebell', 'bluebell', 'bluebell']))).toBe('Pure Bluebell Dew')
    expect(potionName(potion(['bogmurk', 'bogmurk']))).toBe('Pure Bog Murk')
  })

  it('otherwise joins the effect word, the main ingredient and the shape noun', () => {
    expect(potionName(potion(['frogfizz'], { shape: 'teardrop' }))).toBe('Floating Frogfizz Tonic')
    expect(potionName(potion(['bogmurk'], { shape: 'round' }))).toBe('Whiffy Bogmurk Brew')
    expect(potionName(potion(['moonmilk', 'rosehip'], { shape: 'tall' }))).toBe(
      'Whirling Rosehip Drops',
    )
    expect(potionName(potion(['starpetal', 'moonmilk', 'starpetal'], { shape: 'shoulder' }))).toBe(
      'Sparkling Starpetal Mixture',
    )
    expect(potionName(potion(['moonmilk'], { shape: 'gourd' }))).toBe('Dreamy Moonmilk Potion')
  })

  it('names every secret blend by its own name and lore, ahead of Pure', () => {
    for (const blend of SECRET_BLENDS) {
      const p = potion(blend.pours)
      expect(potionName(p), blend.id).toBe(blend.name)
      expect(potionLore(p), blend.id).toBe(blend.lore)
    }
    expect(potionName(potion(['starpetal', 'starpetal', 'starpetal', 'starpetal']))).toBe(
      'A Pocketful of Stars',
    )
  })

  it('takes the main ingredient from the most poured, a tie going to the highest', () => {
    expect(potionName(potion(['frogfizz', 'moonmilk', 'frogfizz'], { shape: 'round' }))).toContain(
      'Frogfizz',
    )
    expect(potionName(potion(['frogfizz', 'moonmilk'], { shape: 'round' }))).toContain('Moonmilk')
  })

  it('falls back to the round noun and then the label when a name is forbidden', () => {
    const forbidden = (name: string) => name === 'Floating Frogfizz Tonic'
    expect(nameFrom('Floating', 'Frogfizz', 'Frogfizz', 'Tonic', forbidden)).toBe(
      'Floating Frogfizz Brew',
    )
    const worse = (name: string) => name.endsWith('Tonic') || name.endsWith('Brew')
    expect(nameFrom('Floating', 'Frogfizz', 'Frogfizz', 'Tonic', worse)).toBe('Frogfizz Tonic')
  })

  it('never produces a forbidden name anywhere in the catalogue', () => {
    for (const p of catalogue()) expect(isForbiddenName(potionName(p)), potionName(p)).toBe(false)
  })

  it('never makes a forbidden name from any effect word, ingredient word and noun', () => {
    const nouns = SHAPES.map((s) => BOTTLES[s].nameNoun)
    for (const effect of Object.values(EFFECTS)) {
      for (const i of INGREDIENTS) {
        for (const noun of nouns) {
          const name = nameFrom(effect.word, i.word, i.label, noun)
          expect(isForbiddenName(name), name).toBe(false)
        }
      }
    }
  })
})

describe('the words', () => {
  it('never mention drinking or tasting', () => {
    const texts = [
      ...Object.values(EFFECTS).flatMap((e) => [e.word, e.sentence]),
      ...INGREDIENTS.flatMap((i) => [i.label, i.word, i.lore]),
      ...SECRET_BLENDS.flatMap((b) => [b.name, b.lore]),
      ...catalogue().flatMap((p) => [potionName(p), potionTagLine(p), potionLore(p)]),
    ]
    for (const text of texts) expect(text, text).not.toMatch(DRINKING)
  })
})

describe('potionNumber', () => {
  it('is four digits and stable', () => {
    const p = potion(['moonmilk', 'rosehip'])
    expect(potionNumber(p)).toMatch(/^\d{4}$/)
    expect(potionNumber(p)).toBe(potionNumber({ ...p }))
    expect(potionNumber(potion(['moonmilk']))).not.toBe(potionNumber(p))
  })
})

describe('potionTagLine', () => {
  it('counts the pours and names the traits bottom first', () => {
    expect(potionTagLine(potion(['moonmilk', 'rosehip', 'starpetal'], { shape: 'teardrop' }))).toBe(
      'Three pours in a teardrop flask. Cloudy, then swirly, then sparkly.',
    )
  })

  it('merges repeats in a row', () => {
    expect(potionTagLine(potion(['frogfizz', 'starpetal', 'starpetal'], { shape: 'tall' }))).toBe(
      'Three pours in a tall bottle. Fizzy, then sparkly.',
    )
    expect(potionTagLine(potion(['bogmurk', 'bogmurk', 'bogmurk', 'bogmurk']))).toContain(
      'Four pours',
    )
    expect(potionTagLine(potion(['bogmurk', 'bogmurk', 'bogmurk', 'bogmurk']))).toMatch(/Cloudy\.$/)
  })

  it('keeps a trait that comes back after another', () => {
    expect(potionTagLine(potion(['moonmilk', 'emberroot', 'moonmilk']))).toMatch(
      /Cloudy, then glowing, then cloudy\.$/,
    )
  })

  it('says pour for one, with every trait word', () => {
    expect(potionTagLine(potion(['bluebell'], { shape: 'round' }))).toBe(
      'One pour in a round flask. Clear.',
    )
    expect(potionTagLine(potion(['emberroot'], { shape: 'shoulder' }))).toBe(
      'One pour in a square-shouldered bottle. Glowing.',
    )
    expect(potionTagLine(potion(['frogfizz'], { shape: 'gourd' }))).toBe(
      'One pour in a gourd bottle. Fizzy.',
    )
  })

  it('waits for a pour when empty', () => {
    expect(potionTagLine(potion([], { shape: 'tall' }))).toBe(
      'An empty tall bottle, waiting for a pour.',
    )
  })
})

describe('potionLore', () => {
  it('is the main ingredient line then the effect sentence', () => {
    expect(potionLore(potion(['frogfizz', 'moonmilk', 'frogfizz']))).toBe(
      `${ingredient('frogfizz').lore} ${EFFECTS.floating.sentence}`,
    )
  })

  it("is a secret blend's own two sentences", () => {
    const blend = SECRET_BLENDS[0]!
    expect(potionLore(potion(blend.pours))).toBe(blend.lore)
  })

  it('says how every potion starts when empty', () => {
    expect(potionLore(potion([]))).toBe(
      'Every potion starts as an empty bottle. Pour something in.',
    )
  })

  it('is two sentences for every potion in the catalogue, and never forbidden', () => {
    for (const p of catalogue()) {
      const lore = potionLore(p)
      expect(sentences(lore)).toHaveLength(2)
      expect(isForbiddenName(lore)).toBe(false)
    }
  })
})

describe('potionShelfLine', () => {
  it('gives the shape and the count', () => {
    expect(potionShelfLine(potion(['moonmilk'], { shape: 'gourd' }))).toBe('Gourd bottle, one pour')
    expect(
      potionShelfLine(potion(['moonmilk', 'rosehip', 'starpetal', 'bogmurk'], { shape: 'gourd' })),
    ).toBe('Gourd bottle, four pours')
  })

  it('says empty for an empty bottle', () => {
    expect(potionShelfLine(potion([], { shape: 'round' }))).toBe('Round flask, empty')
  })
})

describe('potionGlowColour', () => {
  it("is the effect's first colour, or candlelight when empty", () => {
    expect(potionGlowColour(potion(['moonmilk', 'emberroot']))).toBe(ingredient('emberroot').colour)
    expect(potionGlowColour(potion([]))).toBe('#e8b46a')
  })
})

describe('the whole catalogue', () => {
  it('has a name, number, tag line, lore and shelf line for every potion', () => {
    for (const p of catalogue()) {
      for (const text of [
        potionName(p),
        potionNumber(p),
        potionTagLine(p),
        potionLore(p),
        potionShelfLine(p),
      ]) {
        expect(text.length).toBeGreaterThan(0)
      }
      expect(potionGlowColour(p)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
