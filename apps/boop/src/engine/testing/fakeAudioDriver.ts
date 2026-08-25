import type { AudioDriver, SampleSource } from '../audioDriver.ts'
import type { AudioState, Unsubscribe } from '../sequencerEngine.ts'

export interface PlayedSample {
  instrumentId: string
  audioTime?: number
}

/**
 * A hand-cranked AudioDriver: no AudioContext, no timers. Tests advance the
 * clock and fire steps themselves, so engine behaviour is deterministic.
 */
export class FakeAudioDriver implements AudioDriver {
  loaded: readonly SampleSource[] = []
  played: PlayedSample[] = []
  bpm = 0
  transportRunning = false
  disposed = false
  unlockCalls = 0

  private clock = 0
  private currentState: AudioState = 'locked'
  private stepCallback: ((audioTime: number) => void) | null = null
  private stateListeners = new Set<(state: AudioState) => void>()
  private pendingDraws: { audioTime: number; callback: () => void }[] = []

  loadSamples(sources: readonly SampleSource[]): Promise<void> {
    this.loaded = [...sources]
    return Promise.resolve()
  }

  unlock(): Promise<void> {
    this.unlockCalls += 1
    this.setState('running')
    return Promise.resolve()
  }

  state(): AudioState {
    return this.currentState
  }

  onStateChange(listener: (state: AudioState) => void): Unsubscribe {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  now(): number {
    return this.clock
  }

  setBpm(bpm: number): void {
    this.bpm = bpm
  }

  onStep(callback: (audioTime: number) => void): void {
    this.stepCallback = callback
  }

  startTransport(): void {
    this.transportRunning = true
  }

  stopTransport(): void {
    this.transportRunning = false
  }

  play(instrumentId: string, audioTime?: number): void {
    this.played.push({ instrumentId, audioTime })
  }

  scheduleDraw(audioTime: number, callback: () => void): void {
    this.pendingDraws.push({ audioTime, callback })
  }

  cancelDraws(): void {
    this.pendingDraws = []
  }

  dispose(): void {
    this.disposed = true
    this.stepCallback = null
    this.stateListeners.clear()
    this.pendingDraws = []
  }

  // --- test controls ---

  setState(state: AudioState): void {
    if (state === this.currentState) return
    this.currentState = state
    for (const listener of this.stateListeners) listener(state)
  }

  /** Move the audio clock forward, releasing any draws that are now due. */
  advanceTo(time: number): void {
    this.clock = time
    this.flushDraws()
  }

  /** Fire one scheduled step, `lookahead` seconds before it sounds. */
  fireStep(lookahead = 0.1): void {
    if (!this.transportRunning) throw new Error('transport is not running')
    this.stepCallback?.(this.clock + lookahead)
  }

  /** Run every draw callback whose audio time has arrived. */
  flushDraws(): void {
    const due = this.pendingDraws.filter((d) => d.audioTime <= this.clock)
    this.pendingDraws = this.pendingDraws.filter((d) => d.audioTime > this.clock)
    for (const draw of due) draw.callback()
  }
}
