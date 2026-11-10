import { describe, expect, it } from 'vitest'

import { defaults, normalise, randomise, seededRandom } from '../engine/schema.ts'
import {
  coreLore,
  inchesInWords,
  wandLore,
  wandDescription,
  wandName,
  wandNumber,
  woodLore,
} from './describe.ts'
import { wandSchema } from './wandSchema.ts'

const wand = (overrides: Record<string, unknown>) =>
  normalise(wandSchema, { ...defaults(wandSchema), ...overrides })

describe('inchesInWords', () => {
  it.each([
    [28, 'Eleven inches'],
    [30.5, 'Twelve inches'],
    [31, 'Twelve and a quarter inches'],
    [32, 'Twelve and a half inches'],
    [32.5, 'Twelve and three quarter inches'],
    [38, 'Fifteen inches'],
  ])('%s cm reads as "%s"', (cm, words) => {
    expect(inchesInWords(cm)).toBe(words)
  })
})

describe('a wand that is bone from end to end', () => {
  const bone = { wood: 'oak', stainColour: 'smoky', shaftCarving: 'shortSpiral', core: 'moonstone' }

  it('is named and told as bone', () => {
    const whole = wand({ ...bone, handleFinish: 'bone', shaftFinish: 'bone' })
    expect(wandName(whole)).toBe('The Bone Spiral')
    expect(wandLore(whole)).toMatch(/^Bone /)
    expect(wandLore(whole)).not.toMatch(/Oak/)
  })

  it('keeps the wood wording when only part of it is bone', () => {
    const part = wand({ ...bone, handleFinish: 'bone' })
    expect(wandName(part)).toBe('The Smoky Spiral')
    expect(wandLore(part)).toMatch(/^Oak /)
  })
})

describe('wandName', () => {
  it('names a wand after its colour and its most striking carving', () => {
    expect(wandName(wand({ wood: 'oak', stainColour: 'ember', shaftCarving: 'shortSpiral' }))).toBe(
      'The Ember Spiral',
    )
    expect(
      wandName(wand({ wood: 'maple', stainColour: 'forest', shaftCarving: 'longSpiral' })),
    ).toBe('The Green Climber')
  })

  it('falls back to the wood and the core when there is no stain or carving', () => {
    const plain = wand({
      wood: 'walnut',
      stainColour: 'none',
      shaftCarving: 'none',
      handleStyle: 'plain',
      handleCarving: 'none',
      core: 'moonstone',
    })
    expect(wandName(plain)).toBe('The Walnut Moon')
  })
})

describe('wandNumber', () => {
  it('is a stable four-digit shop number for the same wand', () => {
    const a = wand({ wood: 'cherry' })
    expect(wandNumber(a)).toMatch(/^\d{4}$/)
    expect(wandNumber(a)).toBe(wandNumber(normalise(wandSchema, { ...a })))
  })

  it('differs between different wands', () => {
    const numbers = new Set(
      Array.from({ length: 50 }, (_, i) => wandNumber(randomise(wandSchema, seededRandom(i + 1)))),
    )
    expect(numbers.size).toBeGreaterThan(45)
  })
})

describe('wandDescription', () => {
  it('reads like a shop tag: length, wood, core and how it feels', () => {
    expect(
      wandDescription(wand({ lengthCm: 33, wood: 'oak', core: 'emberstone', thickness: 1.12 })),
    ).toBe('Thirteen inches, oak, emberstone core. Sturdy.')
    expect(
      wandDescription(
        wand({ lengthCm: 30.5, wood: 'cherry', core: 'stormglass', thickness: 0.88 }),
      ),
    ).toBe('Twelve inches, cherry, storm glass core. Slender.')
  })

  it('says bone for a wand that is bone from end to end', () => {
    const bone = { lengthCm: 33, wood: 'oak', core: 'wildwood', thickness: 1 }
    expect(wandDescription(wand({ ...bone, handleFinish: 'bone', shaftFinish: 'bone' }))).toBe(
      'Thirteen inches, bone, wildwood core. Steady.',
    )
    expect(wandDescription(wand({ ...bone, handleFinish: 'bone' }))).toBe(
      'Thirteen inches, oak, wildwood core. Steady.',
    )
  })
})

describe('wandLore', () => {
  it('reads as two sentences about the wood and the core', () => {
    expect(wandLore(wand({ wood: 'walnut', core: 'moonstone' }))).toBe(
      'Walnut is clever and keeps secrets. Moonstone casts a cool silver-blue and stays calm when things get loud.',
    )
  })
})

describe('lore', () => {
  it('has a line for every wood and every core', () => {
    for (const wood of ['walnut', 'cherry', 'oak', 'maple']) expect(woodLore(wood)).not.toBe('')
    for (const core of ['starlight', 'moonstone', 'wildwood', 'stormglass', 'emberstone']) {
      expect(coreLore(core)).not.toBe('')
    }
  })
})
