import { describe, expect, it } from 'vitest'

import { PITCHES_PER_LANE } from '../../engine/sequencerEngine.ts'
import {
  LANE_DESKTOP,
  LANE_TABLET,
  laneHeight,
  pitchIndexAtOffset,
  type LaneGeometry,
} from './laneGeometry.ts'

/** The top edge of the tile drawn `visualIndex` places down from the top of the lane. */
function tileTop(visualIndex: number, g: LaneGeometry): number {
  return g.platePadding + visualIndex * (g.cellHeight + g.gap)
}

function tileCentre(visualIndex: number, g: LaneGeometry): number {
  return tileTop(visualIndex, g) + g.cellHeight / 2
}

const SWEEP = 0.25

/** The span of offsets that answer with `pitchIndex`, swept at quarter-pixel resolution. */
function bandOf(pitchIndex: number, g: LaneGeometry): { top: number; bottom: number } {
  const bottomEdge = laneHeight(g) + 2 * g.platePadding
  let top: number | null = null
  let bottom = 0
  for (let y = 0; y <= bottomEdge; y += SWEEP) {
    if (pitchIndexAtOffset(y, g) !== pitchIndex) continue
    top ??= y
    bottom = y + SWEEP
  }
  if (top === null) throw new Error(`no band answers with pitch ${pitchIndex}`)
  return { top, bottom: Math.min(bottom, bottomEdge) }
}

describe.each([
  ['desktop', LANE_DESKTOP],
  ['tablet', LANE_TABLET],
])('pitchIndexAtOffset (%s column)', (_name, g) => {
  it('answers with the pitch of the tile the tap is over', () => {
    for (let visualIndex = 0; visualIndex < PITCHES_PER_LANE; visualIndex += 1) {
      expect(pitchIndexAtOffset(tileCentre(visualIndex, g), g)).toBe(
        PITCHES_PER_LANE - 1 - visualIndex,
      )
    }
  })

  it('centres every interior band on its own tile', () => {
    for (let visualIndex = 1; visualIndex < PITCHES_PER_LANE - 1; visualIndex += 1) {
      const band = bandOf(PITCHES_PER_LANE - 1 - visualIndex, g)
      expect((band.top + band.bottom) / 2).toBeCloseTo(tileCentre(visualIndex, g), 1)
      expect(band.bottom - band.top).toBeCloseTo(g.cellHeight + g.gap, 1)
    }
  })

  it('absorbs the plate padding into the end bands, so a tap above the top tile is not one note low', () => {
    const topBand = bandOf(PITCHES_PER_LANE - 1, g)
    expect(topBand.top).toBe(0)
    expect(pitchIndexAtOffset(0, g)).toBe(PITCHES_PER_LANE - 1)
    expect(pitchIndexAtOffset(g.platePadding - 1, g)).toBe(PITCHES_PER_LANE - 1)

    const bottomEdge = laneHeight(g) + 2 * g.platePadding
    const bottomBand = bandOf(0, g)
    expect(bottomBand.bottom).toBeCloseTo(bottomEdge, 1)
    expect(pitchIndexAtOffset(bottomEdge, g)).toBe(0)
    expect(pitchIndexAtOffset(bottomEdge - g.platePadding + 1, g)).toBe(0)
  })

  it('splits adjacent bands down the middle of the gap between their tiles', () => {
    for (let visualIndex = 0; visualIndex < PITCHES_PER_LANE - 1; visualIndex += 1) {
      const boundary = tileTop(visualIndex, g) + g.cellHeight + g.gap / 2
      expect(pitchIndexAtOffset(boundary - 0.5, g)).toBe(PITCHES_PER_LANE - 1 - visualIndex)
      expect(pitchIndexAtOffset(boundary + 0.5, g)).toBe(PITCHES_PER_LANE - 2 - visualIndex)
    }
  })

  it('clamps a tap that strays off either end of the plate', () => {
    expect(pitchIndexAtOffset(-40, g)).toBe(PITCHES_PER_LANE - 1)
    expect(pitchIndexAtOffset(laneHeight(g) + 999, g)).toBe(0)
  })
})

describe('laneHeight', () => {
  it('stacks the eight tiles and the gaps between them', () => {
    expect(laneHeight(LANE_DESKTOP)).toBe(8 * 24 + 7 * 4)
    expect(laneHeight(LANE_TABLET)).toBe(8 * 20 + 7 * 4)
  })
})
