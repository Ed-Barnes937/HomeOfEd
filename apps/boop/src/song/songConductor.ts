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
 */

import { STEPS_PER_PATTERN, type Pattern, type SequencerEngine } from '../engine/sequencerEngine.ts'
import { mergePatterns } from './song.ts'

export interface SongConductor {
  /** The song position audible right now (draw time) — what the UI shows. */
  soundingPosition(): number
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
  const sequence = placements.flatMap((clipIndices, position) =>
    clipIndices.length === 0
      ? []
      : [{ position, pattern: mergePatterns(clipIndices.map((index) => clips[index]!)) }],
  )
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
    dispose: () => {
      offBeat()
      offDraw()
    },
  }
}
