import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { FAMILIES } from './families.ts'
import { swordPresets } from './presets.ts'
import { swordSchema } from './swordSchema.ts'

describe('swordPresets', () => {
  it('keep every value they ask for when normalised', () => {
    for (const preset of swordPresets) {
      expect(normalise(swordSchema, preset.params), preset.name).toEqual(preset.params)
    }
  })

  it('have unique names', () => {
    const names = swordPresets.map((preset) => preset.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('cover every Kind', () => {
    const kinds = new Set(swordPresets.map((preset) => preset.params.family))
    expect([...kinds].sort()).toEqual(Object.keys(FAMILIES).sort())
  })

  it("start a first visit on Hearthside, a plain Knight's sword", () => {
    const first = swordPresets[0]!
    expect(first.name).toBe('Hearthside')
    expect(first.params).toMatchObject({
      family: 'knight',
      steel: 'satin',
      pattern: 'plain',
      waves: 'none',
      runes: 'none',
      gems: 'none',
      engraving: 'none',
    })
  })
})
