/**
 * The sample clips (boop-loops ticket 17, spec §6) — the pre-made,
 * pattern-only clips the "+ New clip" picker offers, and the first-visit
 * seed. Pure data, additive forever; the roster is the eight authored on the
 * `prototype/12-new-clip-picker` branch, lifted verbatim.
 *
 * Authoring rules (ticket 07's decision):
 * - Pattern-only — no tempo; a sample clip plays at the boop's one bpm.
 * - Single-role: each leans on one instrument row, so it reads as a layer
 *   ("the bass part"), not an all-in-one starter. `Boom clap` and
 *   `Twinkle tune` carry a light second row by design.
 * - Plain labels a 6-year-old can parse; the label becomes the clip's name
 *   (renameable as ever — it is just ADR 0032's optional `name`).
 *
 * Row positions follow the launch kit's manifest order — position only, never
 * an instrument id ("Kits are pure data": apps/boop/CLAUDE.md). `samplePattern`
 * is what resolves a position to whatever the loaded kit actually has there,
 * the same way `instrumentColors.ts` maps colours by row position.
 */
import {
  blankPattern,
  DEFAULT_BPM,
  STEPS_PER_PATTERN,
  type Kit,
  type Pattern,
} from '../../engine/sequencerEngine.ts'
import { singleClipSong, type Song } from '../../song/song.ts'

/** One kit row's on-steps, position-keyed. */
export interface SampleRowSteps {
  readonly steps: readonly boolean[]
}

// Row-position labels for authoring below — the launch kit's fixed manifest order.
const KICK = 0
const SNARE = 1
const HAT = 2
const TOM = 3
const MARIMBA = 4
const BOOP = 5
const ROW_COUNT = 6

/** Builds a full set of position-keyed rows from a sparse "on steps per row" map. */
function rowsFrom(
  onStepsByRow: Partial<Record<number, readonly number[]>>,
): readonly SampleRowSteps[] {
  return Array.from({ length: ROW_COUNT }, (_, rowIndex) => {
    const on = new Set(onStepsByRow[rowIndex] ?? [])
    return { steps: Array.from({ length: STEPS_PER_PATTERN }, (_, step) => on.has(step)) }
  })
}

export interface SampleClip {
  id: string
  label: string
  rows: readonly SampleRowSteps[]
}

/** The all-off matrix — what the picker's Blank card shows. */
export const BLANK_ROWS: readonly SampleRowSteps[] = rowsFrom({})

/** The launch roster — picker order is this array's order, after Blank. */
export const SAMPLE_CLIPS: readonly SampleClip[] = [
  {
    id: 'slow-bass',
    label: 'Slow bass',
    // Two big thumps — the heartbeat layer.
    rows: rowsFrom({ [KICK]: [0, 8] }),
  },
  {
    id: 'bouncy-bass',
    label: 'Bouncy bass',
    // The same heartbeat with a skip after each thump.
    rows: rowsFrom({ [KICK]: [0, 3, 8, 11] }),
  },
  {
    id: 'tap-tap-hat',
    label: 'Tap tap hat',
    // Straight eighths — the "keep time" layer.
    rows: rowsFrom({ [HAT]: [0, 2, 4, 6, 8, 10, 12, 14] }),
  },
  {
    id: 'sneaky-hat',
    label: 'Sneaky hat',
    // Only the off-beats — sounds like tiptoeing.
    rows: rowsFrom({ [HAT]: [2, 6, 10, 14] }),
  },
  {
    id: 'boom-clap',
    label: 'Boom clap',
    // Backbeat snare over a minimal kick — the fullest single layer.
    rows: rowsFrom({ [KICK]: [0, 8], [SNARE]: [4, 12] }),
  },
  {
    id: 'tumble-toms',
    label: 'Tumble toms',
    // Little rolls at the end of each half — the "fill" layer.
    rows: rowsFrom({ [TOM]: [6, 7, 14, 15] }),
  },
  {
    id: 'twinkle-tune',
    label: 'Twinkle tune',
    // A sparse marimba melody with one answering boop.
    rows: rowsFrom({ [MARIMBA]: [0, 3, 6, 10, 12], [BOOP]: [14] }),
  },
  {
    id: 'boop-boop',
    label: 'Boop boop',
    // Paired boops answering the backbeat.
    rows: rowsFrom({ [BOOP]: [4, 5, 12, 13] }),
  },
]

/**
 * Materialises position-only rows into a real `Pattern` for `kit` — the rows a
 * fresh clip has (`blankPattern`: the roster's first six, in manifest order),
 * matched by position. A clip is six rows by default, not one per instrument
 * the kit can play (ADR 0042), and the authored positions were written against
 * exactly those six; a kit with fewer just gets a shorter pattern, and a
 * position past its end is dropped.
 */
export function samplePattern(kit: Kit, rows: readonly SampleRowSteps[]): Pattern {
  return blankPattern(kit).map((row, rowIndex) => ({
    instrumentId: row.instrumentId,
    steps: rows[rowIndex]?.steps ?? row.steps,
  }))
}

/** The sample clip a browser that has never been here opens on (spec §7). */
export const FIRST_VISIT_SAMPLE_ID = 'boom-clap'

/**
 * What a first visit lands on: a one-clip song whose clip is a sample clip —
 * it still sounds like something and demos the model (spec §7). `Boom clap`
 * because it is the roster's fullest single layer, the one that reads as a
 * beat on its own. Named after its label like any picked sample clip; the
 * song's bpm is the default, since sample clips carry no tempo.
 *
 * Module-level and pure, so it is a stable dependency of the restore effect
 * in `useWorkingSong` — which is where the seeding happens, since it is a
 * property of restoring the working song, not of the picker.
 */
export function firstVisitSong(kit: Kit): Song {
  const sample = SAMPLE_CLIPS.find((s) => s.id === FIRST_VISIT_SAMPLE_ID)!
  const song = singleClipSong(samplePattern(kit, sample.rows), DEFAULT_BPM)
  return { ...song, clips: [{ ...song.clips[0]!, name: sample.label }] }
}
