import type { AudioState, Unsubscribe } from './sequencerEngine.ts'

/**
 * Headroom for the master bus - the **only** gain either audio path applies,
 * so live playback and the offline WAV export are the same loudness. Lives
 * here, in the Tone-free seam, because `ToneAudioDriver` and
 * `export/renderSequence.ts` both need it and neither may import the other.
 *
 * It has to hold the raw sum under full scale on its own: the `Limiter(-1)`
 * behind it cannot catch one-shot attacks landing in the same sample. At 0.3
 * the budget is spent, and `kitLevels.test.ts` goes red before anything that
 * would overspend it ships. ADR 0062 has the measurements.
 */
export const MASTER_GAIN = 0.3

/**
 * The gain each note of a chord sounds at, so a column costs one instrument's
 * voice however many notes are in it - the invariant `MASTER_GAIN` is sized
 * against. Exactly 1 for a single note. ADR 0062.
 */
export function chordGain(noteCount: number): number {
  return noteCount > 1 ? 1 / Math.sqrt(noteCount) : 1
}

export interface SampleSource {
  instrumentId: string
  url: string
}

/**
 * The thin seam between the sequencer's logic and the audio library. The
 * engine owns tick counting, hit derivation, `songPos()` anchoring and the
 * event fan-out; the driver owns the AudioContext, the sixteenth-note clock
 * and sample playback.
 *
 * `ToneAudioDriver` is the production implementation; `FakeAudioDriver` (in
 * `testing/`) drives the same contract from a hand-cranked clock, which is how
 * the engine is unit-tested without an AudioContext.
 */
export interface AudioDriver {
  /** Fetch and decode the kit's samples. Safe to call before unlocking. */
  loadSamples(sources: readonly SampleSource[]): Promise<void>

  /** Resume the AudioContext. Must be called from inside a user gesture. */
  unlock(): Promise<void>
  state(): AudioState
  onStateChange(listener: (state: AudioState) => void): Unsubscribe

  /** Current AudioContext time, in seconds. */
  now(): number

  setBpm(bpm: number): void
  /**
   * Register the sixteenth-note callback. Called once per step at schedule
   * time; `audioTime` is when that step will sound.
   */
  onStep(callback: (audioTime: number) => void): void
  startTransport(): void
  stopTransport(): void

  /**
   * Play one loaded sample, at `audioTime` if given, otherwise immediately.
   *
   * `semitones` transposes it - a pitched instrument has one root sample and
   * every note of its lane is that sample repitched (spec §5). Plain
   * semitones, not a pitch index: the scale is the engine's business, and the
   * driver only has to resample. Omitted (or 0) is the sample untouched, which
   * is what every one-note instrument passes and therefore byte-identical to
   * before pitch existed.
   *
   * `gain` is the note's own level (`chordGain`); omitted is unity.
   */
  play(instrumentId: string, audioTime?: number, semitones?: number, gain?: number): void

  /** Run `callback` at draw time for the given `audioTime`. */
  scheduleDraw(audioTime: number, callback: () => void): void
  /** Drop every draw not yet delivered — used when the transport pauses. */
  cancelDraws(): void

  dispose(): void
}
