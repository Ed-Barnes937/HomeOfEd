/**
 * The row colour hues from the design handoff, in the launch kit's fixed row
 * order (kick, snare, hi-hat, tom, marimba, boop). Positional, not a lookup by
 * `instrumentId` — the kit manifest has no colour field yet (kit content is a
 * separate ticket), and the engine contract must stay the only place
 * instruments are enumerated, so this indexes by row position rather than
 * naming instrument ids. Shared between the grid (cell/artwork colour) and the
 * preset-row thumbnails (dot colour).
 */
export const ROW_COLOR_VARS = [
  '--instrument-kick',
  '--instrument-snare',
  '--instrument-hihat',
  '--instrument-tom',
  '--instrument-marimba',
  '--instrument-boop',
] as const

/**
 * The hue a row at this position wears. Rows are the clip's own since ADR 0042,
 * so a clip can hold up to the whole roster: past the sixth row the six hues
 * **cycle** (spec §10.2, a decision the owner accepted), which keeps the grid
 * reading top-to-bottom as a stable rainbow whatever instruments are in it.
 *
 * The cost, accepted with it: hue belongs to the *position*, not the
 * instrument, so deleting a row recolours every row below it. The alternative,
 * a colour per manifest instrument, is recorded as rejected for now.
 *
 * One definition, because it is one decision - the two renderers, the picker's
 * tint and the add-a-sound flow all ask this rather than repeating the modulo.
 */
export function rowColorVar(rowIndex: number): string {
  return ROW_COLOR_VARS[rowIndex % ROW_COLOR_VARS.length]!
}
