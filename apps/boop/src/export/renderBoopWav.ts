import type { Kit } from '../engine/sequencerEngine.ts'
import { activeClip, type Song } from '../song/song.ts'
import { renderSequenceSamples } from './renderSequence.ts'
import type { SampleDecoder } from './sampleDecoder.ts'
import { encodeWavPcm16 } from './wavEncoder.ts'

/** How many times an unplaced song's grid clip loops (spec: "looped ~4x"). */
const DEFAULT_LOOPS = 4
/** Matches the kit's own sample rate (`generatePlaceholderSamples.mjs`). */
export const DEFAULT_SAMPLE_RATE = 44100

export interface RenderBoopWavOptions {
  kit: Kit
  song: Song
  sampleRate?: number
  decode: SampleDecoder
}

/**
 * The whole offline-render pipeline: decode each kit instrument's sample,
 * mix the song into PCM, and encode it as a WAV `Blob`. Export renders the
 * whole song — placements left to right, one pass, no loop (ticket 19,
 * spec §12); a song with no placements renders the grid clip's 4 bars, so an
 * old boop exports exactly as before. The decode step is injected so this is
 * testable without a real (Offline)AudioContext — see `sampleDecoder.ts` for
 * the production wiring.
 */
export async function renderBoopWav(options: RenderBoopWavOptions): Promise<Blob> {
  const { kit, song, sampleRate = DEFAULT_SAMPLE_RATE, decode } = options

  const decoded = await Promise.all(
    kit.instruments.map(async (instrument) => [instrument.instrumentId, await decode(instrument.sound)] as const),
  )
  const samples = Object.fromEntries(decoded)

  const placed = song.placements.filter((held): held is number => held !== null)
  const sequence =
    placed.length > 0
      ? placed.map((clipIndex) => song.clips[clipIndex]!.pattern)
      : new Array(DEFAULT_LOOPS).fill(activeClip(song).pattern)

  const mixed = renderSequenceSamples({ kit, sequence, bpm: song.bpm, sampleRate, samples })
  const wav = encodeWavPcm16(mixed, sampleRate)
  return new Blob([wav], { type: 'audio/wav' })
}
