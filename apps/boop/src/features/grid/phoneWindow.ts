/**
 * Small-phone step-window geometry (ticket 27; design handoff, "Main screen —
 * small phone" → "Phone grid geometry"). The grid is never allowed to shrink
 * below 6 x 16 — instead the instrument rail is pinned and the 16 step columns
 * scroll inside a narrow window, snapping to the 4-step groups so a swipe
 * always lands on a bar line.
 *
 * Everything here is pure pixel arithmetic over the handoff's numbers, so the
 * snap offsets, the loop map's window bracket and the off-screen playhead
 * marker are all unit-testable without a DOM. The same constants are mirrored
 * in `PhoneGrid.module.scss`; change them together.
 */

import { STEPS_PER_PATTERN } from '../../engine/sequencerEngine.ts'

const GROUP_SIZE = 4
const GROUP_COUNT = STEPS_PER_PATTERN / GROUP_SIZE

/** Cell 32 x 44, inner gap 5px, group gutter 11px (design handoff). */
export const PHONE_CELL_WIDTH = 32
export const PHONE_CELL_GAP = 5
export const PHONE_GROUP_GUTTER = 11

/** One 4-step group: 4 x 32 + 3 x 5 = 143px. */
export const PHONE_GROUP_WIDTH = GROUP_SIZE * PHONE_CELL_WIDTH + (GROUP_SIZE - 1) * PHONE_CELL_GAP

/** Group-to-group distance — also the snap pitch: 143 + 11 = 154px. */
export const PHONE_GROUP_STRIDE = PHONE_GROUP_WIDTH + PHONE_GROUP_GUTTER

/** The whole 16-step strip: 16 x 32 + 12 x 5 + 3 x 11 = 605px. */
export const PHONE_STRIP_WIDTH =
  GROUP_COUNT * PHONE_GROUP_WIDTH + (GROUP_COUNT - 1) * PHONE_GROUP_GUTTER

/**
 * The window at the 390px reference viewport: 390 − 2 x 12 frame padding
 * − 2 x 10 well padding − 92 rail − 8 rail gap. It is a *reference* value, not
 * a hard width: the window is a flex child, so a wider phone simply shows more
 * of the strip. Callers pass the measured width; this is the fallback and the
 * number the tests pin.
 */
export const PHONE_WINDOW_WIDTH = 246

/** The bracket under the loop map is a fixed half-loop wide (design handoff). */
export const PHONE_BRACKET_WIDTH_PERCENT = 50

/** A step's left edge inside the strip. */
export function phoneStepX(step: number): number {
  const group = Math.floor(step / GROUP_SIZE)
  const col = step % GROUP_SIZE
  return group * PHONE_GROUP_STRIDE + col * (PHONE_CELL_WIDTH + PHONE_CELL_GAP)
}

const maxScroll = (windowWidth: number) => Math.max(0, PHONE_STRIP_WIDTH - windowWidth)

/**
 * The scroll positions a swipe can settle on: each group's left edge, clamped
 * to the reachable range.
 *
 * The snapping itself is CSS (`scroll-snap-align: start` on each bar's
 * numeral) — this is the arithmetic behind it, pinned in a unit test so the
 * geometry can't drift away from the handoff unnoticed.
 *
 * The clamp is load-bearing: the strip is 605px and the window ~246px, so the
 * last group's own offset (462) is unreachable and collapses onto the end of
 * the strip. That end position has to exist, because step 16 is not visible
 * from any bar line — and the grid is never allowed to hide a step. Duplicates
 * are dropped so the offsets stay one-per-settling-position.
 */
export function phoneSnapOffsets(windowWidth: number): readonly number[] {
  const limit = maxScroll(windowWidth)
  const offsets: number[] = []
  for (let group = 0; group < GROUP_COUNT; group += 1) {
    const offset = Math.min(group * PHONE_GROUP_STRIDE, limit)
    if (offsets[offsets.length - 1] !== offset) offsets.push(offset)
  }
  return offsets
}

/**
 * Where the loop map's window bracket sits, as a percentage of the map's
 * width. Tracks the scroll continuously (rather than jumping per group) so it
 * stays honest mid-swipe, and is clamped so the fixed 50%-wide bracket never
 * runs off the right end.
 */
export function phoneBracketLeftPercent(scrollLeft: number): number {
  const fraction = scrollLeft / PHONE_STRIP_WIDTH
  const max = (100 - PHONE_BRACKET_WIDTH_PERCENT) / 100
  return Math.min(Math.max(fraction, 0), max) * 100
}

/**
 * The steps with any pixel on screen. A part-cut cell counts as visible: the
 * handoff keeps it deliberately, as the affordance that says "there is more
 * this way".
 */
export function phoneVisibleSteps(
  scrollLeft: number,
  windowWidth: number,
): { first: number; last: number } {
  const left = scrollLeft
  const right = scrollLeft + windowWidth
  let first = STEPS_PER_PATTERN - 1
  let last = 0
  for (let step = 0; step < STEPS_PER_PATTERN; step += 1) {
    const x = phoneStepX(step)
    if (x + PHONE_CELL_WIDTH > left && x < right) {
      first = Math.min(first, step)
      last = Math.max(last, step)
    }
  }
  return { first, last }
}

/**
 * Which edge of the window the playhead has fallen behind, or `null` while it
 * is on screen (or stopped). Drives the edge glow that tells a child which way
 * to swipe back — playback deliberately never scrolls the window for them.
 */
export function phoneOffscreenSide(
  playheadStep: number | null,
  scrollLeft: number,
  windowWidth: number,
): 'left' | 'right' | null {
  if (playheadStep === null) return null
  const { first, last } = phoneVisibleSteps(scrollLeft, windowWidth)
  if (playheadStep < first) return 'left'
  if (playheadStep > last) return 'right'
  return null
}
