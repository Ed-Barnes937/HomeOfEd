import { describe, expect, it } from 'vitest'

import { normalise } from '../../engine/schema.ts'
import { wandSchema } from '../../wand/wandSchema.ts'
import { visibleGroups } from './groups.ts'

const shown = (params: Record<string, unknown>) => visibleGroups(normalise(wandSchema, params))

const summaryOf = (key: string, params: Record<string, unknown>) => {
  const p = normalise(wandSchema, params)
  return visibleGroups(p)
    .find((g) => g.key === key)!
    .summary(p)
}

describe('the groups shown', () => {
  it('add the branch only on a Branch, numbered without a gap', () => {
    expect(shown({}).map((g) => g.key)).not.toContain('branch')
    expect(shown({ kind: 'branch' }).map((g) => [g.numeral, g.key])).toEqual([
      ['i.', 'finish'],
      ['ii.', 'shape'],
      ['iii.', 'branch'],
      ['iv.', 'handle'],
      ['v.', 'shaft'],
      ['vi.', 'decor'],
      ['vii.', 'core'],
    ])
  })

  it('sum up a branch by its knots, its handle and its bumps', () => {
    const summary = (key: string, params: Record<string, unknown>) =>
      summaryOf(key, { kind: 'branch', ...params })
    expect(summary('branch', { knots: 0 })).toBe('No knots')
    expect(summary('branch', { knots: 1 })).toBe('1 knot')
    expect(summary('branch', { knots: 5 })).toBe('5 knots')
    expect(summary('handle', { branchHandle: 'grown' })).toBe('Grown')
    expect(summary('handle', { branchHandle: 'turned', handleStyle: 'spiral' })).toBe('Spiral')
    expect(summary('shaft', { shaftCarving: 'longSpiral', nodes: 'none' })).toBe('Smooth')
    expect(summary('shaft', { shaftCarving: 'longSpiral', nodes: 'rings' })).toBe('Bamboo')
  })
})

const shaftSummary = (params: Record<string, unknown>) => summaryOf('shaft', params)

describe('the shaft summary', () => {
  it('names the carving, or the bumps on an uncarved shaft', () => {
    expect(shaftSummary({ shaftCarving: 'longSpiral', nodes: 'knobs' })).toBe('Long spiral')
    expect(shaftSummary({ shaftCarving: 'none', nodes: 'rings' })).toBe('Bamboo')
    expect(shaftSummary({ shaftCarving: 'none', nodes: 'none' })).toBe('Smooth')
  })
})

const decorSummary = (params: Record<string, unknown>) => summaryOf('decor', params)

describe('the trimmings summary', () => {
  it('names the metal, else the paint or bone, else the gems, else says there are none', () => {
    expect(decorSummary({})).toBe('None')
    expect(decorSummary({ tipGem: 'crystal' })).toBe('Gems')
    expect(decorSummary({ gems: 'ring', bands: 'one', metal: 'gold' })).toBe('Gold')
    expect(decorSummary({ bands: 'two', metal: 'brass', shaftFinish: 'paint' })).toBe('Brass')
    expect(decorSummary({ shaftFinish: 'paint', paintColour: 'poppy' })).toBe('Poppy')
    expect(decorSummary({ handleFinish: 'bone' })).toBe('Bone')
  })
})
