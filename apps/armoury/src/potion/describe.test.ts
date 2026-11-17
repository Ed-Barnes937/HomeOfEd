import { describe, expect, it } from 'vitest'

import { normalise, type Params } from '../engine/schema.ts'
import { SECRET_BLENDS } from './blends.ts'
import { BOTTLES, type ShapeId } from './bottles.ts'
import {
  isGold,
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
import { mixPotion, type Recipe } from './mix.ts'
import { potionPresets } from './presets.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'

const potion = (pours: IngredientId[], rest: Params = {}) =>
  normalise(potionSchema, { ...withPours(pours), ...rest })
const mixed = (pours: IngredientId[], rest: Params = {}) => potion(pours, { mixed: 'yes', ...rest })
const sentences = (text: string) => text.split(/[.!?]/).filter((s) => s.trim() !== '')
const DRINKING =
  /\b(drink|drinks|drank|sip|sips|taste|tastes|tasty|swallow|gulp|gulps|yum|delicious|eat|eats)\b/i
const LINE_CAP = 140
const SHAPES = Object.keys(BOTTLES) as ShapeId[]
const ids = INGREDIENTS.map((i) => i.id)

const unmixedFills = (): IngredientId[][] => [
  [],
  ...ids.map((a) => [a]),
  ...ids.flatMap((a) => ids.map((b) => [a, b])),
  ...ids.flatMap((a) => ids.flatMap((b) => ids.map((c) => [a, b, c]))),
]
const multisets = (): IngredientId[][] => {
  const out: IngredientId[][] = []
  for (let a = 0; a < 9; a++)
    for (let b = a; b < 9; b++) for (let c = b; c < 9; c++) out.push([ids[a]!, ids[b]!, ids[c]!])
  return out
}

const catalogue = (): Params[] => [
  ...unmixedFills().map((pours) => potion(pours)),
  ...SHAPES.flatMap((shape) => multisets().map((m) => mixed(m, { shape }))),
  ...potionPresets.map((preset) => normalise(potionSchema, preset.params)),
]

describe('potionName', () => {
  it('names an empty bottle', () => {
    expect(potionName(potion([]))).toBe('An Empty Bottle')
  })

  it('names the layers by word, in pour order, until it is mixed', () => {
    expect(potionName(potion(['moonmilk']))).toBe('Moonmilk')
    expect(potionName(potion(['moonmilk', 'rosehip']))).toBe('Moonmilk and Rosehip')
    expect(potionName(potion(['moonmilk', 'rosehip', 'starpetal']))).toBe(
      'Moonmilk, Rosehip and Starpetal',
    )
  })

  it('folds repeats into the place of the first, ahead of any blend', () => {
    expect(potionName(potion(['frogfizz', 'frogfizz', 'bluebell']))).toBe(
      'Double Frogfizz and Bluebell',
    )
    expect(potionName(potion(['frogfizz', 'bluebell', 'frogfizz']))).toBe(
      'Double Frogfizz and Bluebell',
    )
    expect(potionName(potion(['bluebell', 'frogfizz', 'frogfizz']))).toBe(
      'Bluebell and Double Frogfizz',
    )
    expect(potionName(potion(['starpetal', 'starpetal', 'starpetal']))).toBe('Triple Starpetal')
    expect(potionName(potion(['rosehip', 'rosehip']))).toBe('Double Rosehip')
  })

  it('names the effect, the main ingredient and the shape noun once mixed', () => {
    expect(potionName(mixed(['moonmilk', 'rosehip', 'starpetal']))).toBe('Dreamy Rosehip Potion')
    expect(potionName(mixed(['frogfizz', 'frogfizz', 'bluebell'], { shape: 'tall' }))).toBe(
      'Floating Frogfizz Essence',
    )
    expect(potionName(mixed(['emberroot', 'emberroot', 'puffcap'], { shape: 'gourd' }))).toBe(
      'Whiffy Puffcap Swirl',
    )
    expect(
      potionName(mixed(['thundercloud', 'snailshine', 'moonmilk'], { shape: 'shoulder' })),
    ).toBe('Whirling Thundercloud Wonder')
    expect(potionName(mixed(['snailshine', 'bluebell', 'bluebell'], { shape: 'round' }))).toBe(
      'Sparkling Bluebell Brew',
    )
  })

  it('calls three of one Pure, with its label in title case', () => {
    expect(potionName(mixed(['bluebell', 'bluebell', 'bluebell']))).toBe('Pure Bluebell Dew')
    expect(potionName(mixed(['moonmilk', 'moonmilk', 'moonmilk']))).toBe('Pure Moonmilk')
  })

  it('names a mixed secret blend by its own name, ahead of Pure and the murky names', () => {
    for (const blend of SECRET_BLENDS) {
      const p = mixed(blend.recipe)
      expect(potionName(p), blend.id).toBe(blend.name)
      expect(potionLore(p), blend.id).toBe(blend.lore)
    }
    expect(potionName(mixed(['starpetal', 'starpetal', 'starpetal']))).toBe('A Pocketful of Stars')
    expect(potionName(mixed(['frogfizz', 'thundercloud', 'puffcap']))).toBe('Bottom of the Pond')
  })

  it('does not name a blend before it is mixed', () => {
    expect(potionName(potion(['thundercloud', 'thundercloud', 'moonmilk']))).toBe(
      'Double Thundercloud and Moonmilk',
    )
  })

  it('names a murky mix from the sum of the wheel places', () => {
    expect(potionName(mixed(['frogfizz', 'bluebell', 'puffcap']))).toBe('A Marvellous Muddle')
    const names = new Set<string>()
    for (const m of multisets()) {
      if (mixPotion(m as [IngredientId, IngredientId, IngredientId]).outcome !== 'murky') continue
      const p = mixed(m)
      if (SECRET_BLENDS.some((b) => b.name === potionName(p))) continue
      const places = m.reduce((sum, id) => sum + ingredient(id).wheel, 0)
      names.add(potionName(p))
      expect(potionName(p)).toBe(
        [
          'A Marvellous Muddle',
          'Bottled Bog',
          "Frog's Bathwater",
          'Swampy Surprise',
          'Grumbling Gloop',
          'Muddy Wellies',
          'Tadpole Puddle',
        ][places % 7],
      )
    }
    expect(names.size).toBeGreaterThan(1)
  })

  it('names the potion the same whatever the order of a mix', () => {
    expect(potionName(mixed(['rosehip', 'starpetal', 'moonmilk']))).toBe(
      potionName(mixed(['moonmilk', 'rosehip', 'starpetal'])),
    )
  })

  it('falls back to the round noun and then the label when a name is forbidden', () => {
    const forbidden = (name: string) => name === 'Floating Frogfizz Essence'
    expect(nameFrom('Floating', 'Frogfizz', 'Frogfizz', 'Essence', forbidden)).toBe(
      'Floating Frogfizz Brew',
    )
    const worse = (name: string) => name.endsWith('Essence') || name.endsWith('Brew')
    expect(nameFrom('Floating', 'Frogfizz', 'Frogfizz', 'Essence', worse)).toBe('Frogfizz Essence')
  })

  it('never produces a forbidden name anywhere in the catalogue', () => {
    for (const p of catalogue()) expect(isForbiddenName(potionName(p)), potionName(p)).toBe(false)
  })

  it('never makes a forbidden name from any effect word, ingredient word and noun', () => {
    const nouns = ['Brew', 'Potion', 'Essence', 'Wonder', 'Swirl']
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
      ...catalogue().flatMap((p) => [
        potionName(p),
        potionTagLine(p),
        potionLore(p),
        potionShelfLine(p),
      ]),
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
  it('counts the layers and names the traits bottom first', () => {
    expect(potionTagLine(potion(['moonmilk', 'rosehip', 'starpetal'], { shape: 'teardrop' }))).toBe(
      'Three layers in a teardrop flask. Cloudy, then swirly, then sparkly.',
    )
  })

  it('merges repeats in a row and keeps a trait that comes back', () => {
    expect(potionTagLine(potion(['frogfizz', 'starpetal', 'starpetal'], { shape: 'tall' }))).toBe(
      'Three layers in a tall bottle. Fizzy, then sparkly.',
    )
    expect(potionTagLine(potion(['moonmilk', 'emberroot', 'moonmilk']))).toMatch(
      /Cloudy, then glowing, then cloudy\.$/,
    )
  })

  it('says layer for one, with every trait word', () => {
    expect(potionTagLine(potion(['bluebell'], { shape: 'round' }))).toBe(
      'One layer in a round flask. Clear.',
    )
    expect(potionTagLine(potion(['emberroot', 'frogfizz'], { shape: 'shoulder' }))).toBe(
      'Two layers in a square-shouldered bottle. Glowing, then fizzy.',
    )
    expect(potionTagLine(potion(['frogfizz'], { shape: 'gourd' }))).toBe(
      'One layer in a gourd bottle. Fizzy.',
    )
  })

  it('waits for three ingredients when empty', () => {
    expect(potionTagLine(potion([], { shape: 'tall' }))).toBe(
      'An empty tall bottle, waiting for three ingredients.',
    )
  })

  it('says what the potion does once mixed', () => {
    expect(potionTagLine(mixed(['frogfizz', 'frogfizz', 'bluebell'], { shape: 'tall' }))).toBe(
      'One dab on each shoe and you float as high as the table, until a frog croaks. It leaves you with bouncy eyelashes.',
    )
  })

  it('keeps murky its own words', () => {
    expect(potionTagLine(mixed(['frogfizz', 'bluebell', 'puffcap']))).toBe(
      'Mixed from Frogfizz, Bluebell and Puffcap in a teardrop flask.',
    )
  })

  it('gives a secret blend the same kind of line as any mixed potion', () => {
    for (const blend of SECRET_BLENDS.filter(
      (b) => mixPotion(b.recipe as Recipe).outcome !== 'murky',
    ))
      expect(potionTagLine(mixed([...blend.recipe]))).toMatch(/\. It leaves you with /)
  })

  describe('over every recipe', () => {
    const recipes = multisets()
    const outcomes = recipes.map((r) => ({ r, mix: mixPotion(r as unknown as Recipe) }))
    const speaking = outcomes.filter(({ mix }) => mix.outcome !== 'murky')
    const lineOf = (r: IngredientId[]) => potionTagLine(mixed(r))

    it('has 165 recipes, 144 of them not murky', () => {
      expect(recipes).toHaveLength(165)
      expect(speaking).toHaveLength(144)
    })

    it('is the same in every pouring order', () => {
      for (const { r } of speaking) {
        const [a, b, c] = r as [IngredientId, IngredientId, IngredientId]
        const orders = [
          [a, b, c],
          [a, c, b],
          [b, a, c],
          [b, c, a],
          [c, a, b],
          [c, b, a],
        ]
        for (const order of orders) expect(lineOf(order)).toBe(lineOf(r))
      }
    })

    it('is different for each of the 144 recipes that are not murky', () => {
      expect(new Set(speaking.map(({ r }) => lineOf(r))).size).toBe(144)
    })

    it('never mentions drinking, tasting or eating', () => {
      for (const { r } of speaking) expect(lineOf(r)).not.toMatch(DRINKING)
    })

    it('stays within the cap', () => {
      for (const { r } of speaking) expect(lineOf(r).length).toBeLessThanOrEqual(LINE_CAP)
    })
  })
})

describe('potionLore', () => {
  it('is the top layer line and what it still needs, until three are in', () => {
    expect(potionLore(potion(['frogfizz']))).toBe(
      `${ingredient('frogfizz').lore} It needs two more before it can be mixed.`,
    )
    expect(potionLore(potion(['frogfizz', 'bluebell']))).toBe(
      `${ingredient('bluebell').lore} It needs one more before it can be mixed.`,
    )
    expect(potionLore(potion(['frogfizz', 'moonmilk', 'bluebell']))).toBe(
      `${ingredient('bluebell').lore} Tap the bottle to mix it and see what it does.`,
    )
  })

  it('is the main ingredient line then the effect sentence once mixed', () => {
    expect(potionLore(mixed(['frogfizz', 'bluebell', 'frogfizz']))).toBe(
      `${ingredient('frogfizz').lore} ${EFFECTS.floating.sentence}`,
    )
  })

  it('is proud of a murky mix', () => {
    expect(potionLore(mixed(['frogfizz', 'bluebell', 'puffcap']))).toBe(
      'Three things that would not get on, swirled into one. It does nothing at all, and it is very proud of that. Pull the cork and one lazy bubble goes blorp.',
    )
  })

  it('says how every potion starts when empty', () => {
    expect(potionLore(potion([]))).toBe(
      'Every potion starts as an empty bottle. Pick three ingredients.',
    )
  })

  it('is never forbidden, and two sentences unless murky', () => {
    for (const p of catalogue()) {
      const lore = potionLore(p)
      expect(isForbiddenName(lore)).toBe(false)
      if (!lore.includes('proud of that')) expect(sentences(lore)).toHaveLength(2)
    }
  })
})

describe('potionShelfLine', () => {
  it('gives the shape and the layer count', () => {
    expect(potionShelfLine(potion(['moonmilk'], { shape: 'gourd' }))).toBe(
      'Gourd bottle, one layer',
    )
    expect(potionShelfLine(potion(['moonmilk', 'rosehip'], { shape: 'gourd' }))).toBe(
      'Gourd bottle, two layers',
    )
    expect(potionShelfLine(potion([], { shape: 'round' }))).toBe('Round flask, empty')
  })

  it('gives the effect once mixed', () => {
    expect(potionShelfLine(mixed(['emberroot', 'emberroot', 'puffcap'], { shape: 'gourd' }))).toBe(
      'Gourd bottle, whiffy',
    )
    expect(potionShelfLine(mixed(['frogfizz', 'bluebell', 'puffcap'], { shape: 'tall' }))).toBe(
      'Tall bottle, murky',
    )
  })
})

describe('potionGlowColour', () => {
  it('is candlelight when empty and the top layer unmixed', () => {
    expect(potionGlowColour(potion([]))).toBe('#e8b46a')
    expect(potionGlowColour(potion(['moonmilk', 'emberroot']))).toBe(ingredient('emberroot').colour)
  })

  it('is the mixed colour once mixed', () => {
    const recipe: [IngredientId, IngredientId, IngredientId] = ['moonmilk', 'rosehip', 'starpetal']
    expect(potionGlowColour(mixed(recipe))).toBe(mixPotion(recipe).colour)
  })
})

describe('isGold', () => {
  it('is true only for a mixed secret blend', () => {
    expect(isGold(mixed(['starpetal', 'starpetal', 'starpetal']))).toBe(true)
    expect(isGold(potion(['starpetal', 'starpetal', 'starpetal']))).toBe(false)
    expect(isGold(mixed(['moonmilk', 'rosehip', 'starpetal']))).toBe(false)
    expect(isGold(potion([]))).toBe(false)
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
