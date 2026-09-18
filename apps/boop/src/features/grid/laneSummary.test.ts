import { describe, expect, it } from 'vitest'

import { PITCHES_PER_LANE } from '../../engine/sequencerEngine.ts'
import {
  BARS_PER_PATTERN,
  PEBBLE_HEIGHT,
  PEBBLE_INSET,
  pebbleOffset,
  pitchContour,
} from './laneSummary.ts'

/** What the stylesheet's `calc()` works out to in a track of `trackHeight`. */
function pebbleTop(pitchIndex: number, trackHeight: number): number {
  return PEBBLE_INSET + pebbleOffset(pitchIndex) * (trackHeight - 2 * PEBBLE_INSET - PEBBLE_HEIGHT)
}

/** A step's mask from the pitches painted in it. */
function mask(...pitches: number[]): number {
  return pitches.reduce((acc, pitch) => acc | (1 << pitch), 0)
}

describe('pebbleOffset', () => {
  it('puts the top pitch at the top of the travel and the bottom pitch at the foot of it', () => {
    expect(pebbleOffset(PITCHES_PER_LANE - 1)).toBe(0)
    expect(pebbleOffset(0)).toBe(1)
  })

  it('spaces the eight pitches evenly, low pitch lower', () => {
    for (let pitch = 1; pitch < PITCHES_PER_LANE; pitch += 1) {
      expect(pebbleOffset(pitch)).toBeLessThan(pebbleOffset(pitch - 1))
      expect(pebbleOffset(pitch - 1) - pebbleOffset(pitch)).toBeCloseTo(
        1 / (PITCHES_PER_LANE - 1),
        6,
      )
    }
  })

  it("lands on the handoff's own drawn pebbles in its 56px track", () => {
    expect(Math.round(pebbleTop(1, 56))).toBe(31)
    expect(Math.round(pebbleTop(2, 56))).toBe(27)
  })

  it('keeps the pebble inside the track at every column height', () => {
    for (const trackHeight of [56, 50]) {
      for (let pitch = 0; pitch < PITCHES_PER_LANE; pitch += 1) {
        expect(pebbleTop(pitch, trackHeight)).toBeGreaterThanOrEqual(PEBBLE_INSET)
        expect(pebbleTop(pitch, trackHeight) + PEBBLE_HEIGHT).toBeLessThanOrEqual(
          trackHeight - PEBBLE_INSET,
        )
      }
    }
  })
})

describe('pitchContour', () => {
  const empty = Array.from({ length: 16 }, () => 0)

  it('reads one bar per quarter of the pattern', () => {
    expect(pitchContour(empty)).toHaveLength(BARS_PER_PATTERN)
  })

  it('has no height where a bar holds no notes', () => {
    expect(pitchContour(empty)).toEqual([null, null, null, null])
  })

  it('takes a bar with one note at that note', () => {
    const masks = [...empty]
    masks[2] = mask(6)
    expect(pitchContour(masks)).toEqual([6, null, null, null])
  })

  it('averages the notes a bar holds, chords included', () => {
    const masks = [...empty]
    masks[4] = mask(0, 4)
    masks[6] = mask(2)
    // (0 + 4 + 2) / 3 = 2
    expect(pitchContour(masks)[1]).toBe(2)
  })

  it('rounds a fractional average to a drawable pitch', () => {
    const masks = [...empty]
    masks[8] = mask(3)
    masks[9] = mask(4)
    expect(pitchContour(masks)[2]).toBe(4)
  })

  it('reads each bar on its own', () => {
    const masks = [...empty]
    masks[0] = mask(0)
    masks[15] = mask(7)
    expect(pitchContour(masks)).toEqual([0, null, null, 7])
  })
})
