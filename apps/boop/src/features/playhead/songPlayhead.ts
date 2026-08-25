/**
 * What the strips, the ruler and the readout are told about the playhead
 * (boop-playhead ticket 05).
 *
 * One shape rather than five loose props, because the laptop strip, the ruler,
 * the clip rail and the readout all read the same four facts and must never
 * disagree about them — and because ticket 06's phone strip reads exactly the
 * same shape. The arithmetic behind the numbers is `songTimeline`'s; this is
 * only how they reach a view, plus the two strings the handoff spells out.
 */

import { BARS_PER_POSITION } from '../../song/songTimeline.ts'

export interface SongPlayheadView {
  /** The global bar the playhead sits on, or `null` when nothing is placed. */
  bar: number | null
  /** The song position that bar falls in — the ruler numeral, 0-based. */
  position: number | null
  /** The bar within that position, 0-based. */
  barInPosition: number | null
  /** The song's length in global bars — the slider's range. Zero when empty. */
  barCount: number
  /** Playing or stopped: the marker's 1 / 0.45 opacity rule (spec §1). */
  playing: boolean
}

/** `Position 4 · bar 2 of 4` — the clip header's readout. `null` on an empty song. */
export function playheadReadout(view: SongPlayheadView): string | null {
  if (view.position === null || view.barInPosition === null) return null
  return `Position ${view.position + 1} · bar ${view.barInPosition + 1} of ${BARS_PER_POSITION}`
}

/** `Position 4, bar 2` — the song strip's `aria-valuetext` (spec §4). */
export function playheadValueText(view: SongPlayheadView): string | undefined {
  if (view.position === null || view.barInPosition === null) return undefined
  return `Position ${view.position + 1}, bar ${view.barInPosition + 1}`
}
