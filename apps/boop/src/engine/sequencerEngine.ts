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
 * (ADR 0042) - this is a starting point, not a shape.
 */
export const DEFAULT_CLIP_ROWS = 6

/**
 * Cells in one **lane** - a pitched row's step column (pitched-lane spec §1).
 * Eight of them are one major octave, do to high do, so runs resolve and known
 * tunes are playable.
 *
 * **`pitchIndex` counts from the bottom, app-wide**: 0 is do, 7 is the high do
 * an octave above it. The design handoff's hue ladder happens to table its
 * colours from the top; that is converted at the ladder and nowhere else.
 */
export const PITCHES_PER_LANE = 8

/**
 * The **anchor pitch**, "so" - the middle of the lane, and the pitch a pitched
 * instrument's root sample is recorded at (spec §3). Two rules hang off it:
 * an on step carrying no note data reads as the anchor, and the anchor is
 * transposed by zero semitones. Together they are why converting a one-note
 * instrument leaves every saved boop and share link sounding byte-identical.
 */
export const ANCHOR_PITCH_INDEX = 4

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

/**
 * Which section of the instrument picker an entry belongs to (spec §2), in the
 * order the picker shows them. It is a *presentation* grouping and deliberately
 * not the `role`: roles are behavioural, and they cannot express these groups —
 * Notes and Silly are both `melodic`. Manifest data rather than a list in the
 * picker, because the manifest stays the only place instrument ids are
 * enumerated (ADR 0042; `apps/boop/CLAUDE.md`, "Kits are pure data").
 */
export const INSTRUMENT_GROUPS = ['drums', 'notes', 'silly'] as const
export type InstrumentGroup = (typeof INSTRUMENT_GROUPS)[number]

/**
 * What makes an instrument **pitched**: its row is a lane of
 * `PITCHES_PER_LANE` cells rather than 16 on/off ones, and its one `sound` is
 * repitched to play them (spec §3/§5).
 *
 * The config holds exactly one thing - the instrument's **register**, meaning
 * what note its root sample actually is. Everything else about a lane is the
 * same for every instrument and lives in `pitch.ts`: the sample is the anchor
 * "so", the anchor is zero semitones, and the eight cells are the major scale
 * around it. So the manifest never restates the ladder, it only says where the
 * ladder sits, and `laneNoteMidi` is what puts the two together.
 *
 * `rootNote` is scientific pitch notation ("G3", middle C being C4) because
 * that is what ticket 04 *measures* off the wav and what an author choosing a
 * register by ear writes down; `rootMidi` is the same note parsed, so nothing
 * downstream re-reads a string. The key the roster sits in is not recorded
 * here - it is a property of the registers together, asserted over the shipped
 * kit (F major, ADR 0059) rather than baked into the engine.
 */
export interface PitchedConfig {
  /** Scientific pitch notation: the measured pitch of the instrument's `sound`. */
  rootNote: string
  /** `rootNote` as a MIDI note number - the form the arithmetic uses. */
  rootMidi: number
}

/** One instrument as described by the kit manifest. `instrumentId` is opaque. */
export interface KitInstrument {
  instrumentId: string
  name: string
  artwork: string
  sound: string
  role?: InstrumentRole
  /** Optional like `role`: an entry without one is still pickable, just unsectioned. */
  group?: InstrumentGroup
  /**
   * Present iff this instrument plays a **lane**. Absent is one-note, exactly
   * as every instrument was before the lane existed - and absent is what
   * `role: 'melodic'` leaves it, because the role is picker taxonomy and says
   * nothing about pitch (spec §3). Flagging an instrument is a manifest edit
   * plus a sample file, never an engine change ("Kits are pure data").
   */
  pitched?: PitchedConfig
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

/**
 * One **note** sounding on a step: an instrument, and on a pitched row which of
 * its lane cells was painted. A pitched column holding a chord of n notes is n
 * hits, in ascending pitch order; `pitchIndex` is absent for a one-note row,
 * and for a pitched row carrying no note data (the anchor - see
 * `ANCHOR_PITCH_INDEX`), which is what keeps old boops byte-identical.
 */
export interface Hit {
  instrumentId: string
  /** 0..`PITCHES_PER_LANE - 1`, counted from the bottom of the lane. */
  pitchIndex?: number
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
  /**
   * Notes sounding on this step, in the pattern's own row order and, within a
   * pitched row's column, ascending pitch; possibly empty. One hit per note,
   * so a chord is several hits naming the same instrument.
   */
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

/**
 * One instrument's 16 cells, and - on a pitched row - which notes each of them
 * holds.
 *
 * `steps` is the **any-note projection**: `steps[s]` is on iff something
 * sounds there. `pitches`, when present, is 16 bitmasks of pitch indexes, one
 * per step, bit 0 = pitch index 0 = the bottom of the lane = do (the same
 * shape the save format stores as hex - spec §4). The two must agree:
 * `steps[s] === (pitches[s] !== 0)`, which `setPattern` enforces.
 *
 * `pitches` is **absent** on a one-note row - a drum has no lane, so there is
 * nothing to say - and absent on a pitched row that has never had a note
 * painted on it, where every on step reads as `ANCHOR_PITCH_INDEX` and sounds
 * the root sample untransposed. A row therefore only grows the field when a
 * pitch is actually chosen, and one-note rows are byte-identical to before
 * pitch existed.
 */
export interface PatternRow {
  readonly instrumentId: string
  readonly steps: readonly boolean[]
  readonly pitches?: readonly number[]
}

/**
 * The working grid: **the clip's own rows** (ADR 0042) - an ordered list of
 * 1..roster-size rows with unique `instrumentId`s, every one of them a kit
 * instrument. It is not one row per kit instrument in kit order: two clips of
 * one song may hold entirely different rows, and a row's position no longer
 * indexes the kit (look an instrument up by id).
 */
export type Pattern = readonly PatternRow[]

/**
 * A fresh clip's rows: the roster's first `DEFAULT_CLIP_ROWS`, nothing painted
 * (ADR 0042). The **one** definition of "a fresh grid", so the engine's own
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
   *
   * `pitchIndex` addresses **one note inside a lane column** (0..7 from the
   * bottom): turning it on *adds* that note, leaving the rest of the column
   * sounding, because a column is a chord (spec §6); turning it off removes
   * only that note, and the step clears once the last one goes. The audition
   * sounds the pitch that was tapped. Out of range, it throws like `step`.
   *
   * Omitting it addresses the **whole column**, which is what a drum cell, a
   * drag-to-erase and Clear grid all mean: off clears every note in it, and on
   * paints the anchor pitch (`ANCHOR_PITCH_INDEX`) - the untransposed sample,
   * so a one-note row behaves exactly as it always has.
   */
  setCell(instrumentId: string, step: number, on: boolean, pitchIndex?: number): void
  /**
   * Replace the whole grid - the row set included, which is how rows are
   * added, removed, reordered or swapped (loading a clip, a saved boop, a
   * share link). Rejected, leaving the grid untouched, if the list is empty,
   * names an instrument twice, names one the kit does not have, carries a row
   * that is not `STEPS_PER_PATTERN` long, or carries `pitches` that are not
   * `STEPS_PER_PATTERN` masks of lane bits projecting onto its own `steps`.
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
   *
   * `pitchIndex` is the pitched lane's tap-to-hear: the note that cell holds,
   * rather than the root sample. A pitch outside the lane is ignored the same
   * way an unknown instrument is.
   */
  audition(instrumentId: string, pitchIndex?: number): void

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
