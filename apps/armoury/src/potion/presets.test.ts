import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { secretBlend } from './blends.ts'
import { BOTTLES } from './bottles.ts'
import { potionName } from './describe.ts'
import { isForbiddenName } from './doNotUse.ts'
import { INGREDIENTS } from './ingredients.ts'
import { potionMix } from './mix.ts'
import { potionPresets } from './presets.ts'
import { potionSchema } from './potionSchema.ts'
import { pourList } from './pours.ts'

const optionValues = (key: string) => {
  const def = potionSchema.params.find((d) => d.key === key)
  if (!def || def.kind !== 'choice') throw new Error(key)
  return def.options.map((o) => o.value)
}

describe('potionPresets', () => {
  it('has eight', () => {
    expect(potionPresets).toHaveLength(8)
  })

  it('normalises every preset to itself', () => {
    for (const preset of potionPresets) {
      expect(normalise(potionSchema, preset.params), preset.name).toEqual(preset.params)
    }
  })

  it('has unique names, none forbidden, and none making a forbidden potion name', () => {
    const names = potionPresets.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
    for (const preset of potionPresets) {
      expect(preset.name.length).toBeGreaterThan(0)
      expect(isForbiddenName(preset.name), preset.name).toBe(false)
      expect(isForbiddenName(potionName(preset.params)), preset.name).toBe(false)
    }
  })

  it('opens on the spec first-visit potion', () => {
    expect(potionPresets[0]!.params).toMatchObject({
      shape: 'teardrop',
      neck: 0.4,
      glass: 'clear',
      stopper: 'cork',
      label: 'round',
      pour1: 'moonmilk',
      pour2: 'rosehip',
      pour3: 'starpetal',
      mixed: 'no',
    })
  })

  it('covers every shape, stopper, label and ingredient', () => {
    const used = (key: string) => new Set(potionPresets.map((p) => p.params[key]))
    for (const shape of Object.keys(BOTTLES)) expect(used('shape')).toContain(shape)
    for (const v of optionValues('stopper')) expect(used('stopper')).toContain(v)
    for (const v of optionValues('label')) expect(used('label')).toContain(v)
    const poured = new Set(potionPresets.flatMap((p) => pourList(p.params)))
    for (const i of INGREDIENTS) expect(poured).toContain(i.id)
  })

  it('covers all seven outcomes, murky included', () => {
    const outcomes = new Set(potionPresets.map((p) => potionMix(p.params)?.outcome))
    expect(outcomes).toEqual(
      new Set(['glowing', 'floating', 'sparkling', 'whirling', 'dreamy', 'whiffy', 'murky']),
    )
  })

  it('is mixed except for the first-visit potion, which is full', () => {
    expect(potionPresets.map((p) => p.params.mixed)).toEqual([
      'no',
      ...Array<string>(7).fill('yes'),
    ])
    expect(pourList(potionPresets[0]!.params)).toHaveLength(3)
  })

  it('includes at least one secret blend', () => {
    expect(potionPresets.some((p) => secretBlend(p.params) !== null)).toBe(true)
  })
})
