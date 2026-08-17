/**
 * The song timeline: the global-bar axis (boop-playhead ticket 02, spec §5).
 *
 * Bars are new to the codebase. The engine counts ticks and 16-step patterns;
 * `song.ts` knows positions and clips. This module owns the middle — which
 * positions are placed, how a bar maps to a position and back, clamping, the
 * snap both scrub strips need, and the tick a seek is given. Putting it here is
 * what stops the two strips, the conductor and the readout each growing their
 * own copy of the same off-by-one.
 *
 * Pure: no React, no DOM, and no engine *behaviour* — the one engine import is
 * `STEPS_PER_PATTERN`, because a bar has to be derived from the pattern length
 * rather than written down again as 16. A sibling of `song.ts`, tested like it.
 *
 * Total by design. A song with no placements at all has an empty timeline and
 * every query still answers (ADR 0032's all-empty song plays the grid clip and
 * has no conductor), so nothing here throws.
 */

import { STEPS_PER_PATTERN } from '../engine/sequencerEngine.ts'

/** A position is 4 bars — a bar is a quarter of a clip. See `CONTEXT.md`: Bar. */
export const BARS_PER_POSITION = 4

/** How many of the pattern's 16 steps one bar covers. */
export const STEPS_PER_BAR = STEPS_PER_PATTERN / BARS_PER_POSITION

/**
 * The placed positions, left to right — the sequence the song plays, and the
 * same one `createSongConductor` builds. Empty positions are absent: they are
 * drawn on the strips but are not reachable by a scrub (spec §4).
 */
export interface SongTimeline {
  /** The non-empty placements' positions, ascending. */
  readonly positions: readonly number[]
  /** The song's length in global bars. Zero when nothing is placed. */
  readonly barCount: number
}

/** Read the timeline off a song's 16 placements. */
export function songTimeline(placements: readonly (readonly number[])[]): SongTimeline {
  const positions = placements.flatMap((clipIndices, position) =>
    clipIndices.length === 0 ? [] : [position],
  )
  return { positions, barCount: positions.length * BARS_PER_POSITION }
}

/**
 * `globalBar` brought inside the song: past the end lands on the last bar of
 * the last placed position, before the start on bar 0, and a fractional or
 * non-finite target on the whole bar at or below it. Always 0 on an empty
 * timeline.
 */
export function clampGlobalBar(timeline: SongTimeline, globalBar: number): number {
  if (timeline.barCount === 0 || Number.isNaN(globalBar)) return 0
  if (globalBar >= timeline.barCount) return timeline.barCount - 1
  if (globalBar <= 0) return 0
  return Math.floor(globalBar)
}

/**
 * Where a global bar is: the song position holding it and the bar within that
 * position, both 0-based. Clamps first, so any number answers; `null` only on
 * an empty timeline.
 */
export function barAt(
  timeline: SongTimeline,
  globalBar: number,
): { position: number; bar: number } | null {
  if (timeline.barCount === 0) return null
  const clamped = clampGlobalBar(timeline, globalBar)
  return {
    position: timeline.positions[Math.floor(clamped / BARS_PER_POSITION)]!,
    bar: clamped % BARS_PER_POSITION,
  }
}

/**
 * The other way: the global bar of a position's bar, or the position's start
 * when no bar is given. `null` when that position holds nothing — an empty
 * position is not on the timeline, so it has no global bar.
 */
export function globalBarOf(timeline: SongTimeline, position: number, bar = 0): number | null {
  const index = timeline.positions.indexOf(position)
  if (index === -1) return null
  return index * BARS_PER_POSITION + clampBar(bar)
}

/** A bar within a position, brought into 0…3. */
function clampBar(bar: number): number {
  if (Number.isNaN(bar)) return 0
  return Math.min(BARS_PER_POSITION - 1, Math.max(0, Math.floor(bar)))
}

/**
 * The bar a pointer is over, given how far across the scrub track it sits
 * (0 at the left edge, 1 at the right). The track is `barCount` equal segments
 * and the pointer takes the segment it is *inside* — every bar is the same size
 * of target, where snapping to the nearest bar *line* would make the two end
 * bars half-width ones. Either end clamps; `clampGlobalBar` handles the rest.
 */
export function globalBarAtFraction(timeline: SongTimeline, fraction: number): number {
  return clampGlobalBar(timeline, Math.floor(fraction * timeline.barCount))
}

/**
 * The engine tick a global bar starts on — what a scrub hands `engine.seek()`.
 * Tick space runs over the *placed* sequence, which is exactly what the
 * conductor plays, so this needs no timeline.
 */
export function tickOfGlobalBar(globalBar: number): number {
  return globalBar * STEPS_PER_BAR
}

/**
 * The global bar a tick is inside. Ticks are monotonic and the song loops, so
 * a tick past the end wraps round to the start; a tick before it reads as the
 * start, the way `clampGlobalBar` treats a scrub off the left of the track.
 *
 * A non-finite tick reads as the start, not as the end — unlike a global bar
 * off the right of the track, it is nonsense rather than an over-scrub, and
 * `seek` refuses one outright for the same reason.
 */
export function globalBarOfTick(timeline: SongTimeline, tick: number): number {
  if (timeline.barCount === 0 || !Number.isFinite(tick) || tick < 0) return 0
  return Math.floor(tick / STEPS_PER_BAR) % timeline.barCount
}

/**
 * The readout's parts — `Position 4, bar 2`. Counted from one, and `position`
 * is the ruler numeral the child sees (the song position), not the place in the
 * timeline. `null` on an empty timeline: there is nothing to read out.
 */
export function readoutParts(
  timeline: SongTimeline,
  globalBar: number,
): { position: number; bar: number; barsPerPosition: number } | null {
  const at = barAt(timeline, globalBar)
  if (at === null) return null
  return {
    position: at.position + 1,
    bar: at.bar + 1,
    barsPerPosition: BARS_PER_POSITION,
  }
}
