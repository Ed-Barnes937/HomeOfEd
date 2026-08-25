import { describe, expect, it } from 'vitest'

import { playheadReadout, playheadValueText, type SongPlayheadView } from './songPlayhead.ts'

const at = (position: number, barInPosition: number): SongPlayheadView => ({
  bar: position * 4 + barInPosition,
  position,
  barInPosition,
  barCount: 32,
  playing: false,
})

describe('the playhead readout', () => {
  it('counts positions and bars from one, the way the ruler does', () => {
    expect(playheadReadout(at(3, 1))).toBe('Position 4 · bar 2 of 4')
    expect(playheadValueText(at(3, 1))).toBe('Position 4, bar 2')
  })

  it('has nothing to read out on a song with nothing placed', () => {
    const empty: SongPlayheadView = {
      bar: null,
      position: null,
      barInPosition: null,
      barCount: 0,
      playing: false,
    }
    expect(playheadReadout(empty)).toBeNull()
    expect(playheadValueText(empty)).toBeUndefined()
  })
})
