/**
 * A scrub: moving the playhead by gesture (boop-playhead ticket 04, spec §2).
 *
 * This is the load-bearing rule of the effort, and it is a rule about what a
 * scrub *does not* do. Every other write to the song goes through `HomePage`'s
 * `updateSong`, which stops playback and marks the boop edited; a scrub does
 * neither, because moving the playhead is listening rather than editing. So it
 * takes this path instead — a sibling of `updateSong`, not a variant of it.
 *
 * It lives here, next to the timeline it resolves against, so the rule can be
 * stated once and tested against a real engine and a real conductor rather than
 * re-derived at each gesture the strips (tickets 05/06) hang off.
 */

import type { SequencerEngine } from '../engine/sequencerEngine.ts'
import type { SongConductor } from './songConductor.ts'
import { STEPS_PER_PATTERN } from '../engine/sequencerEngine.ts'
import {
  BARS_PER_POSITION,
  STEPS_PER_BAR,
  clampGlobalBar,
  tickOfGlobalBar,
  type SongTimeline,
} from './songTimeline.ts'

export interface ScrubTarget {
  /** The transport. Seeked directly only when there is no conductor to go through. */
  engine: Pick<SequencerEngine, 'seek'>
  /**
   * The conductor while the song plays, `null` when it does not — which covers
   * both a stopped transport and a clip loop, since `HomePage` only ever holds a
   * conductor in song mode.
   */
  conductor: Pick<SongConductor, 'seek'> | null
  timeline: SongTimeline
}

/**
 * Move the playhead to `globalBar` and report the bar it landed on, or `null`
 * when there is nothing to point at — a song with no placements has an empty
 * timeline, so a scrub of it is a no-op rather than a throw (ADR 0032).
 *
 * The whole of what a scrub does: a seek and nothing else. It starts no
 * playback, so a scrub while stopped is silent and only the next `start()`
 * sounds the target; it stops none either, so a scrub mid-song is audible from
 * where it was dropped.
 */
export function scrubToBar(
  { engine, conductor, timeline }: ScrubTarget,
  globalBar: number,
): number | null {
  if (timeline.barCount === 0) return null
  const bar = clampGlobalBar(timeline, globalBar)
  // The conductor's own seek loads the target position's pattern and resets its
  // counters before seeking the engine; with no conductor there is no pattern to
  // swap, so the tick is all there is to move.
  if (conductor) conductor.seek(bar)
  else engine.seek(tickOfGlobalBar(bar))
  return bar
}

/**
 * The clip rail's scrub (spec §4): move the playhead to `step` *within the
 * position it is already on*, and report where it landed. The bar moves with
 * it — a step names a bar — so the readout and the song strip follow a rail
 * drag as well.
 *
 * On a song with nothing placed there is no timeline and no conductor, but the
 * grid is still showing a clip and its 16 steps are exactly what the rail
 * scrubs (ADR 0032), so this answers there too.
 *
 * The conductor is re-seeked even though the position has not changed: it swaps
 * the *next* position's pattern in at step 15, one lookahead early, so a rail
 * drag backwards from the end of a slot would otherwise leave the engine
 * holding the wrong clip. Its own seek lands on the bar's first tick, and the
 * engine seek that follows carries on to the step inside that bar.
 */
export function scrubToStep(
  { engine, conductor, timeline }: ScrubTarget,
  globalBar: number,
  step: number,
): { globalBar: number; step: number } {
  const target = Math.min(STEPS_PER_PATTERN - 1, Math.max(0, Math.floor(step)))
  if (timeline.barCount === 0) {
    engine.seek(target)
    return { globalBar: 0, step: target }
  }
  const positionStart =
    Math.floor(clampGlobalBar(timeline, globalBar) / BARS_PER_POSITION) * BARS_PER_POSITION
  const bar = positionStart + Math.floor(target / STEPS_PER_BAR)
  if (conductor) conductor.seek(bar)
  engine.seek(tickOfGlobalBar(bar) + (target % STEPS_PER_BAR))
  return { globalBar: bar, step: target }
}
