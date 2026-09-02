import { MASTER_GAIN } from '../engine/audioDriver.ts'
import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../engine/sequencerEngine.ts'

/**
 * The render applies `MASTER_GAIN` and nothing else, so an exported file is
 * exactly as loud as live playback. It used to apply a second per-voice 0.5 on
 * top, on the assumption that decoded samples were full scale - they are not,
 * the kit normalises every one-shot to 0.5 itself
 * (`scripts/generatePlaceholderSamples.mjs`, pinned by `kitLevels.test.ts`) -
 * which made every export 6 dB quieter than the app (ticket 08). Removing it
 * while the master gain came 0.60 -> 0.30 leaves rendered files bit-identical
 * and brings playback down to meet them.
 *
 * Production also runs the live bus through a `Limiter(-1)` that the offline
 * render has no equivalent for, so the final clamp below is a hard ceiling.
 * Nothing the app can build should reach it: `MASTER_GAIN` is sized so the
 * whole-roster worst case peaks at 0.91 (see `audioDriver.ts`).
 */

export interface RenderSequenceOptions {
  kit: Kit
  /** One 16-step pass per entry, rendered left to right (ticket 19: a song is a sequence of clips). */
  sequence: readonly Pattern[]
  /** Beats per minute — the same tempo the engine schedules from. */
  bpm: number
  sampleRate: number
  /** Decoded, mono sample data per `instrumentId`. A missing entry is silently skipped. */
  samples: Readonly<Record<string, Float32Array>>
}

/**
 * The pure scheduling + mixing core of the WAV export: no AudioContext, no
 * Tone.js — just where each hit lands in sample space and how loud it is
 * once several rows land on the same step. Mirrors `secondsPerStep` from
 * `createSequencerEngine.ts` so the render matches what playback actually
 * sounds like.
 */
export function renderSequenceSamples(options: RenderSequenceOptions): Float32Array {
  const { kit, sequence, bpm, sampleRate, samples } = options
  const secondsPerStep = 60 / bpm / 4
  const samplesPerStep = Math.round(secondsPerStep * sampleRate)
  const totalSteps = STEPS_PER_PATTERN * sequence.length

  const longestSample = kit.instruments.reduce(
    (max, instrument) => Math.max(max, samples[instrument.instrumentId]?.length ?? 0),
    0,
  )
  const out = new Float32Array(totalSteps * samplesPerStep + longestSample)

  const passRows = sequence.map(
    (pattern) => new Map(pattern.map((row) => [row.instrumentId, row.steps])),
  )

  for (let tick = 0; tick < totalSteps; tick += 1) {
    const rows = passRows[Math.floor(tick / STEPS_PER_PATTERN)]!
    const step = tick % STEPS_PER_PATTERN
    const offset = tick * samplesPerStep
    for (const instrument of kit.instruments) {
      if (!rows.get(instrument.instrumentId)?.[step]) continue
      const sample = samples[instrument.instrumentId]
      if (!sample) continue
      for (let i = 0; i < sample.length; i += 1) {
        out[offset + i]! += sample[i]!
      }
    }
  }

  for (let i = 0; i < out.length; i += 1) {
    out[i] = Math.max(-1, Math.min(1, out[i]! * MASTER_GAIN))
  }

  return out
}
