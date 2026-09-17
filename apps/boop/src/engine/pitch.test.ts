import { describe, expect, it } from 'vitest'

import {
  ANCHOR_PITCH_MASK,
  hasPitch,
  pitchMask,
  pitchesInMask,
  rowPitchMasks,
  semitonesFromAnchor,
} from './pitch.ts'
import {
  ANCHOR_PITCH_INDEX,
  PITCHES_PER_LANE,
  STEPS_PER_PATTERN,
  type PatternRow,
} from './sequencerEngine.ts'

describe('pitch masks', () => {
  it('counts bit 0 from the bottom, so the LSB is do', () => {
    expect(pitchMask(0)).toBe(0b0000_0001)
    expect(pitchMask(4)).toBe(0b0001_0000)
    expect(pitchMask(PITCHES_PER_LANE - 1)).toBe(0b1000_0000)
  })

  it('reads a chord back out low note first', () => {
    const chord = pitchMask(0) | pitchMask(4) | pitchMask(7)

    expect(pitchesInMask(chord)).toEqual([0, 4, 7])
    expect(hasPitch(chord, 4)).toBe(true)
    expect(hasPitch(chord, 5)).toBe(false)
  })

  it('reads an empty mask as no notes at all', () => {
    expect(pitchesInMask(0)).toEqual([])
  })

  it('names the anchor pitch "so", the middle of the lane', () => {
    expect(ANCHOR_PITCH_INDEX).toBe(4)
    expect(ANCHOR_PITCH_MASK).toBe(pitchMask(ANCHOR_PITCH_INDEX))
  })
})

describe('semitonesFromAnchor', () => {
  // The lane is one major octave, do to high do, and the root sample is
  // recorded at the anchor (spec §3) - so the anchor itself must be the
  // untouched sample, or every converted boop would change pitch.
  it('is zero at the anchor, so the root sample plays untransposed', () => {
    expect(semitonesFromAnchor(ANCHOR_PITCH_INDEX)).toBe(0)
  })

  it('walks the major scale either side of it', () => {
    const scale = Array.from({ length: PITCHES_PER_LANE }, (_, index) => semitonesFromAnchor(index))

    expect(scale).toEqual([-7, -5, -3, -2, 0, 2, 4, 5])
  })

  it('puts the top cell an octave above the bottom one', () => {
    expect(semitonesFromAnchor(PITCHES_PER_LANE - 1) - semitonesFromAnchor(0)).toBe(12)
  })
})

describe('rowPitchMasks', () => {
  it('is the row’s own masks when it carries them', () => {
    const masks = steps(16).map((_, step) => (step === 3 ? pitchMask(1) | pitchMask(6) : 0))

    expect(rowPitchMasks({ instrumentId: 'boop', steps: on(3), pitches: masks })).toEqual(masks)
  })

  // Spec §3's conversion anchor rule: a pitched row's steps with no pitch data
  // read as "so" - which is the root sample itself, so old saves sound the same.
  it('reads a row with no pitch data as the anchor on every on step', () => {
    const masks = rowPitchMasks({ instrumentId: 'boop', steps: on(0, 9) })

    expect(masks).toHaveLength(STEPS_PER_PATTERN)
    expect(masks[0]).toBe(ANCHOR_PITCH_MASK)
    expect(masks[9]).toBe(ANCHOR_PITCH_MASK)
    expect(masks.filter((mask) => mask !== 0)).toHaveLength(2)
  })
})

function steps(length: number): boolean[] {
  return new Array<boolean>(length).fill(false)
}

function on(...activeSteps: number[]): PatternRow['steps'] {
  return Array.from({ length: STEPS_PER_PATTERN }, (_, step) => activeSteps.includes(step))
}
