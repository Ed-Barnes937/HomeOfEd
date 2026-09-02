import type { AudioDriver } from './audioDriver.ts'
import {
  DEFAULT_BPM,
  DEFAULT_CLIP_ROWS,
  MAX_BPM,
  MIN_BPM,
  STEPS_PER_PATTERN,
  type AudioState,
  type BeatEvent,
  type Hit,
  type Kit,
  type Pattern,
  type SequencerEngine,
  type TransportEvent,
  type Unsubscribe,
} from './sequencerEngine.ts'

export interface SequencerEngineOptions {
  kit: Kit
  driver: AudioDriver
}

/**
 * Build an engine over a loaded kit and await its samples, so the very first
 * cell tap is audible. The **whole roster** is preloaded, not just the rows a
 * clip happens to hold (ADR 0041): rows change under a child's finger and the
 * picker auditions instruments no clip has yet, so anything less would be
 * silence at the tap. They are 20 short one-shots.
 */
export async function createSequencerEngine({
  kit,
  driver,
}: SequencerEngineOptions): Promise<SequencerEngine> {
  const engine = new BoopSequencerEngine(kit, driver)
  await driver.loadSamples(
    kit.instruments.map((instrument) => ({
      instrumentId: instrument.instrumentId,
      url: instrument.sound,
    })),
  )
  return engine
}

class BoopSequencerEngine implements SequencerEngine {
  /**
   * The clip's rows, in their own order (ADR 0041) - a Map because cells are
   * addressed by `instrumentId`, and Map iteration is insertion order, which
   * is exactly the row order hits and `getPattern()` must report. Replaced
   * wholesale by `setPattern`: that is how a row set changes.
   */
  private rows: Map<string, boolean[]>
  /** The roster, for the id checks. `kit.instruments` stays the enumeration. */
  private readonly kitIds: ReadonlySet<string>
  private readonly beatListeners = new Set<(event: BeatEvent) => void>()
  private readonly drawListeners = new Set<(event: BeatEvent) => void>()
  private readonly transportListeners = new Set<(event: TransportEvent) => void>()
  private readonly audioStateListeners = new Set<(state: AudioState) => void>()
  private readonly offDriverState: Unsubscribe

  private bpm = DEFAULT_BPM
  private playing = false
  private nextTick = 0
  /**
   * The point `songPos()` interpolates from: a position in tick space and the
   * audio time it was true at. Replaced by every scheduled beat, and by
   * anything else that would otherwise make the playhead jump (start, tempo).
   * Null while stopped — a stopped transport sits at the top, not at a
   * remembered position.
   */
  private anchor: { pos: number; audioTime: number } | null = null
  /**
   * The lowest position `songPos()` will report. Steps are scheduled a lookahead
   * early, so the raw position runs up to one lookahead behind the step that is
   * about to sound; without a floor the playhead would sit slightly behind the
   * song's start, and step *backwards* right after a seek. Raised by a seek to
   * its target, and inert again as soon as the transport catches up.
   */
  private posFloor = 0

  constructor(
    readonly kit: Kit,
    private readonly driver: AudioDriver,
  ) {
    this.kitIds = new Set(kit.instruments.map((instrument) => instrument.instrumentId))
    // A fresh grid is the roster's first six, empty - a starting point for the
    // child to change, not the shape of every clip.
    this.rows = new Map(
      kit.instruments
        .slice(0, DEFAULT_CLIP_ROWS)
        .map((instrument) => [
          instrument.instrumentId,
          new Array<boolean>(STEPS_PER_PATTERN).fill(false),
        ]),
    )
    driver.setBpm(this.bpm)
    driver.onStep((audioTime) => this.onScheduledStep(audioTime))
    this.offDriverState = driver.onStateChange((state) => this.onAudioStateChange(state))
  }

  getPattern(): Pattern {
    return [...this.rows].map(([instrumentId, steps]) => ({ instrumentId, steps: [...steps] }))
  }

  setCell(instrumentId: string, step: number, on: boolean): void {
    const steps = this.rowFor(instrumentId)
    assertStep(step)
    if (steps[step] === on) return
    steps[step] = on
    if (on && !this.playing) this.audition(instrumentId)
  }

