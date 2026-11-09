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
