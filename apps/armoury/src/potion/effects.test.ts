import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { EFFECTS, potionEffect } from './effects.ts'
import { type EffectKind, ingredient, INGREDIENTS, type IngredientId } from './ingredients.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'

const potion = (...pours: IngredientId[]) => normalise(potionSchema, { ...withPours(pours) })
const colourOf = (id: IngredientId) => ingredient(id).colour

describe('potionEffect', () => {
  it('is null for an empty bottle', () => {
    expect(potionEffect(potion())).toBeNull()
  })

  it('gives a single pour its own ingredient effect at strength 1', () => {
    for (const i of INGREDIENTS) {
      expect(potionEffect(potion(i.id))).toEqual({
        kind: i.effect,
        strength: 1,
        colours: [i.colour],
      })
    }
  })

  it('lets the most common effect win', () => {
    const effect = potionEffect(potion('frogfizz', 'bluebell', 'starpetal'))
    expect(effect?.kind).toBe('floating')
    expect(effect?.strength).toBe(2)
  })

  it('breaks a tie in favour of the highest pour', () => {
    expect(potionEffect(potion('moonmilk', 'emberroot'))?.kind).toBe('glowing')
    expect(potionEffect(potion('emberroot', 'moonmilk'))?.kind).toBe('dreamy')
    expect(potionEffect(potion('frogfizz', 'frogfizz', 'starpetal', 'starpetal'))?.kind).toBe(
      'sparkling',
    )
    expect(potionEffect(potion('starpetal', 'starpetal', 'frogfizz', 'frogfizz'))?.kind).toBe(
      'floating',
    )
  })

  it('counts the pours that carry the effect as its strength', () => {
    const four = potion('starpetal', 'snailshine', 'starpetal', 'snailshine')
    expect(potionEffect(four)?.strength).toBe(4)
    expect(potionEffect(potion('starpetal', 'snailshine', 'moonmilk'))?.strength).toBe(2)
  })

  it('lists the colours of the carrying pours, top first', () => {
    const effect = potionEffect(potion('frogfizz', 'moonmilk', 'bluebell'))
    expect(effect?.colours).toEqual([colourOf('bluebell'), colourOf('frogfizz')])
  })

  it('is whiffy only with a Bog murk pour, and then only when murk comes out on top', () => {
    for (const a of INGREDIENTS) {
      for (const b of INGREDIENTS) {
        const kind = potionEffect(potion(a.id, b.id))?.kind
        expect(kind === 'whiffy').toBe(b.id === 'bogmurk')
      }
    }
  })
})

describe('EFFECTS', () => {
  const kinds: EffectKind[] = ['floating', 'sparkling', 'dreamy', 'glowing', 'whirling', 'whiffy']

  it('has a word and a one-sentence line for each of the six kinds', () => {
    expect(Object.keys(EFFECTS).sort()).toEqual([...kinds].sort())
    for (const kind of kinds) {
      expect(EFFECTS[kind].word).toMatch(/^[A-Z][a-z]+$/)
      expect(EFFECTS[kind].sentence).toMatch(/^[^.!?]+\.$/)
    }
  })
})
