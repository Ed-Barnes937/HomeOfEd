import { describe, expect, it } from 'vitest'

import { ANCHOR_PITCH_INDEX, PITCHES_PER_LANE } from '../../engine/sequencerEngine.ts'
import { laneCellLabel, solfegeName } from './solfege.ts'

describe('solfegeName', () => {
  it('names the lane from the bottom up', () => {
    expect([...Array(PITCHES_PER_LANE).keys()].map(solfegeName)).toEqual([
      'do',
      're',
      'mi',
      'fa',
      'so',
      'la',
      'ti',
      'high do',
    ])
  })

  it('names the anchor "so"', () => {
    expect(solfegeName(ANCHOR_PITCH_INDEX)).toBe('so')
  })
})

describe('laneCellLabel', () => {
  it('announces the pitch, the step and whether the note is painted', () => {
    expect(laneCellLabel(4, 4, false)).toBe('so, step 5, off')
    expect(laneCellLabel(7, 0, true)).toBe('high do, step 1, on')
  })
})
