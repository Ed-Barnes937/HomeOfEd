import { describe, expect, it } from 'vitest'

import type { BeatEvent } from '../../engine/sequencerEngine.ts'
import { applyDrawBeat, INITIAL_PLAYHEAD_STATE, stepToBar, stepToCol } from './playheadMotion.ts'

function beatEvent(step: number, instrumentIds: string[] = []): BeatEvent {
  return { tick: step, step, audioTime: 0, hits: instrumentIds.map((instrumentId) => ({ instrumentId })) }
}

describe('stepToBar / stepToCol', () => {
  it('maps steps to their 4-step bar and column within it', () => {
    expect(stepToBar(0)).toBe(0)
    expect(stepToCol(0)).toBe(0)
    expect(stepToBar(5)).toBe(1)
    expect(stepToCol(5)).toBe(1)
    expect(stepToBar(15)).toBe(3)
    expect(stepToCol(15)).toBe(3)
  })
})

describe('applyDrawBeat', () => {
  it('advances the step even on an empty beat, without touching strikes', () => {
    const next = applyDrawBeat(INITIAL_PLAYHEAD_STATE, beatEvent(3))
    expect(next.step).toBe(3)
    expect(next.cellStrikes).toEqual({})
    expect(next.rowStrikes).toEqual({})
  })

  it('records a strike per hit, keyed by instrument and step, and bumps the row', () => {
    const next = applyDrawBeat(INITIAL_PLAYHEAD_STATE, beatEvent(0, ['kick', 'boop']))
    expect(next.step).toBe(0)
    expect(next.cellStrikes).toEqual({ 'kick:0': 1, 'boop:0': 1 })
    expect(next.rowStrikes).toEqual({ kick: 1, boop: 1 })
  })

  it('increments the epoch on a repeat strike of the same cell across loop passes', () => {
    const first = applyDrawBeat(INITIAL_PLAYHEAD_STATE, beatEvent(0, ['kick']))
    const secondPass = applyDrawBeat(first, beatEvent(15, []))
    const thirdPass = applyDrawBeat(secondPass, beatEvent(0, ['kick']))
    expect(thirdPass.cellStrikes['kick:0']).toBe(2)
    expect(thirdPass.rowStrikes.kick).toBe(2)
  })

  it('does not cross-contaminate strikes between different instruments on the same step', () => {
    const next = applyDrawBeat(INITIAL_PLAYHEAD_STATE, beatEvent(2, ['snare']))
    expect(next.cellStrikes).toEqual({ 'snare:2': 1 })
    expect(next.rowStrikes).toEqual({ snare: 1 })
  })
})
