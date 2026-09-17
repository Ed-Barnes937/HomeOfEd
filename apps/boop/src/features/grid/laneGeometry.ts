import { PITCHES_PER_LANE } from '../../engine/sequencerEngine.ts'

/**
 * Where a tap in a pitched row's step column lands (pitched-lane spec §2/§6).
 * The tile is far below the 44px tap floor, so the **column** carries the hit
 * and is split into `PITCHES_PER_LANE` bands, each centred on its own tile,
 * with the end bands running out through the plate's padding.
 *
 * The numbers below mirror `PitchedLane.module.scss`; the component measures
 * the rendered lane rather than trusting them, so a change to one cannot land
 * taps a note out.
 */
export interface LaneGeometry {
  /** The plate's vertical padding, above the top tile and below the bottom one. */
  platePadding: number
  cellHeight: number
  gap: number
}

/** 52px step columns: a taller tile than the handoff's, for its wider column (spec §2). */
export const LANE_DESKTOP: LaneGeometry = { platePadding: 8, cellHeight: 24, gap: 4 }

/** The 1024-1279 band's 42px columns, where the handoff's own 20px tile fits. */
export const LANE_TABLET: LaneGeometry = { platePadding: 8, cellHeight: 20, gap: 4 }

/** The tiles and the gaps between them, without the plate's padding. */
export function laneHeight({ cellHeight, gap }: LaneGeometry): number {
  return PITCHES_PER_LANE * cellHeight + (PITCHES_PER_LANE - 1) * gap
}

/**
 * The pitch a tap `offsetY` below the top of the column means - the column
 * being the padded plate box, so 0 is the top of the plate and not the top
 * tile. Counted back from the top because `pitchIndex` counts from the bottom.
 */
export function pitchIndexAtOffset(offsetY: number, g: LaneGeometry): number {
  const stride = g.cellHeight + g.gap
  // Bands split at the middle of each gap, which is what centres each one on
  // its tile; anything above the first split or below the last clamps into the
  // end bands, absorbing the plate's padding.
  const firstSplit = g.platePadding + g.cellHeight + g.gap / 2
  const fromTop = Math.floor((offsetY - firstSplit) / stride) + 1
  const clamped = Math.min(PITCHES_PER_LANE - 1, Math.max(0, fromTop))
  return PITCHES_PER_LANE - 1 - clamped
}
