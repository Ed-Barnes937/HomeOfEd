import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { SECRET_BLENDS, secretBlend } from './blends.ts'
import { isForbiddenName } from './doNotUse.ts'
import type { IngredientId } from './ingredients.ts'
import { mixPotion } from './mix.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'

const potion = (pours: IngredientId[], mixed = 'yes') =>
  normalise(potionSchema, { ...withPours(pours), mixed })
const sentences = (text: string) => text.split(/[.!?]/).filter((s) => s.trim() !== '')
const multiset = (ids: readonly string[]) => [...ids].sort().join()

const OUTCOMES: Record<string, string> = {
  'moon-behind-storm': 'whirling',
  sunrise: 'glowing',
  sunset: 'dreamy',
  'pond-life': 'sparkling',
  frogspawn: 'floating',
  'milky-way': 'dreamy',
  'pink-ribbons': 'dreamy',
  'storms-gold-star': 'whirling',
  'sea-glass': 'sparkling',
  'clouds-blue-day': 'whirling',
  'bottom-of-the-pond': 'murky',
  'pocketful-of-stars': 'glowing',
}

describe('SECRET_BLENDS', () => {
  it('has at most twelve blends', () => {
    expect(SECRET_BLENDS).toHaveLength(12)
  })

  it('has unique ids, names and recipes as multisets', () => {
    expect(new Set(SECRET_BLENDS.map((b) => b.id)).size).toBe(SECRET_BLENDS.length)
    expect(new Set(SECRET_BLENDS.map((b) => b.name)).size).toBe(SECRET_BLENDS.length)
    expect(new Set(SECRET_BLENDS.map((b) => multiset(b.recipe))).size).toBe(SECRET_BLENDS.length)
  })

  it('is reachable: every blend is found by secretBlend, in any order, once mixed', () => {
    for (const blend of SECRET_BLENDS) {
      const [a, b, c] = blend.recipe
      for (const order of [
        [a, b, c],
        [c, b, a],
        [b, a, c],
      ] as IngredientId[][]) {
        expect(secretBlend(potion(order)), blend.id).toBe(blend)
      }
    }
  })

  it('gives each blend the outcome the spec says', () => {
    for (const blend of SECRET_BLENDS) {
      expect(mixPotion(blend.recipe).outcome, blend.id).toBe(OUTCOMES[blend.id])
    }
  })

  it('has two-sentence lore, with no forbidden words', () => {
    for (const blend of SECRET_BLENDS) {
      expect(sentences(blend.lore), blend.id).toHaveLength(2)
      expect(isForbiddenName(blend.name)).toBe(false)
      for (const s of sentences(blend.lore)) expect(isForbiddenName(s)).toBe(false)
    }
  })
})

describe('secretBlend', () => {
  it('is null until the potion is mixed', () => {
    for (const blend of SECRET_BLENDS) expect(secretBlend(potion(blend.recipe, 'no'))).toBeNull()
  })

  it('names three starpetals A Pocketful of Stars', () => {
    expect(secretBlend(potion(['starpetal', 'starpetal', 'starpetal']))?.name).toBe(
      'A Pocketful of Stars',
    )
  })

  it('needs all three ingredients, as a multiset', () => {
    expect(secretBlend(potion(['thundercloud', 'moonmilk', 'moonmilk']))).toBeNull()
    expect(secretBlend(potion(['thundercloud', 'moonmilk']))).toBeNull()
    expect(secretBlend(potion([]))).toBeNull()
    expect(secretBlend(potion(['moonmilk', 'rosehip', 'starpetal']))).toBeNull()
  })
})
