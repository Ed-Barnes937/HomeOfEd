import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../../engine/sequencerEngine.ts'

export type PresetId = 'blank' | 'wonky' | 'robot' | 'stomp'

/** One kit row's on-steps. Position-only — see `Preset.rows`. */
export interface PresetRowSteps {
  readonly steps: readonly boolean[]
}

export interface Preset {
  id: PresetId
  name: string
  tempo: number
  /**
   * One entry per row, in kit order — position only, never an instrument id
   * ("Kits are pure data": apps/boop/CLAUDE.md — "Nothing outside the
   * manifest may enumerate instrument ids"). These boops are authored
   * against the launch kit's fixed row order (kick, snare, hi-hat, tom,
   * marimba, boop — see the row-position constants below), the same way
   * `instrumentColors.ts` maps colours by row position rather than by name.
   * `presetPattern` below is what turns this into a real `Pattern`, matched
   * against whichever kit is actually loaded.
   */
  rows: readonly PresetRowSteps[]
}

// Row-position labels for authoring below — matches the launch kit's fixed
// manifest order. Not instrument ids: `presetPattern` is what resolves a row
// position to whatever `instrumentId` the loaded kit actually has there.
const KICK = 0
const SNARE = 1
const HAT = 2
const TOM = 3
const MARIMBA = 4
const BOOP = 5
const ROW_COUNT = 6

/** Builds a full set of position-keyed rows from a sparse "on steps per row" map. */
function rowsFrom(onStepsByRow: Partial<Record<number, readonly number[]>>): readonly PresetRowSteps[] {
  return Array.from({ length: ROW_COUNT }, (_, rowIndex) => {
    const on = new Set(onStepsByRow[rowIndex] ?? [])
    return { steps: Array.from({ length: STEPS_PER_PATTERN }, (_, step) => on.has(step)) }
  })
}

/**
 * The starter-boop preset row (spec: "Onboarding & light education"; design
 * handoff: "Preset row"). Card order is fixed — Blank, Wonky Walk, Robot
 * Hiccup, Sunday Stomp — callers must render them in this array's order, with
 * blank presented first so nobody meets an unexplained void.
 *
 * Each preset carries its own tempo (the save shape already has one tempo per
 * creation), so loading a preset sets both the pattern and the tempo.
 */
export const PRESETS: readonly Preset[] = [
  {
    id: 'blank',
    name: 'Blank',
    tempo: 100,
    rows: rowsFrom({}),
  },
  {
    id: 'wonky',
    name: 'Wonky Walk',
    tempo: 92,
    // A lopsided shuffle: kick lands early and late instead of on the beat,
    // the hat has gaps instead of running straight. Marimba is left silent —
    // an obvious space to fill in.
    rows: rowsFrom({
      [KICK]: [0, 6, 8, 14],
      [SNARE]: [4, 12],
      [HAT]: [1, 3, 5, 9, 11, 13],
      [TOM]: [10],
      [BOOP]: [3, 11],
    }),
  },
  {
    id: 'robot',
    name: 'Robot Hiccup',
    tempo: 118,
    // A mechanical straight-8th hat under a syncopated kick, with a couple of
    // stutter toms for the "hiccup". Boop stays silent — a gap to fill.
    rows: rowsFrom({
      [KICK]: [0, 3, 8, 11],
      [SNARE]: [6, 14],
      [HAT]: [0, 2, 4, 6, 8, 10, 12, 14],
      [TOM]: [5, 13],
      [MARIMBA]: [2],
    }),
  },
  {
    id: 'stomp',
    name: 'Sunday Stomp',
    tempo: 104,
    // Four-on-the-floor kick with the snare doubling the backbeat (the
    // classic stomp-clap), off-beat hat. Tom and boop stay empty.
    rows: rowsFrom({
      [KICK]: [0, 4, 8, 12],
      [SNARE]: [4, 12],
      [HAT]: [2, 6, 10, 14],
      [MARIMBA]: [8],
    }),
  },
]

/**
 * Materialises a `Preset`'s position-only rows into a real `Pattern` for
 * `kit` — one row per kit instrument, in kit order, matched by position. A
 * kit with fewer rows than `ROW_COUNT` just gets a shorter pattern; the
 * engine, not this module, is the source of truth for how many rows exist.
 */
export function presetPattern(kit: Kit, preset: Preset): Pattern {
  return kit.instruments.map((instrument, rowIndex) => ({
    instrumentId: instrument.instrumentId,
    steps: preset.rows[rowIndex]?.steps ?? Array.from({ length: STEPS_PER_PATTERN }, () => false),
  }))
}
