import { MASTER_GAIN, chordGain } from '../engine/audioDriver.ts'
import { pitchesInMask, rowPitchMasks, semitonesForInstrument } from '../engine/pitch.ts'
import {
  ANCHOR_PITCH_INDEX,
  STEPS_PER_PATTERN,
  type Kit,
  type Pattern,
} from '../engine/sequencerEngine.ts'

/**
 * The render applies the same two gains live playback does and nothing else -
 * `MASTER_GAIN` on the mix and `chordGain` per note of a column (ADR 0062) -
 * so an exported file is exactly as loud as the app. Both come from
 * `audioDriver.ts`, the Tone-free seam `ToneAudioDriver` reads too, so the two
 * paths cannot land different laws.
 *
 * Production also runs the live bus through a `Limiter(-1)` that the offline
 * render has no equivalent for, so the final clamp below is a hard ceiling.
 * Nothing the app can build should reach it: `MASTER_GAIN` is sized so the
 * activated roster's worst case peaks at 0.998 (see `audioDriver.ts`).
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

/** `2^(semitones/12)` - the `playbackRate` `ToneAudioDriver` hands Web Audio. */
function playbackRate(semitones: number): number {
  return 2 ** (semitones / 12)
}

/** How many output samples a note of `length` occupies once resampled. */
function noteLength(length: number, rate: number): number {
  return Math.floor(length / rate)
}

/**
 * One note into the mix, resampled by linear interpolation (ADR 0064). At rate
 * 1 every `frac` is 0, so the loop is the old straight copy sample for sample.
 */
function mixNote(
  out: Float32Array,
  offset: number,
  sample: Float32Array,
  rate: number,
  gain: number,
): void {
  const length = noteLength(sample.length, rate)
  for (let i = 0; i < length; i += 1) {
    const at = i * rate
    const low = Math.floor(at)
    const frac = at - low
    out[offset + i]! += ((sample[low] ?? 0) * (1 - frac) + (sample[low + 1] ?? 0) * frac) * gain
  }
}

/**
 * Room past the last step. The kit's longest sample is the floor - an unpitched
 * render is the length it always was - and a painted low note stretches past it.
 */
function tailLength(
  kit: Kit,
  passRows: readonly Map<string, readonly number[]>[],
  samples: Readonly<Record<string, Float32Array>>,
): number {
  let longest = 0
  for (const instrument of kit.instruments) {
    const length = samples[instrument.instrumentId]?.length ?? 0
    longest = Math.max(longest, length)
    for (const rows of passRows) {
      for (const mask of rows.get(instrument.instrumentId) ?? []) {
        const lowest = pitchesInMask(mask)[0]
        if (lowest === undefined) continue
        longest = Math.max(
          longest,
          noteLength(length, playbackRate(semitonesForInstrument(instrument, lowest) ?? 0)),
        )
      }
    }
  }
  return longest
}

/**
 * The pure scheduling + mixing core of the WAV export: no AudioContext, no
 * Tone.js - just where each note lands in sample space, what it is transposed
 * by and how loud it is once several of them land on the same step. Mirrors
 * `secondsPerStep` from `createSequencerEngine.ts` so the render matches what
 * playback actually sounds like.
 */
export function renderSequenceSamples(options: RenderSequenceOptions): Float32Array {
  const { kit, sequence, bpm, sampleRate, samples } = options
  const secondsPerStep = 60 / bpm / 4
  const samplesPerStep = Math.round(secondsPerStep * sampleRate)
  const totalSteps = STEPS_PER_PATTERN * sequence.length

  const passRows = sequence.map(
    (pattern) => new Map(pattern.map((row) => [row.instrumentId, rowPitchMasks(row)])),
  )
  const out = new Float32Array(totalSteps * samplesPerStep + tailLength(kit, passRows, samples))

  for (let tick = 0; tick < totalSteps; tick += 1) {
    const rows = passRows[Math.floor(tick / STEPS_PER_PATTERN)]!
    const step = tick % STEPS_PER_PATTERN
    const offset = tick * samplesPerStep
    for (const instrument of kit.instruments) {
      const mask = rows.get(instrument.instrumentId)?.[step] ?? 0
      const sample = samples[instrument.instrumentId]
      if (mask === 0 || !sample) continue
      // A one-note instrument sounds once whatever the column holds, the way
      // playback does (ADR 0067): its pitch data can only have come from a
      // newer build, and rendering it as several copies of one untransposed
      // sample would be a unison the chord law does not cover.
      const pitches = instrument.pitched ? pitchesInMask(mask) : [ANCHOR_PITCH_INDEX]
      const gain = chordGain(pitches.length)
      for (const pitchIndex of pitches) {
        const rate = playbackRate(semitonesForInstrument(instrument, pitchIndex) ?? 0)
        mixNote(out, offset, sample, rate, gain)
      }
    }
  }

  for (let i = 0; i < out.length; i += 1) {
    out[i] = Math.max(-1, Math.min(1, out[i]! * MASTER_GAIN))
  }

  return out
}
