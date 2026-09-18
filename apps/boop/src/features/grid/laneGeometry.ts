import { PITCHES_PER_LANE } from '../../engine/sequencerEngine.ts'

/**
 * A pitched row's hit bands: the column carries the tap, split into one band
 * per tile (pitched-lane spec §6, ADR 0060).
 */
export interface LaneGeometry {
  /** The plate's vertical padding, above the top tile and below the bottom one. */
  platePadding: number
  cellHeight: number
  gap: number
}

// Mirrors PitchedLane.module.scss. The lane is measured at runtime, so these
// pin the arithmetic rather than drive it.
export const LANE_DESKTOP: LaneGeometry = { platePadding: 8, cellHeight: 24, gap: 4 }
export const LANE_TABLET: LaneGeometry = { platePadding: 8, cellHeight: 20, gap: 4 }

/** The tiles and the gaps between them, without the plate's padding. */
export function laneHeight({ cellHeight, gap }: LaneGeometry): number {
  return PITCHES_PER_LANE * cellHeight + (PITCHES_PER_LANE - 1) * gap
}

/** The pitch a tap `offsetY` below the **plate's** top edge means. */
export function pitchIndexAtOffset(offsetY: number, g: LaneGeometry): number {
  // Splitting at the middle of each gap centres every band on its tile; the
  // clamp is what runs the end bands out through the plate's padding.
  const firstSplit = g.platePadding + g.cellHeight + g.gap / 2
  const fromTop = Math.floor((offsetY - firstSplit) / (g.cellHeight + g.gap)) + 1
  return PITCHES_PER_LANE - 1 - Math.min(PITCHES_PER_LANE - 1, Math.max(0, fromTop))
}
