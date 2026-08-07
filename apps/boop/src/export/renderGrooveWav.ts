import type { Kit, Pattern } from '../engine/sequencerEngine.ts'
import { renderPatternSamples } from './renderPattern.ts'
import type { SampleDecoder } from './sampleDecoder.ts'
import { encodeWavPcm16 } from './wavEncoder.ts'

/** How many times the export loops the pattern (spec: "looped ~4x"). */
const DEFAULT_LOOPS = 4
/** Matches the kit's own sample rate (`generatePlaceholderSamples.mjs`). */
export const DEFAULT_SAMPLE_RATE = 44100

export interface RenderGrooveWavOptions {
  kit: Kit
  pattern: Pattern
  bpm: number
  loops?: number
  sampleRate?: number
  decode: SampleDecoder
}

/**
 * The whole offline-render pipeline: decode each kit instrument's sample,
 * mix the pattern into PCM, and encode it as a WAV `Blob`. The decode step is
 * injected so this is testable without a real (Offline)AudioContext — see
 * `sampleDecoder.ts` for the production wiring.
 */
export async function renderGrooveWav(options: RenderGrooveWavOptions): Promise<Blob> {
  const { kit, pattern, bpm, loops = DEFAULT_LOOPS, sampleRate = DEFAULT_SAMPLE_RATE, decode } = options

  const decoded = await Promise.all(
    kit.instruments.map(async (instrument) => [instrument.instrumentId, await decode(instrument.sound)] as const),
  )
  const samples = Object.fromEntries(decoded)

  const mixed = renderPatternSamples({ kit, pattern, bpm, loops, sampleRate, samples })
  const wav = encodeWavPcm16(mixed, sampleRate)
  return new Blob([wav], { type: 'audio/wav' })
}
