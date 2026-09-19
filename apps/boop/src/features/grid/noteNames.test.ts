import { describe, expect, it } from 'vitest'

import { noteNameToMidi } from '../../engine/pitch.ts'
import { ANCHOR_PITCH_INDEX, type PitchedConfig } from '../../engine/sequencerEngine.ts'
import { laneNoteNames } from './noteNames.ts'

/** A register the way the manifest parser builds one (`kitManifest.ts`). */
function register(rootNote: string): PitchedConfig {
  const rootMidi = noteNameToMidi(rootNote)
  if (rootMidi === undefined) throw new Error(`"${rootNote}" is not a note`)
  return { rootNote, rootMidi }
}

describe('laneNoteNames', () => {
  it('names the eight cells of the lane, bottom up, with no octave number', () => {
    // The root sample sits on the anchor "so" (spec §3), so a G root is C major.
    expect(laneNoteNames(register('G3'))).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'])
  })

  it('follows the root rather than a key written down here', () => {
    // The guard against a re-rooted kit: nothing in this file knows the key.
    expect(laneNoteNames(register('C4'))).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E', 'F'])
    expect(laneNoteNames(register('D3'))).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F#', 'G'])
  })

  it('spells each degree on its own letter, so a key reads as a scale', () => {
    expect(laneNoteNames(register('Ab3'))).toEqual(['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C', 'Db'])
    expect(laneNoteNames(register('C#4'))).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#', 'F#'])
  })

  it('names the anchor after the instrument’s own root note', () => {
    for (const rootNote of ['G3', 'C4', 'Bb2', 'F#5']) {
      expect(laneNoteNames(register(rootNote))[ANCHOR_PITCH_INDEX]).toBe(
        rootNote.replace(/-?\d+$/, ''),
      )
    }
  })

  it('reads the same in every octave, which is what lets one gutter serve every lane', () => {
    expect(laneNoteNames(register('G2'))).toEqual(laneNoteNames(register('G5')))
  })
})
