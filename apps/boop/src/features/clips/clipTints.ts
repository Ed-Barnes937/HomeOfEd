/**
 * The fixed 5-tint list (design handoff "Clip tints"; ADR 0032 amendment).
 * A clip's `tint` (0–4) indexes into this — the colour a child traces from a
 * chip to its lane squares, the clip header dot and the grid-well ring. The
 * list has exactly `TINT_COUNT` entries; the clip cap exists because of it.
 */
export const CLIP_TINTS = ['#6fe0f0', '#6fe0a8', '#b78bff', '#ffb03a', '#ff7fb0'] as const

/** The CSS colour for a clip's tint index. */
export function clipTint(tint: number): string {
  return CLIP_TINTS[tint] ?? CLIP_TINTS[0]
}
