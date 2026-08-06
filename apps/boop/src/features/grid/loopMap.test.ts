import { describe, expect, it } from 'vitest'

import { STEPS_PER_PATTERN, type Pattern } from '../../engine/sequencerEngine.ts'
import { loopMapTicks } from './loopMap.ts'

const emptyRow = (instrumentId: string): Pattern[number] => ({
  instrumentId,
  steps: Array.from({ length: STEPS_PER_PATTERN }, () => false),
})

const patternWith = (on: Record<string, number[]>): Pattern =>
  Object.entries(on).map(([instrumentId, steps]) => {
    const row = emptyRow(instrumentId)
    const mutable = [...row.steps]
    for (const step of steps) mutable[step] = true
    return { instrumentId, steps: mutable }
  })

describe('loopMapTicks', () => {
  it('always describes all 16 steps — the map is why the playhead is never lost', () => {
    expect(loopMapTicks(patternWith({}), null)).toHaveLength(STEPS_PER_PATTERN)
  })

  it('reads empty where no row has a note', () => {
    expect(loopMapTicks(patternWith({ kick: [] }), null).every((tick) => tick === 'empty')).toBe(true)
  })

  it('reads note on any step at least one row plays', () => {
    const ticks = loopMapTicks(patternWith({ kick: [0, 8], hat: [2] }), null)
    expect(ticks[0]).toBe('note')
    expect(ticks[2]).toBe('note')
    expect(ticks[8]).toBe('note')
    expect(ticks[1]).toBe('empty')
  })

  it('lets the playhead win over a note on the same step', () => {
    const ticks = loopMapTicks(patternWith({ kick: [4] }), 4)
    expect(ticks[4]).toBe('playhead')
    expect(ticks[3]).toBe('empty')
  })

  it('shows the playhead on an empty step too', () => {
    expect(loopMapTicks(patternWith({ kick: [0] }), 7)[7]).toBe('playhead')
  })
})
