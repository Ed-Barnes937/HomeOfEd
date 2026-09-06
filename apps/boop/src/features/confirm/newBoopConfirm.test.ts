import { describe, expect, it } from 'vitest'

import { type Pattern } from '../../engine/sequencerEngine.ts'
import { SONG_POSITIONS } from '../../persistence/saveFormat.ts'
import { type Song } from '../../song/song.ts'
import { wouldLoseWork } from './newBoopConfirm.ts'

function pattern(steps: string): Pattern {
  return [{ instrumentId: 'kick', steps: Array.from(steps, (c) => c === '1') }]
}

const BLANK = pattern('0000000000000000')

function song(overrides: Partial<Song> = {}): Song {
  return {
    bpm: 100,
    clips: [{ name: 'Clip 1', tint: 0, pattern: BLANK }],
    activeClipIndex: 0,
    placements: Array.from({ length: SONG_POSITIONS }, () => []),
    ...overrides,
  }
}

const IN_MY_BOOPS = { index: 0, name: 'Boop 1', edited: false }
const EDITED_SINCE_LOAD = { index: 0, name: 'Boop 1', edited: true }

describe('wouldLoseWork', () => {
  it('is true for a boop with painted steps that is not in "My boops"', () => {
    expect(wouldLoseWork(null, song({ clips: [{ name: 'Clip 1', tint: 0, pattern: pattern('1000000000000000') }] }))).toBe(true)
  })

  it('is true once a boop loaded from "My boops" has been edited', () => {
    expect(
      wouldLoseWork(
        EDITED_SINCE_LOAD,
        song({ clips: [{ name: 'Clip 1', tint: 0, pattern: pattern('1000000000000000') }] }),
      ),
    ).toBe(true)
  })

  it('is false while the boop still matches the row it came from - the reset loses nothing', () => {
    expect(
      wouldLoseWork(
        IN_MY_BOOPS,
        song({ clips: [{ name: 'Clip 1', tint: 0, pattern: pattern('1000000000000000') }] }),
      ),
    ).toBe(false)
  })

  it('is false for a blank one-clip boop - there is nothing in it to keep', () => {
    expect(wouldLoseWork(null, song())).toBe(false)
  })

  it('is true for a second clip, even with nothing painted in either', () => {
    expect(
      wouldLoseWork(
        null,
        song({
          clips: [
            { name: 'Clip 1', tint: 0, pattern: BLANK },
            { name: 'Clip 2', tint: 1, pattern: BLANK },
          ],
        }),
      ),
    ).toBe(true)
  })

  it('is true for an arrangement, even with nothing painted', () => {
    const placements = Array.from({ length: SONG_POSITIONS }, () => [] as readonly number[])
    placements[3] = [0]
    expect(wouldLoseWork(null, song({ placements }))).toBe(true)
  })
})
