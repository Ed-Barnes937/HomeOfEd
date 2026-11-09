import { describe, expect, it } from 'vitest'

import { normalise } from '../../engine/schema.ts'
import { wandSchema } from '../../wand/wandSchema.ts'
import { GROUPS } from './groups.ts'

const shaftSummary = (params: Record<string, unknown>) =>
  GROUPS.find((g) => g.key === 'shaft')!.summary(normalise(wandSchema, params))

describe('the shaft summary', () => {
  it('names the carving, or the bumps on an uncarved shaft', () => {
    expect(shaftSummary({ shaftCarving: 'longSpiral', nodes: 'knobs' })).toBe('Long spiral')
    expect(shaftSummary({ shaftCarving: 'none', nodes: 'rings' })).toBe('Bamboo')
    expect(shaftSummary({ shaftCarving: 'none', nodes: 'none' })).toBe('Smooth')
  })
})

const decorSummary = (params: Record<string, unknown>) =>
  GROUPS.find((g) => g.key === 'decor')!.summary(normalise(wandSchema, params))

describe('the decorations summary', () => {
  it('names the metal, else the paint or bone, else says there are none', () => {
    expect(decorSummary({})).toBe('None')
    expect(decorSummary({ bands: 'two', metal: 'brass', shaftFinish: 'paint' })).toBe('Brass')
    expect(decorSummary({ shaftFinish: 'paint', paintColour: 'poppy' })).toBe('Poppy')
    expect(decorSummary({ handleFinish: 'bone' })).toBe('Bone')
  })
})
