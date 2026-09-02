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

/**
 * Rows a fresh clip starts with: the roster's first six (the classic
 * kick/snare/hat/tom/marimba/boop, which stay first in the manifest). A
 * smaller roster simply gets all of it. Rows are dynamic from here on
 * (ADR 0041) - this is a starting point, not a shape.
 */
export const DEFAULT_CLIP_ROWS = 6

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

/**
 * A loaded kit manifest - boop's **roster**, and the only enumeration of
 * instruments. A clip picks its rows from it, so manifest order is the
 * picker's order and the order of a fresh clip's default rows, not the grid's.
 */
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
  /** Rows sounding on this step, in the pattern's own row order; possibly empty. */
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

/**
 * The working grid: **the clip's own rows** (ADR 0041) - an ordered list of
 * 1..roster-size rows with unique `instrumentId`s, every one of them a kit
 * instrument. It is not one row per kit instrument in kit order: two clips of
 * one song may hold entirely different rows, and a row's position no longer
 * indexes the kit (look an instrument up by id).
 */
export type Pattern = readonly PatternRow[]

/**
 * A fresh clip's rows: the roster's first `DEFAULT_CLIP_ROWS`, nothing painted
 * (ADR 0041). The **one** definition of "a fresh grid", so the engine's own
 * starting pattern, a Blank clip, a sample clip's resolved rows and decode's
 * fallback cannot drift apart - the reason the default row count is a constant
 * on this contract at all. A roster shorter than six simply gets all of it,
 * which is what keeps the small test kits meaningful.
 */
export function blankPattern(kit: Kit): Pattern {
  return kit.instruments.slice(0, DEFAULT_CLIP_ROWS).map((instrument) => ({
    instrumentId: instrument.instrumentId,
    steps: new Array<boolean>(STEPS_PER_PATTERN).fill(false),
  }))
}

export interface SequencerEngine {
  /** The loaded kit — readable state, the only place instruments are enumerated. */
  readonly kit: Kit

  /**
   * The working grid as readable state, in its own row order. Edits are not an
   * event stream. A fresh grid holds the roster's first `DEFAULT_CLIP_ROWS`.
   */
  getPattern(): Pattern
  /**
   * Toggle one cell. Turning a cell on while stopped auditions the sample —
   * that is engine-internal, callers do not trigger sound themselves. Throws
   * for an instrument this pattern has no row for: cells belong to rows.
   */
  setCell(instrumentId: string, step: number, on: boolean): void
  /**
   * Replace the whole grid - the row set included, which is how rows are
   * added, removed, reordered or swapped (loading a clip, a saved boop, a
   * share link). Rejected, leaving the grid untouched, if the list is empty,
   * names an instrument twice, names one the kit does not have, or carries a
   * row that is not `STEPS_PER_PATTERN` long.
   */
  setPattern(pattern: Pattern): void

  /**
   * Play one instrument's sample now, from a user gesture - the instrument
   * picker's audition-by-ear. Sounds whether or not the loop is running and
   * whether or not the clip has a row for it, and touches neither the pattern
   * nor the transport. While the context is still `locked` it unlocks first
   * (the gesture that called it is what allows that), so nothing is heard
   * synchronously - audition-on-toggle behaves the same way. An instrument the
   * kit does not know is ignored rather than thrown: a tap must never crash
   * the toy.
   */
  audition(instrumentId: string): void

  /**
   * Unlock audio (must be called from a user gesture) and start the loop —
   * always from the top: `tick` and the playhead rewind to 0 first.
   */
  start(): Promise<void>
  /** Stop the loop. There is no pause, so nothing is kept to resume from. */
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

  /**
   * Move the transport to `tick`, playing or stopped. Fractional targets land on
   * the whole tick below, so `step` stays a grid column; a negative target
   * clamps to the start of the song and a non-finite one is ignored — the way
   * `setTempo` refuses a bad tempo.
   *
   * A seek is not a start or a stop, so it emits no transport event. Steps
   * already scheduled inside the lookahead still sound (the driver cannot
   * unschedule audio) but their draws are dropped, so no pre-jump position
   * reaches the UI. See ADR 0024's amendment.
   */
  seek(tick: number): void

  audioState(): AudioState

  /** Canonical seam: fires at schedule time, with lookahead. No DOM work here. */
  onBeat(listener: (event: BeatEvent) => void): Unsubscribe
  /** Convenience: the same events, delivered at draw time. Safe for the DOM. */
  onDrawBeat(listener: (event: BeatEvent) => void): Unsubscribe
  onTransport(listener: (event: TransportEvent) => void): Unsubscribe
  onAudioState(listener: (state: AudioState) => void): Unsubscribe

  dispose(): void
}
