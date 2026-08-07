import type { AudioState, Unsubscribe } from './sequencerEngine.ts'

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

  /** Play one loaded sample, at `audioTime` if given, otherwise immediately. */
  play(instrumentId: string, audioTime?: number): void

  /** Run `callback` at draw time for the given `audioTime`. */
  scheduleDraw(audioTime: number, callback: () => void): void
  /** Drop every draw not yet delivered — used when the transport pauses. */
  cancelDraws(): void

  dispose(): void
}
