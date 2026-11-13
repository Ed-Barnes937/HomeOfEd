import { describe, expect, it } from 'vitest'

import { defaults, normalise } from '../engine/schema.ts'
import { type LinearRgb, linearToSrgb, srgbToLinear } from '../items/colour.ts'
import { BOTTLES, drawnHeightMm } from './bottles.ts'
import { compilePotion } from './compile.ts'
import { TALLEST_MM } from './framing.ts'
import { type IngredientId, INGREDIENTS, ingredient } from './ingredients.ts'
import { mixPotion } from './mix.ts'
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
      fill: 1,
      mixed: false,
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
    expect(spec.bodyHeightMm).toBe(BOTTLES.gourd.bodyHeightMm)
    expect(spec.neckMm).toBe(BOTTLES.gourd.neckMm[1])
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
      expect(spec.fill).toBe(pours.length / 3)
    }
  })

  it('brings no colour that no pour brought', () => {
    for (const pours of catalogue) {
      const brought = new Set(pours.map((id) => ingredient(id).colour))
      for (const l of compilePotion(potion(pours)).layers) expect(brought.has(l.colour)).toBe(true)
    }
  })

  describe('the mix', () => {
    const recipe: [IngredientId, IngredientId, IngredientId] = ['frogfizz', 'frogfizz', 'bluebell']

    it('is there whenever three are in, mixed or not, and null below three', () => {
      expect(compilePotion(potion([...recipe])).mix).toEqual(mixPotion(recipe))
      expect(compilePotion(potion([...recipe])).mixed).toBe(false)
      expect(compilePotion(potion([...recipe], { mixed: 'yes' })).mixed).toBe(true)
      expect(compilePotion(potion([...recipe], { mixed: 'yes' })).mix).toEqual(mixPotion(recipe))
      expect(compilePotion(potion(['frogfizz', 'bluebell'])).mix).toBeNull()
      expect(compilePotion(potion([])).mixed).toBe(false)
    })

    it('keeps the layers unmixed and a mixed potion full', () => {
      const spec = compilePotion(potion([...recipe], { mixed: 'yes' }))
      expect(spec.layers.map((l) => l.ingredient)).toEqual(recipe)
      expect(spec.fill).toBe(1)
    })

    it('takes the wax from the mixed colour when mixed, the top layer when not', () => {
      const darkened = (hex: string) =>
        linearToSrgb(srgbToLinear(hex).map((v) => v * 0.65) as LinearRgb)
      const mixed = compilePotion(potion([...recipe], { mixed: 'yes', stopper: 'wax' }))
      expect(mixed.waxColour).toBe(darkened(mixPotion(recipe).colour))
      const unmixed = compilePotion(potion([...recipe], { stopper: 'wax' }))
      expect(unmixed.waxColour).toBe(darkened(ingredient('bluebell').colour))
    })
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
