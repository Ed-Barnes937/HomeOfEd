import { describe, expect, it } from 'vitest'

import { isForbiddenName } from './doNotUse.ts'
import { type EffectKind, INGREDIENTS, ingredient, type Trait } from './ingredients.ts'
import { mixPotion } from './mix.ts'

const TRAITS: Trait[] = ['clear', 'cloud', 'fizz', 'glitter', 'glow', 'swirl', 'murk']
const EFFECTS: EffectKind[] = ['floating', 'sparkling', 'dreamy', 'glowing', 'whirling', 'whiffy']

describe('INGREDIENTS', () => {
  it('has the nine ids in wheel order, each at its own place', () => {
    expect(INGREDIENTS.map((i) => i.id)).toEqual([
      'emberroot',
      'starpetal',
      'frogfizz',
      'snailshine',
      'bluebell',
      'thundercloud',
      'moonmilk',
      'rosehip',
      'puffcap',
    ])
    expect(INGREDIENTS.map((i) => i.wheel)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('gives no ingredient the murk trait, and has Puffcap in place of Bog murk', () => {
    expect(INGREDIENTS.some((i) => i.trait === 'murk')).toBe(false)
    expect(INGREDIENTS.some((i) => i.id === ('bogmurk' as string))).toBe(false)
    expect(ingredient('puffcap')).toMatchObject({
      label: 'Puffcap',
      colour: '#c9343f',
      effect: 'whiffy',
    })
  })

  it('has an own effect that agrees with the mix of three of it', () => {
    for (const i of INGREDIENTS) expect(mixPotion([i.id, i.id, i.id]).outcome).toBe(i.effect)
  })

  it('has hex colours, known traits and known effects', () => {
    for (const i of INGREDIENTS) {
      expect(i.colour).toMatch(/^#[0-9a-f]{6}$/)
      expect(TRAITS).toContain(i.trait)
      expect(EFFECTS).toContain(i.effect)
    }
  })

  it('has one-sentence lore ending in a full stop', () => {
    for (const i of INGREDIENTS) expect(i.lore).toMatch(/^[^.!?]+\.$/)
  })

  it('has a label and a name word for each', () => {
    for (const i of INGREDIENTS) {
      expect(i.label.length).toBeGreaterThan(0)
      expect(i.word).toMatch(/^[A-Z][a-z]+$/)
    }
  })

  it('looks one up by id', () => {
    expect(ingredient('frogfizz')).toMatchObject({
      label: 'Frogfizz',
      trait: 'fizz',
      effect: 'floating',
    })
  })

  it('has no label, word or lore line that is a forbidden name', () => {
    for (const i of INGREDIENTS) {
      for (const text of [i.label, i.word, i.lore]) expect(isForbiddenName(text), text).toBe(false)
    }
  })
})
