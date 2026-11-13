import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { INGREDIENTS, ingredient, type IngredientId } from './ingredients.ts'
import {
  MURK_REACH,
  mixPotion,
  potionMix,
  SECTOR_ORDER,
  SECTOR_START_DEGREES,
  WHEEL_STEP_DEGREES,
} from './mix.ts'
import { hexToOklch } from './mixColour.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'

type Recipe = [IngredientId, IngredientId, IngredientId]

const ids = INGREDIENTS.map((i) => i.id)
const multisets: Recipe[] = []
for (let a = 0; a < 9; a++)
  for (let b = a; b < 9; b++)
    for (let c = b; c < 9; c++) multisets.push([ids[a]!, ids[b]!, ids[c]!])

const orders: Recipe[] = ids.flatMap((a) => ids.flatMap((b) => ids.map((c): Recipe => [a, b, c])))

const tally = (recipes: Recipe[]) => {
  const counts: Record<string, number> = {}
  for (const r of recipes) {
    const { outcome } = mixPotion(r)
    counts[outcome] = (counts[outcome] ?? 0) + 1
  }
  return counts
}

const permutations = ([a, b, c]: Recipe): Recipe[] => [
  [a, b, c],
  [a, c, b],
  [b, a, c],
  [b, c, a],
  [c, a, b],
  [c, b, a],
]

const wheelGaps = (r: Recipe) => {
  const [a, b, c] = r.map((id) => ingredient(id).wheel).sort((x, y) => x - y) as [
    number,
    number,
    number,
  ]
  return [b - a, c - b, 9 - (c - a)].sort((x, y) => x - y)
}

describe('the wheel', () => {
  it('has the constants the spec fixes', () => {
    expect(WHEEL_STEP_DEGREES).toBe(40)
    expect(SECTOR_START_DEGREES).toBe(-3.25)
    expect(MURK_REACH).toBe(0.78)
    expect(SECTOR_ORDER).toEqual([
      'glowing',
      'floating',
      'sparkling',
      'whirling',
      'dreamy',
      'whiffy',
    ])
  })

  it('has every ingredient own effect agree with three of it', () => {
    for (const i of INGREDIENTS) {
      expect(mixPotion([i.id, i.id, i.id]).outcome, i.id).toBe(i.effect)
    }
  })
})

describe('mixPotion outcomes', () => {
  it('gives each effect 24 of the 165 recipes and murky 21', () => {
    expect(multisets).toHaveLength(165)
    expect(tally(multisets)).toEqual({
      glowing: 24,
      floating: 24,
      sparkling: 24,
      whirling: 24,
      dreamy: 24,
      whiffy: 24,
      murky: 21,
    })
  })

  it('gives murky 126 and each effect 100 or 101 of the 729 ordered fills', () => {
    expect(orders).toHaveLength(729)
    const counts = tally(orders)
    expect(counts.murky).toBe(126)
    for (const kind of SECTOR_ORDER) expect([100, 101]).toContain(counts[kind])
  })

  it('gives the same mix for every order of a recipe', () => {
    for (const recipe of multisets) {
      const first = mixPotion(recipe)
      for (const order of permutations(recipe))
        expect(mixPotion(order), recipe.join()).toEqual(first)
    }
  })

  it('never makes three of one murky', () => {
    for (const id of ids) expect(mixPotion([id, id, id]).outcome).not.toBe('murky')
  })

  it('is murky exactly when three different ingredients have wheel gaps 3,3,3 or 2,3,4', () => {
    for (const recipe of multisets) {
      const gaps = wheelGaps(recipe).join()
      const clash = new Set(recipe).size === 3 && (gaps === '3,3,3' || gaps === '2,3,4')
      expect(mixPotion(recipe).outcome === 'murky', recipe.join()).toBe(clash)
    }
  })

  it('keeps every effect sum at least a degree from a sector edge', () => {
    for (const recipe of multisets) {
      const mix = mixPotion(recipe)
      if (mix.outcome === 'murky') continue
      const intoSector = (((mix.angle - SECTOR_START_DEGREES) % 60) + 60) % 60
      expect(Math.min(intoSector, 60 - intoSector), recipe.join()).toBeGreaterThanOrEqual(1)
    }
  })

  it('has six surprises among the 84 recipes of three different', () => {
    const different = multisets.filter((r) => new Set(r).size === 3)
    expect(different).toHaveLength(84)
    const surprise = different.filter((r) => {
      const { outcome } = mixPotion(r)
      return outcome !== 'murky' && !r.some((id) => ingredient(id).effect === outcome)
    })
    expect(surprise).toHaveLength(6)
  })
})

