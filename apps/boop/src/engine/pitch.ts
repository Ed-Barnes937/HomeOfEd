import {
  ANCHOR_PITCH_INDEX,
  PITCHES_PER_LANE,
  STEPS_PER_PATTERN,
  type KitInstrument,
  type PatternRow,
  type PitchedConfig,
} from './sequencerEngine.ts'

/**
 * The mechanics of a lane's eight pitches: the bitmask a `PatternRow` stores
 * its notes in, and what each of them does to a root sample. Pure and
 * Tone-free - the driver is handed plain semitones, and never a pitch index
 * (ADR 0024).
 *
 * `pitchIndex` counts **from the bottom** everywhere in the app: 0 is do, 7 is
 * the high do an octave up. `PITCHES_PER_LANE` and `ANCHOR_PITCH_INDEX` are on
 * the contract beside `STEPS_PER_PATTERN`, because they say what a lane *is*;
 * this file only says how it is packed and how it sounds.
 */

/**
 * Semitones above "do" for each cell of the lane: the major scale, one octave,
 * the top cell the same note as the bottom one (spec §1). The ensemble is in C
 * major (ADR 0065), which is the register data's business - the shape of the
 * ladder is the same in any key.
 */
const MAJOR_SCALE_SEMITONES: readonly number[] = [0, 2, 4, 5, 7, 9, 11, 12]

/** Every pitch of a lane painted at once - the mask an 8-note chord has. */
const FULL_LANE_MASK = (1 << PITCHES_PER_LANE) - 1

/** The anchor "so" on its own: what an on step with no note data means (spec §3). */
export const ANCHOR_PITCH_MASK = 1 << ANCHOR_PITCH_INDEX

/** Whether `value` names a cell of the lane, and can therefore be painted. */
export function isPitchIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < PITCHES_PER_LANE
}

/** The one-note mask for a pitch index. Bit 0 (the LSB) is the bottom cell. */
export function pitchMask(pitchIndex: number): number {
  return 1 << pitchIndex
}

export function hasPitch(mask: number, pitchIndex: number): boolean {
  return (mask & pitchMask(pitchIndex)) !== 0
}

/** The pitches a column holds, **low note first** - the order hits are emitted in. */
export function pitchesInMask(mask: number): number[] {
  const pitches: number[] = []
  for (let pitchIndex = 0; pitchIndex < PITCHES_PER_LANE; pitchIndex += 1) {
    if (hasPitch(mask, pitchIndex)) pitches.push(pitchIndex)
  }
  return pitches
}

/** Whether `mask` is a whole number of lane bits and nothing else. */
export function isPitchMask(mask: number): boolean {
  return Number.isInteger(mask) && mask >= 0 && mask <= FULL_LANE_MASK
}

/**
 * How far a note is transposed from the instrument's root sample, which is
 * recorded at the anchor (spec §3). The anchor is therefore **zero**, and the
 * lane spans -7..+5 semitones - the repitch stays inside the range the
 * 2026-09-17 research measured as clean for a one-shot.
 */
export function semitonesFromAnchor(pitchIndex: number): number {
  return MAJOR_SCALE_SEMITONES[pitchIndex]! - MAJOR_SCALE_SEMITONES[ANCHOR_PITCH_INDEX]!
}

/**
 * How far a note is transposed from **this instrument's** sample: the ladder
 * above for a pitched instrument, and **undefined** for a one-note one, which
 * has no lane to index and therefore no transposition to ask the driver for.
 * Only the manifest can make an instrument transposable, which is "kits are
 * pure data" said from the audio side.
 *
 * Undefined rather than zero is the load-bearing half (ADR 0067). Pitch data
 * can reach a one-note row only from a newer build's document, and zero would
 * play it as several coincident copies of the same untransposed sample - a
 * unison the chord law does not cover. Spec §4 rules otherwise: a stale build
 * plays the rhythm on the base sample, one hit per step.
 */
export function semitonesForInstrument(
  instrument: KitInstrument,
  pitchIndex: number,
): number | undefined {
  return instrument.pitched ? semitonesFromAnchor(pitchIndex) : undefined
}

/**
 * What note a lane cell actually sounds, as MIDI: the instrument's **register**
 * (its root sample's own pitch, from the manifest) walked by the same ladder.
 * The one place the two meet, and therefore what "do lands where the manifest
 * says" means - a G3 root puts do on C3 and high do on C4.
 *
 * Nothing in playback needs it (the driver takes semitones, not notes); it is
 * how the registers can be checked against each other - the roster is in C
 * major (spec §3), which is a statement about these numbers.
 */
export function laneNoteMidi(pitched: PitchedConfig, pitchIndex: number): number {
  return pitched.rootMidi + semitonesFromAnchor(pitchIndex)
}

/** Semitones each note letter sits above the C below it. */
const NOTE_LETTER_SEMITONES: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

/** Scientific pitch notation: a letter, an optional accidental, an octave. */
const NOTE_NAME = /^([A-G])([#b]?)(-1|[0-9])$/

/**
 * A note name to its MIDI number, or `undefined` if that is not a note - the
 * manifest parser's validator for a register, and the only place the app reads
 * pitch notation at all. Middle C is C4 (60), the convention the samples are
 * measured in; anything outside MIDI 0-127 is not a note we could name.
 */
export function noteNameToMidi(name: string): number | undefined {
  const match = NOTE_NAME.exec(name)
  if (!match) return undefined
  const [, letter, accidental, octave] = match
  const semitone =
    NOTE_LETTER_SEMITONES[letter!]! + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)
  const midi = (Number(octave) + 1) * 12 + semitone
  return midi >= 0 && midi <= 127 ? midi : undefined
}

/**
 * A row's notes as 16 masks, whether or not it stores any: a row with no
 * `pitches` reads as the anchor on every on step (spec §3's conversion rule).
 * The one place that rule is applied, so playback, layering and anything later
 * cannot each answer it differently.
 */
export function rowPitchMasks(row: PatternRow): readonly number[] {
  if (row.pitches) return row.pitches
  return Array.from({ length: STEPS_PER_PATTERN }, (_, step) =>
    row.steps[step] === true ? ANCHOR_PITCH_MASK : 0,
  )
}
