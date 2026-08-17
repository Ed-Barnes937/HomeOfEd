import {
  Gain,
  Limiter,
  ToneAudioBuffers,
  ToneBufferSource,
  getContext,
  getDraw,
  getTransport,
  start,
} from 'tone'

import type { AudioDriver, SampleSource } from './audioDriver.ts'
import type { AudioState, Unsubscribe } from './sequencerEngine.ts'

/**
 * The production `AudioDriver`: Tone.js, and the only file in the app that
 * imports it. Imports are named so the bundle stays tree-shaken (the research
 * ticket measured ~69 KB gzip that way vs ~92 KB for the whole library).
 */
/**
 * Headroom for the master bus. Six placeholder one-shots landing on the same
 * step sum to ~1.83 raw; at this gain, measured through the limiter behind it,
 * the worst case peaks at ~0.83 — loud, and nowhere near clipping.
 */
const MASTER_GAIN = 0.6

export class ToneAudioDriver implements AudioDriver {
  private readonly limiter = new Limiter(-1).toDestination()
  private readonly master = new Gain(MASTER_GAIN).connect(this.limiter)
  private buffers: ToneAudioBuffers | null = null
  private repeatId: number | null = null
  private stepCallback: ((audioTime: number) => void) | null = null
  private readonly listeners = new Set<(state: AudioState) => void>()
  private lastState: AudioState = readState()

  constructor() {
    getContext().on('statechange', this.handleStateChange)
    // iPadOS does not always fire `statechange` when it parks the context in
    // `interrupted`; coming back to the tab is the other moment to re-read it.
    document.addEventListener('visibilitychange', this.handleStateChange)
  }

  loadSamples(sources: readonly SampleSource[]): Promise<void> {
    const urls = Object.fromEntries(sources.map((s) => [s.instrumentId, s.url]))
    return new Promise((resolve, reject) => {
      this.buffers = new ToneAudioBuffers({
        urls,
        onload: () => resolve(),
        onerror: (error: Error) => reject(error),
      })
    })
  }

  async unlock(): Promise<void> {
    // Only meaningful inside a user gesture — Chrome and WebKit both require it.
    await start()
    const context = getContext()
    if (context.state !== 'running') await context.resume()
    this.handleStateChange()
  }

  state(): AudioState {
    return readState()
  }

  onStateChange(listener: (state: AudioState) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  now(): number {
    // The raw context clock, not Tone's `now()`, which is biased by lookAhead
    // and would run the playhead ahead of the sound.
    return getContext().currentTime
  }

  setBpm(bpm: number): void {
    getTransport().bpm.value = bpm
  }

  onStep(callback: (audioTime: number) => void): void {
    this.stepCallback = callback
    if (this.repeatId !== null) return
    this.repeatId = getTransport().scheduleRepeat((time) => {
      this.stepCallback?.(time)
    }, '16n')
  }

  startTransport(): void {
    getTransport().start()
  }

  stopTransport(): void {
    // stop(), not pause(): the engine's `start()` is always start-from-the-top
    // (ADR 0024, as amended), so Tone's own timeline must rewind with it.
    // Paused, the '16n' repeat resumes part way through the interrupted step,
    // and that short first step re-anchors the playhead the engine has just
    // put at 0. The scheduled repeat survives a stop — only `clear()` removes
    // it — so restarting fires it again from position 0.
    getTransport().stop()
  }

  play(instrumentId: string, audioTime?: number): void {
    const buffers = this.buffers
    if (!buffers?.has(instrumentId)) return
    // One source per hit, so a fast retrigger layers instead of cutting itself off.
    const source = new ToneBufferSource(buffers.get(instrumentId)).connect(this.master)
    source.onended = () => source.dispose()
    source.start(audioTime)
  }

  scheduleDraw(audioTime: number, callback: () => void): void {
    getDraw().schedule(callback, audioTime)
  }

  cancelDraws(): void {
    // Hits already scheduled within the lookahead still sound (they are on the
    // audio clock, not the transport), but nothing more should be drawn.
    getDraw().cancel(0)
  }

  dispose(): void {
    if (this.repeatId !== null) getTransport().clear(this.repeatId)
    this.repeatId = null
    this.stepCallback = null
    getContext().off('statechange', this.handleStateChange)
    document.removeEventListener('visibilitychange', this.handleStateChange)
    this.listeners.clear()
    getDraw().cancel(0)
    this.buffers?.dispose()
    this.buffers = null
    this.master.dispose()
    this.limiter.dispose()
  }

  private readonly handleStateChange = (): void => {
    const state = readState()
    if (state === this.lastState) return
    this.lastState = state
    for (const listener of this.listeners) listener(state)
  }
}

function readState(): AudioState {
  const state: string = getContext().state
  if (state === 'running') return 'running'
  // WebKit-only, and absent from the AudioContextState union.
  if (state === 'interrupted') return 'interrupted'
  return 'locked'
}
