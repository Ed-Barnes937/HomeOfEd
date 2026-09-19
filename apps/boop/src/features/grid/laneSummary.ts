import { pitchesInMask } from '../../engine/pitch.ts'
import { PITCHES_PER_LANE, STEPS_PER_PATTERN } from '../../engine/sequencerEngine.ts'
import { STEPS_PER_BAR } from '../../song/songTimeline.ts'

/**
 * The arithmetic behind a collapsed pitched row (design handoff, "Collapse";
 * pitched-lane spec §6): where a pebble sits in its step column, and the
 * four-bar contour the rail draws in place of the pitch legend.
 */

// `songTimeline.ts` owns what a bar is (CONTEXT.md, "Bar").
export const BARS_PER_PATTERN = STEPS_PER_PATTERN / STEPS_PER_BAR

// Mirrors PitchedLane.module.scss, which spends whatever the track has left on
// the travel below - so these pin the arithmetic rather than drive it.
export const PEBBLE_HEIGHT = 16
export const PEBBLE_INSET = 4

/** How far down its travel a pebble of this pitch sits: 0 is the top of the lane, 1 the bottom. */
export function pebbleOffset(pitchIndex: number): number {
  return (PITCHES_PER_LANE - 1 - pitchIndex) / (PITCHES_PER_LANE - 1)
}

/**
 * One pitch per bar for the rail's mini contour: the rounded mean of the notes
 * painted in that bar, or `null` where the bar holds none. A mean rather than a
 * peak, so a chord reads where the ear puts it.
 */
export function pitchContour(masks: readonly number[]): (number | null)[] {
  return Array.from({ length: BARS_PER_PATTERN }, (_, bar) => {
    const pitches = Array.from({ length: STEPS_PER_BAR }, (_, i) =>
      pitchesInMask(masks[bar * STEPS_PER_BAR + i] ?? 0),
    ).flat()
    if (pitches.length === 0) return null
    return Math.round(pitches.reduce((sum, pitch) => sum + pitch, 0) / pitches.length)
  })
}
