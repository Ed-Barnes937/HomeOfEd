/**
 * The `SequencerEngine` contract — boop's one audio seam.
 *
 * Everything the rest of the app knows about sound goes through this file.
 * Tone.js is an implementation detail of `ToneAudioDriver` and never appears
 * in these types. See `apps/boop/CONTEXT.md` for the vocabulary (tick, step,
 * beat event, hit, kit manifest, role).
 */

/** Columns in one pattern. `step` is always `tick mod STEPS_PER_PATTERN`. */
export const STEPS_PER_PATTERN = 16

/** Tempo bounds the toy allows (design handoff: slider range 60–200). */
export const MIN_BPM = 60
export const MAX_BPM = 200
export const DEFAULT_BPM = 100

export type Unsubscribe = () => void

/**
 * Reserved semantic tag on a kit-manifest entry. V1 ignores it; it exists so a
 * future world layer can map behaviour without enumerating instrument ids.
 */
export const INSTRUMENT_ROLES = ['kick', 'snare', 'hat', 'perc', 'melodic'] as const
export type InstrumentRole = (typeof INSTRUMENT_ROLES)[number]

/** One instrument as described by the kit manifest. `instrumentId` is opaque. */
export interface KitInstrument {
  instrumentId: string
  name: string
  artwork: string
  sound: string
  role?: InstrumentRole
}

/** A loaded kit manifest. Row order is the manifest's instrument order. */
export interface Kit {
  kitId: string
  name: string
  instruments: readonly KitInstrument[]
}

/** One instrument sounding on a step. An object so future fields (e.g. `note`) are additive. */
export interface Hit {
  instrumentId: string
}

/**
 * Emitted once per step — empty steps included, so playhead and `songPos()`
 * anchoring never starve. Schedule-time listeners receive it ~one lookahead
 * before `audioTime`; they must not touch the DOM (use `onDrawBeat`).
 */
export interface BeatEvent {
  /** Monotonic count of scheduled steps; never wraps at the pattern boundary. */
  tick: number
  /** Grid column, `tick mod STEPS_PER_PATTERN`. */
  step: number
  /** AudioContext time at which this step sounds. */
  audioTime: number
  /** Rows sounding on this step, in kit order; possibly empty. */
  hits: readonly Hit[]
}

export type TransportEvent =
  { type: 'started' } | { type: 'stopped' } | { type: 'tempoChanged'; bpm: number }

/**
 * `locked` — the AudioContext has not been unlocked by a gesture yet.
 * `running` — audible. `interrupted` — iPadOS Safari's non-standard state
 * after a call/siri/backgrounding; recovered by another `start()` gesture.
 */
export type AudioState = 'locked' | 'running' | 'interrupted'

/** One instrument's 16 cells. */
export interface PatternRow {
  readonly instrumentId: string
  readonly steps: readonly boolean[]
}

/** The working grid: one row per kit instrument, in kit order. */
export type Pattern = readonly PatternRow[]

export interface SequencerEngine {
  /** The loaded kit — readable state, the only place instruments are enumerated. */
  readonly kit: Kit

  /** The working grid as readable state. Edits are not an event stream. */
  getPattern(): Pattern
  /**
   * Toggle one cell. Turning a cell on while stopped auditions the sample —
   * that is engine-internal, callers do not trigger sound themselves.
   */
  setCell(instrumentId: string, step: number, on: boolean): void
  /** Replace the whole grid (loading a preset, a saved boop, a share link). */
  setPattern(pattern: Pattern): void

  /** Unlock audio (must be called from a user gesture) and start the loop. */
  start(): Promise<void>
  /** Pause the loop. `tick` is not reset — playback resumes where it stopped. */
  stop(): void
  isPlaying(): boolean

  getTempo(): number
  /** Rounded to an integer and clamped to [MIN_BPM, MAX_BPM]. */
  setTempo(bpm: number): void

  /**
   * Continuous playhead position in tick space (fractional), re-anchored on
   * every scheduled beat. `songPos() % STEPS_PER_PATTERN` is the grid column.
   * Read it per animation frame; it is a query, not an event.
   */
  songPos(): number

  audioState(): AudioState

  /** Canonical seam: fires at schedule time, with lookahead. No DOM work here. */
  onBeat(listener: (event: BeatEvent) => void): Unsubscribe
  /** Convenience: the same events, delivered at draw time. Safe for the DOM. */
  onDrawBeat(listener: (event: BeatEvent) => void): Unsubscribe
  onTransport(listener: (event: TransportEvent) => void): Unsubscribe
  onAudioState(listener: (state: AudioState) => void): Unsubscribe

  dispose(): void
}