  setPattern(pattern: Pattern): void {
    if (pattern.length === 0) throw new Error('pattern must have at least one row')
    // Build the whole row set before adopting any of it, so a bad pattern
    // leaves the grid alone.
    const rows = new Map<string, boolean[]>()
    for (const row of pattern) {
      const { instrumentId, steps } = row
      if (!this.kitIds.has(instrumentId)) {
        throw new Error(`unknown instrument "${instrumentId}" for this kit`)
      }
      if (rows.has(instrumentId)) {
        throw new Error(`pattern names instrument "${instrumentId}" twice`)
      }
      if (steps.length !== STEPS_PER_PATTERN) {
        throw new Error(
          `pattern row "${instrumentId}" must have ${STEPS_PER_PATTERN} steps, got ${steps.length}`,
        )
      }
      rows.set(
        instrumentId,
        Array.from({ length: STEPS_PER_PATTERN }, (_, step) => steps[step] === true),
      )
    }
    this.rows = rows
  }

  audition(instrumentId: string): void {
    // Called straight from a tap, so an id the kit does not know is ignored
    // rather than thrown (the contract says so). The driver would no-op anyway.
    if (!this.kitIds.has(instrumentId)) return
    if (this.driver.state() === 'running') {
      this.driver.play(instrumentId)
      return
    }
    // The tap that called us is itself a gesture, so it may unlock.
    void this.driver.unlock().then(() => this.driver.play(instrumentId))
  }

  async start(): Promise<void> {
    if (this.playing) return
    // Must run inside the user gesture that called us — hence unlock first.
    await this.driver.unlock()
    this.playing = true
    // There is no pause: nothing carries over from the last run, because the
    // rewind lives in `stop()`. Play therefore starts wherever the playhead is
    // — the top, unless a seek has since put it somewhere a child chose.
    // Anchoring straight away also means the playhead moves at once, rather
    // than sitting still until the first scheduled beat and then jumping back
    // by one lookahead.
    this.anchor = { pos: this.nextTick, audioTime: this.driver.now() }
    this.driver.startTransport()
    this.emitTransport({ type: 'started' })
  }

  stop(): void {
    if (!this.playing) return
    // Stopping discards the run's progress — a stopped transport sits at the
    // top, not at a remembered position. The rewind lives here rather than in
    // `start()` so that a seek made while stopped is not wiped by the play that
    // is meant to sound it.
    this.nextTick = 0
    this.posFloor = 0
    this.anchor = null
    this.playing = false
    this.driver.stopTransport()
    // Steps already scheduled will never sound now; their draws must not fire.
    this.driver.cancelDraws()
    this.emitTransport({ type: 'stopped' })
  }

  isPlaying(): boolean {
    return this.playing
  }

  getTempo(): number {
    return this.bpm
  }

  setTempo(bpm: number): void {
    if (!Number.isFinite(bpm)) return
    const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
    if (clamped === this.bpm) return
    // Re-anchor first: the seconds-per-step the old anchor was read against is
    // about to change, and songPos() must not jump.
    if (this.playing) {
      this.anchor = { pos: this.rawPos(), audioTime: this.driver.now() }
    }
    this.bpm = clamped
    this.driver.setBpm(clamped)
    this.emitTransport({ type: 'tempoChanged', bpm: clamped })
  }

  songPos(): number {
    // Floored only here: the raw value runs a lookahead behind the step about to
    // sound (negative before the very first one), and re-anchoring must carry
    // that raw value rather than a floored one.
    return Math.max(this.posFloor, this.rawPos())
  }

