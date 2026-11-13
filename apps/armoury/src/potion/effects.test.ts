import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { EFFECTS, potionEffect } from './effects.ts'
import { type EffectKind, ingredient, type IngredientId } from './ingredients.ts'
import { mixPotion } from './mix.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'

const potion = (pours: IngredientId[], mixed = 'yes') =>
  normalise(potionSchema, { ...withPours(pours), mixed })
const colourOf = (id: IngredientId) => ingredient(id).colour

describe('potionEffect', () => {
  it('is null until the potion is mixed', () => {
    expect(potionEffect(potion([], 'no'))).toBeNull()
    expect(potionEffect(potion(['frogfizz', 'frogfizz', 'bluebell'], 'no'))).toBeNull()
  })

  it('takes its kind and strength from the mix', () => {
    const recipe: [IngredientId, IngredientId, IngredientId] = ['frogfizz', 'frogfizz', 'bluebell']
    const effect = potionEffect(potion(recipe))
    expect(effect?.kind).toBe(mixPotion(recipe).outcome)
    expect(effect?.kind).toBe('floating')
    expect(effect?.strength).toBe(2)
  })

  it('gives three of one its own effect at strength 3', () => {
    expect(potionEffect(potion(['bluebell', 'bluebell', 'bluebell']))).toMatchObject({
      kind: 'sparkling',
      strength: 3,
    })
  })

  it('starts its colours with the mixed colour, then the carriers in pour order, unique', () => {
    const effect = potionEffect(potion(['frogfizz', 'moonmilk', 'bluebell']))
    expect(effect?.colours[0]).toBe(mixPotion(['frogfizz', 'moonmilk', 'bluebell']).colour)
    const same = potionEffect(potion(['frogfizz', 'frogfizz', 'bluebell']))
    expect(same?.colours).toEqual([
      mixPotion(['frogfizz', 'frogfizz', 'bluebell']).colour,
      colourOf('frogfizz'),
    ])
  })

  it('is murky with only the mud colour when the mix clashes', () => {
    const effect = potionEffect(potion(['frogfizz', 'bluebell', 'puffcap']))
    expect(effect).toEqual({
      kind: 'murky',
      strength: 1,
      colours: [mixPotion(['frogfizz', 'bluebell', 'puffcap']).colour],
    })
  })
})

describe('EFFECTS', () => {
  const kinds: (EffectKind | 'murky')[] = [
    'floating',
    'sparkling',
    'dreamy',
    'glowing',
    'whirling',
    'whiffy',
    'murky',
  ]

  it('has a word and a one-sentence line for each of the six kinds and murky', () => {
    expect(Object.keys(EFFECTS).sort()).toEqual([...kinds].sort())
    for (const kind of kinds) {
      expect(EFFECTS[kind].word).toMatch(/^[A-Z][a-z]+$/)
      expect(EFFECTS[kind].sentence).toMatch(/^[^.!?]+\.$/)
    }
  })

  it('says what murky does', () => {
    expect(EFFECTS.murky).toEqual({
      word: 'Murky',
      sentence: 'Pull the cork and one lazy bubble goes blorp.',
    })
  })
})
