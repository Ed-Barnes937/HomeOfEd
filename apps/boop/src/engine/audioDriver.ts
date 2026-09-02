import type { AudioState, Unsubscribe } from './sequencerEngine.ts'

/**
 * Headroom for the master bus - the **only** gain either audio path applies,
 * so live playback and the offline WAV export are the same loudness. Lives
 * here, in the Tone-free seam, because `ToneAudioDriver` and
 * `export/renderSequence.ts` both need it and neither may import the other.
 *
 * **The worst case: 0.30 x 3.035 raw = 0.91 peak.** A clip owns its rows
 * (ADR 0041) and layered placements sound their `instrumentId` union
 * (`mergePatterns`), so the most voices that can ever land on one step is the
 * whole 20-instrument roster - one voice per instrument, however many clips
 * are stacked. Painted solid and retriggering on every 16th at MAX_BPM (200),
 * where the 400 ms tails overlap, that roster sums to a measured **3.035**
 * raw. `kitLevels.test.ts` pins the budget at 3.1 and asserts it still fits
 * under full scale at this gain.
 *
 * **Method** (spec §3: measured, not assumed). The 20 shipped one-shots were
 * summed offline at 200 bpm 16ths and rendered through the real master bus -
 * `Gain` then `DynamicsCompressorNode` - in a Chromium `OfflineAudioContext`,
 * reading back the output peak and the count of samples over full scale.
 * Measured peaks: 20 rows solid at 200 bpm 3.035; the same union on a single
 * step 2.970 (so the overlapping tails are worth only 0.26 dB); the classic
 * six solid 2.072.
 *
 * **Why 0.30 and not the old 0.60.** The `Limiter(-1)` behind this gain is a
 * backstop, not a peak controller, and measurement showed it is a much weaker
 * one than the old comment assumed: Tone's `Limiter` never sets `knee`, so it
 * inherits `Compressor`'s default **30 dB** knee, and a swept-sine static
 * curve through it applies just **1.22 dB** of reduction at 12 dB over
 * threshold. It cannot catch 20 one-shot attacks landing in the same sample -
 * at 0.60 the worst case rendered a **1.794** peak with **2.93%** of samples
 * (153 ms per 5 s) hard-clipped at the destination, and even the pre-roster
 * classic six clipped at 1.239. No threshold or knee setting rescued it, so
 * the gain has to keep the raw sum under full scale on its own. 0.30 is the
 * largest round gain that does: 0.32 was the last clean step (0.971 peak) and
 * 0.33 clipped, and 0.30 keeps the pinned 3.1 budget clean too (0.93).
 *
 * The cost is real and deliberate: quieter than before on sparse patterns,
 * where nothing was clipping. Recovering that loudness needs per-voice
 * headroom or a true look-ahead limiter in an `AudioWorklet`, which is a
 * redesign this constant is not the place for.
 *
 * Not ear-checked: the numbers above are all offline renders.
 */
export const MASTER_GAIN = 0.3

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
