import { describe, expect, it } from 'vitest'

import { isForbiddenName } from './doNotUse.ts'
import { type EffectKind, INGREDIENTS, ingredient, MURK, type Trait } from './ingredients.ts'

const TRAITS: Trait[] = ['clear', 'cloud', 'fizz', 'glitter', 'glow', 'swirl']
const EFFECTS: EffectKind[] = ['floating', 'sparkling', 'dreamy', 'glowing', 'whirling', 'whiffy']

describe('INGREDIENTS', () => {
  it('has the nine ids in the spec order', () => {
    expect(INGREDIENTS.map((i) => i.id)).toEqual([
      'moonmilk',
      'frogfizz',
      'starpetal',
      'emberroot',
      'bluebell',
      'rosehip',
      'thundercloud',
      'snailshine',
      'bogmurk',
    ])
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
    expect(ingredient(MURK).label).toBe('Bog murk')
  })

  it('has no label, word or lore line that is a forbidden name', () => {
    for (const i of INGREDIENTS) {
      for (const text of [i.label, i.word, i.lore]) expect(isForbiddenName(text), text).toBe(false)
    }
  })
})