  seek(tick: number): void {
    if (!Number.isFinite(tick)) return
    const target = Math.max(0, Math.floor(tick))
    this.nextTick = target
    // The target's own step is scheduled a lookahead early, so the raw position
    // is behind it until it sounds. Hold the playhead at the target until then,
    // rather than letting it step backwards under a child's finger.
    this.posFloor = target
    // Re-anchor the same way setTempo does, so songPos() reads the target at
    // once rather than carrying on from the pre-jump anchor. Stopped, there is
    // no anchor to hold: `posFloor` reports the target, and `nextTick` is what
    // the next start() sounds from.
    if (this.playing) {
      this.anchor = { pos: target, audioTime: this.driver.now() }
    }
    // Audio inside the lookahead still sounds — the driver cannot unschedule it
    // (spec §7.1) — but its draws would report the position we just left.
    this.driver.cancelDraws()
  }

  audioState(): AudioState {
    return this.driver.state()
  }

  onBeat(listener: (event: BeatEvent) => void): Unsubscribe {
    return subscribe(this.beatListeners, listener)
  }

  onDrawBeat(listener: (event: BeatEvent) => void): Unsubscribe {
    return subscribe(this.drawListeners, listener)
  }

  onTransport(listener: (event: TransportEvent) => void): Unsubscribe {
    return subscribe(this.transportListeners, listener)
  }

  onAudioState(listener: (state: AudioState) => void): Unsubscribe {
    return subscribe(this.audioStateListeners, listener)
  }

  /**
   * Release what this engine owns — its listeners, and the transport it may
   * have running. **Not** the driver: it is injected, so its owner disposes it.
   * React's dev double-mount builds a second engine over the same driver, and
   * disposing the first one's driver would leave the live engine with no
   * samples and no output bus — a moving playhead and silence.
   */
  dispose(): void {
    this.stop()
    this.offDriverState()
    this.beatListeners.clear()
    this.drawListeners.clear()
    this.transportListeners.clear()
    this.audioStateListeners.clear()
  }

  /**
   * Scheduler callback: runs ahead of the sound, off the main render path. No
   * DOM work here — draw-time consumers are served via `scheduleDraw`.
   */
  private onScheduledStep(audioTime: number): void {
    const tick = this.nextTick
    this.nextTick += 1
    const step = tick % STEPS_PER_PATTERN

    const hits: Hit[] = []
    for (const [instrumentId, steps] of this.rows) {
      if (steps[step]) {
        hits.push({ instrumentId })
        this.driver.play(instrumentId, audioTime)
      }
    }

    this.anchor = { pos: tick, audioTime }

    const event: BeatEvent = { tick, step, audioTime, hits }
    for (const listener of this.beatListeners) listener(event)
    if (this.drawListeners.size > 0) {
      this.driver.scheduleDraw(audioTime, () => {
        for (const listener of this.drawListeners) listener(event)
      })
    }
  }

  private onAudioStateChange(state: AudioState): void {
    // iPadOS parks the context in `interrupted` after a call or a lock; the
    // loop is silently dead until another gesture, so surface it as a stop.
    if (state !== 'running' && this.playing) this.stop()
    for (const listener of this.audioStateListeners) listener(state)
  }

  private rowFor(instrumentId: string): boolean[] {
    const steps = this.rows.get(instrumentId)
    if (!steps) {
      // The kit knowing an instrument no longer means this clip has a row for
      // it, so the two failures read differently.
      throw new Error(
        this.kitIds.has(instrumentId)
          ? `instrument "${instrumentId}" is not a row of this pattern`
          : `unknown instrument "${instrumentId}" for this kit`,
      )
    }
    return steps
  }

  /** `songPos()` without the zero clamp — the value re-anchoring must use. */
  private rawPos(): number {
    if (!this.anchor) return 0
    return this.anchor.pos + (this.driver.now() - this.anchor.audioTime) / this.secondsPerStep()
  }

  private secondsPerStep(): number {
    return 60 / this.bpm / 4
  }

  private emitTransport(event: TransportEvent): void {
    for (const listener of this.transportListeners) listener(event)
  }
}

function assertStep(step: number): void {
  if (!Number.isInteger(step) || step < 0 || step >= STEPS_PER_PATTERN) {
    throw new Error(`step must be an integer in 0..${STEPS_PER_PATTERN - 1}, got ${step}`)
  }
}

function subscribe<T>(listeners: Set<T>, listener: T): Unsubscribe {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
