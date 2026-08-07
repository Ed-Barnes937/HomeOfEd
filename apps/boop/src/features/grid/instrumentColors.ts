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
