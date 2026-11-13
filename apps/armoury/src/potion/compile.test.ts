import { describe, expect, it } from 'vitest'

import { defaults, normalise } from '../engine/schema.ts'
import { type LinearRgb, linearToSrgb, srgbToLinear } from '../items/colour.ts'
import { drawnHeightMm } from './bottles.ts'
import { compilePotion } from './compile.ts'
import { TALLEST_MM } from './framing.ts'
import { type IngredientId, INGREDIENTS, ingredient } from './ingredients.ts'
import { potionSchema } from './potionSchema.ts'
import { pourList, withPours } from './pours.ts'

const potion = (pours: IngredientId[], rest: Record<string, unknown> = {}) =>
  normalise(potionSchema, { ...withPours(pours), ...rest })

const ids = INGREDIENTS.map((i) => i.id)
const catalogue: IngredientId[][] = [
  [],
  ...ids.map((id) => [id]),
  ...ids.flatMap((a) => ids.map((b) => [a, b])),
  ['moonmilk', 'rosehip', 'starpetal'],
]

describe('compilePotion', () => {
  it('compiles the first-visit potion', () => {
    const spec = compilePotion(defaults(potionSchema))
    expect(spec).toMatchObject({
      shape: 'teardrop',
      glass: 'clear',
      stopper: 'cork',
      label: 'round',
      fill: 0.75,
      waxColour: null,
    })
    expect(spec.layers).toEqual([
      { ingredient: 'moonmilk', colour: '#ece6f4', trait: 'cloud' },
      { ingredient: 'rosehip', colour: '#d9467a', trait: 'swirl' },
      { ingredient: 'starpetal', colour: '#f2c14e', trait: 'glitter' },
    ])
  })

  it('takes heights from the tables', () => {
    const p = potion(['moonmilk'], { shape: 'gourd', neck: 1 })
    const spec = compilePotion(p)
    expect(spec.bodyHeightMm).toBe(130)
    expect(spec.neckMm).toBe(45)
    expect(spec.heightMm).toBe(drawnHeightMm(p))
    expect(spec.heightMm).toBeLessThan(TALLEST_MM)
  })

  it('has layers in pour order with the ingredients own colour and trait', () => {
    for (const pours of catalogue) {
      const p = potion(pours)
      const spec = compilePotion(p)
      expect(spec.layers.map((l) => l.ingredient)).toEqual(pourList(p))
      for (const l of spec.layers) {
        expect(l.colour).toBe(ingredient(l.ingredient).colour)
        expect(l.trait).toBe(ingredient(l.ingredient).trait)
      }
      expect(spec.fill).toBe(pours.length / 4)
    }
  })

  it('brings no colour that no pour brought', () => {
    for (const pours of catalogue) {
      const brought = new Set(pours.map((id) => ingredient(id).colour))
      for (const l of compilePotion(potion(pours)).layers) expect(brought.has(l.colour)).toBe(true)
    }
  })

  describe('waxColour', () => {
    it('is the top pour darkened by 35 percent in linear light under wax', () => {
      const spec = compilePotion(potion(['moonmilk', 'frogfizz'], { stopper: 'wax' }))
      const expected = linearToSrgb(srgbToLinear('#7ccf4f').map((v) => v * 0.65) as LinearRgb)
      expect(spec.waxColour).toBe(expected)
    })

    it('is a dull red on an empty bottle and null without wax', () => {
      expect(compilePotion(potion([], { stopper: 'wax' })).waxColour).toBe('#7a2a24')
      expect(compilePotion(potion(['frogfizz'], { stopper: 'cork' })).waxColour).toBeNull()
      expect(compilePotion(potion([], { stopper: 'glass' })).waxColour).toBeNull()
    })
  })
})
