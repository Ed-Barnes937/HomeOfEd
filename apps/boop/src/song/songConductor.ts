/**
 * Song playback: the conductor (boop-loops ticket 16, spec §9). Lifted from
 * the ticket-03 prototype: song mode lives entirely above the existing
 * `SequencerEngine` seam — no contract change. At the last step of each
 * 16-step slot it calls `setPattern` with the next placed position's clip;
 * `onBeat` fires synchronously inside the step-15 callback and the engine
 * reads its rows fresh each step, so the swap lands before tick 16 is
 * scheduled — gapless by construction (proven in issue 03).
 *
 * The swap happens at *schedule* time, one lookahead (~0.1–0.15 s) before the
 * wrap sounds, so the position shown to the child advances separately on the
 * draw channel (`onDrawBeat`) — never by re-reading `getPattern()` at swap
 * time, or the grid flashes the next clip early.
 *
 * `seek` (boop-playhead ticket 03) is the one break in that monotonic advance:
 * it resolves a global bar through `songTimeline`, resets both counters and
 * loads the target's pattern itself, because the step-15 swap is no longer how
 * the pattern for a position got there.
 */

import { STEPS_PER_PATTERN, type Pattern, type SequencerEngine } from '../engine/sequencerEngine.ts'
import { mergePatterns } from './song.ts'
import { clampGlobalBar, songTimeline, tickOfGlobalBar, timelineIndexAt } from './songTimeline.ts'

export interface SongConductor {
  /** The song position audible right now (draw time) — what the UI shows. */
  soundingPosition(): number
  /**
   * Jump the song to `globalBar` (spec §4) — the scrub's one entry point.
   * Out-of-range and fractional targets clamp through the timeline rather than
   * throwing, so any pointer position answers.
   *
   * The conductor otherwise only ever advances, and only at step 15, so a jump
   * has to do by hand what the swap would have done: load the target position's
   * merged pattern *before* the engine schedules its next step from the new
   * tick, and reset both counters so the swap carries on correctly from there.
   * A seek into a layered position is indistinguishable from arriving there by
   * playback. The next draw re-announces the sounding position even when the
   * jump stayed inside one position — the callback carries a position, not a
   * bar, so a listener that swallowed an unchanged one would never learn the
   * song had moved at all.
   */
  seek(globalBar: number): void
  dispose(): void
}

/**
 * Start conducting `placements` over `engine`: the sequence is the non-empty
 * placements, left to right, looping. A position holding several clips sounds
 * them layered — one merged pattern, so layering costs the engine nothing.
 * Sets the first position's pattern immediately; the caller starts and stops
 * the transport. `onSoundingPosition` fires at draw time — once for the first
 * position on the first draw, then at each audible slot change — and is safe
 * for DOM work.
 */
export function createSongConductor(
  engine: SequencerEngine,
  clips: readonly Pattern[],
  placements: readonly (readonly number[])[],
  onSoundingPosition: (position: number) => void,
): SongConductor {
  // The timeline owns which positions are placed and in what order; the
  // sequence is that same order with each position's merged pattern attached,
  // so a global bar resolves to a slot by arithmetic, not a second derivation.
  const timeline = songTimeline(placements)
  const sequence = timeline.positions.map((position) => ({
    position,
    pattern: mergePatterns(placements[position]!.map((index) => clips[index]!)),
  }))
  if (sequence.length === 0) throw new Error('a song with no placements has nothing to conduct')

  let scheduled = 0
  let sounding = 0
  let announced = -1
  engine.setPattern(sequence[0]!.pattern)

  const offBeat = engine.onBeat(({ step }) => {
    if (step === STEPS_PER_PATTERN - 1) {
      scheduled = (scheduled + 1) % sequence.length
      engine.setPattern(sequence[scheduled]!.pattern)
    }
  })
  const offDraw = engine.onDrawBeat(({ step }) => {
    if (step === 0) sounding = scheduled
    if (sounding !== announced) {
      announced = sounding
      onSoundingPosition(sequence[sounding]!.position)
    }
  })

  return {
    soundingPosition: () => sequence[sounding]!.position,
    seek: (globalBar) => {
      const bar = clampGlobalBar(timeline, globalBar)
      // Never null: the sequence is non-empty, so neither is the timeline.
      const index = timelineIndexAt(timeline, bar)!
      scheduled = index
      sounding = index
      // `-1` rather than `index`, because a jump inside one position leaves the
      // index unchanged and the next draw must still announce rather than
      // swallow it as unmoved.
      announced = -1
      // Before the engine's seek, so the target's pattern is in place by the
      // time the next step is scheduled from the new tick.
      engine.setPattern(sequence[index]!.pattern)
      engine.seek(tickOfGlobalBar(bar))
    },
    dispose: () => {
      offBeat()
      offDraw()
    },
  }
}
