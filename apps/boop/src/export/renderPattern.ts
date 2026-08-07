import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../engine/sequencerEngine.ts'

/**
 * Per-voice headroom, matching the placeholder kit's own peak
 * (`scripts/generatePlaceholderSamples.mjs`) so six simultaneous rows don't
 * clip before the master stage.
 */
const VOICE_GAIN = 0.5
/**
 * Master bus gain, matching `ToneAudioDriver`'s `MASTER_GAIN`. Production
 * also runs this through a `Limiter(-1)`; the offline render has no
 * equivalent, so the final clamp below is a hard ceiling rather than a
 * limiter — loud enough patterns clip in the file even though they don't
 * live, on the same six-simultaneous-hit case `MASTER_GAIN` is sized for.
 */
const MASTER_GAIN = 0.6

export interface RenderPatternOptions {
  kit: Kit
  pattern: Pattern
  /** Beats per minute — the same tempo the engine schedules from. */
  bpm: number
  /** How many times to loop the pattern. */
  loops: number
  sampleRate: number
  /** Decoded, mono sample data per `instrumentId`. A missing entry is silently skipped. */
  samples: Readonly<Record<string, Float32Array>>
}

/**
 * The pure scheduling + mixing core of the WAV export: no AudioContext, no
 * Tone.js — just where each hit lands in sample space and how loud it is
 * once several rows land on the same step. Mirrors `secondsPerStep` from
 * `createSequencerEngine.ts` so the render matches what the loop actually
 * sounds like.
 */
export function renderPatternSamples(options: RenderPatternOptions): Float32Array {
  const { kit, pattern, bpm, loops, sampleRate, samples } = options
  const secondsPerStep = 60 / bpm / 4
  const samplesPerStep = Math.round(secondsPerStep * sampleRate)
  const totalSteps = STEPS_PER_PATTERN * loops

  const longestSample = kit.instruments.reduce(
    (max, instrument) => Math.max(max, samples[instrument.instrumentId]?.length ?? 0),
    0,
  )
  const out = new Float32Array(totalSteps * samplesPerStep + longestSample)

  const rows = new Map(pattern.map((row) => [row.instrumentId, row.steps]))

  for (let tick = 0; tick < totalSteps; tick += 1) {
    const step = tick % STEPS_PER_PATTERN
    const offset = tick * samplesPerStep
    for (const instrument of kit.instruments) {
      if (!rows.get(instrument.instrumentId)?.[step]) continue
      const sample = samples[instrument.instrumentId]
      if (!sample) continue
      for (let i = 0; i < sample.length; i += 1) {
        out[offset + i]! += sample[i]! * VOICE_GAIN
      }
    }
  }

  for (let i = 0; i < out.length; i += 1) {
    out[i] = Math.max(-1, Math.min(1, out[i]! * MASTER_GAIN))
  }

  return out
}