describe('mixPotion main, strength and trait', () => {
  it('names a surprise by the ingredient nearest the sum', () => {
    const mix = mixPotion(['starpetal', 'snailshine', 'bluebell'])
    expect(mix).toMatchObject({ outcome: 'floating', main: 'snailshine', strength: 1 })
  })

  it('names the most repeated carrier, and its trait', () => {
    expect(mixPotion(['frogfizz', 'frogfizz', 'bluebell'])).toMatchObject({
      outcome: 'floating',
      main: 'frogfizz',
      strength: 2,
      trait: 'fizz',
    })
  })

  it('breaks a tie between carriers by the nearest to the sum', () => {
    const mix = mixPotion(['moonmilk', 'rosehip', 'starpetal'])
    expect(mix).toMatchObject({ outcome: 'dreamy', main: 'rosehip', strength: 2 })
  })

  it('counts all three carriers as strength 3', () => {
    expect(mixPotion(['bluebell', 'bluebell', 'snailshine'])).toMatchObject({
      outcome: 'sparkling',
      strength: 3,
    })
  })

  it('is whiffy with a pulling Puffcap, ahead of two Emberroots', () => {
    expect(mixPotion(['emberroot', 'emberroot', 'puffcap'])).toMatchObject({
      outcome: 'whiffy',
      main: 'puffcap',
    })
  })

  it('has no main, strength 1 and the murk trait when murky', () => {
    expect(mixPotion(['frogfizz', 'bluebell', 'puffcap'])).toMatchObject({
      outcome: 'murky',
      main: null,
      strength: 1,
      trait: 'murk',
    })
  })

  it('keeps strength between 1 and 3 and a main only for an effect', () => {
    for (const recipe of multisets) {
      const mix = mixPotion(recipe)
      expect([1, 2, 3]).toContain(mix.strength)
      expect(mix.main === null, recipe.join()).toBe(mix.outcome === 'murky')
    }
  })
})

describe('mixPotion colour', () => {
  it('lands the spec starting values', () => {
    expect(mixPotion(['moonmilk', 'rosehip', 'starpetal']).colour).toBe('#c85370')
    expect(mixPotion(['moonmilk', 'moonmilk', 'moonmilk']).colour).toBe('#c9a3f5')
    expect(mixPotion(['bluebell', 'bluebell', 'bluebell']).colour).toBe('#5b8def')
    expect(mixPotion(['frogfizz', 'bluebell', 'puffcap']).colour).toBe('#645e40')
  })

  it('is a jewel colour for an effect and a dull one when murky', () => {
    for (const recipe of multisets) {
      const mix = mixPotion(recipe)
      const { l, c } = hexToOklch(mix.colour)
      if (mix.outcome === 'murky') {
        expect(c, recipe.join()).toBeLessThanOrEqual(0.05 + 0.005)
        expect(l, recipe.join()).toBeLessThanOrEqual(0.5)
      } else {
        expect(c, recipe.join()).toBeGreaterThanOrEqual(0.12 - 0.005)
        expect(l, recipe.join()).toBeGreaterThanOrEqual(0.58 - 0.01)
        expect(l, recipe.join()).toBeLessThanOrEqual(0.78 + 0.01)
      }
    }
  })

  it('keeps reach between 0 and 3 and the angle within a turn', () => {
    for (const recipe of multisets) {
      const { reach, angle } = mixPotion(recipe)
      expect(reach).toBeGreaterThanOrEqual(0)
      expect(reach).toBeLessThanOrEqual(3 + 1e-9)
      expect(angle).toBeGreaterThanOrEqual(0)
      expect(angle).toBeLessThan(360)
    }
  })
})

describe('potionMix', () => {
  const potion = (pours: IngredientId[], rest: Record<string, unknown> = {}) =>
    normalise(potionSchema, { ...withPours(pours), ...rest })

  it('is null until all three slots are filled', () => {
    expect(potionMix(potion([]))).toBeNull()
    expect(potionMix(potion(['moonmilk', 'rosehip']))).toBeNull()
  })

  it('is the mix of the three, whether or not the potion is mixed', () => {
    const recipe: Recipe = ['frogfizz', 'frogfizz', 'bluebell']
    expect(potionMix(potion(recipe))).toEqual(mixPotion(recipe))
    expect(potionMix(potion(recipe, { mixed: 'yes' }))).toEqual(mixPotion(recipe))
  })
})
