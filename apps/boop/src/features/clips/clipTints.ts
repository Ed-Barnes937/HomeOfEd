/**
 * The fixed 10-tint list (ADR 0032, as amended by boop-clips tickets 04 and
 * 05). A clip's `tint` (0–9) indexes into this - the colour a child traces
 * from a chip to its lane squares, the clip header dot and the grid-well ring.
 * The list has exactly `TINT_COUNT` entries.
 *
 * Ten colours to 35 clips, so past the tenth clip a colour is shared: it says
 * "this lane, these squares and that dot are one clip", and stops being a name
 * for the clip. The clip's *name* is what names it, everywhere it shows.
 *
 * The first five are the design handoff's "Clip tints", untouched. The next
 * five are their companions, derived rather than invented. Two are the
 * handoff's own instrument hues (`tokens.scss`), which the clip palette had
 * never taken: hi-hat yellow and kick coral. The other three fill the gaps
 * those leave in the hue circle - blue between cyan and violet, leaf green
 * between yellow and mint, magenta between violet and pink - at the lightness
 * band the five were drawn in (61-77% L), because they are read on the same
 * dark stage.
 *
 * Order is not decoration: a new clip takes the least-used tint, lowest first,
 * so this is the sequence a child meets - once on the first lap, again on
 * every lap after it - and each entry is far in hue from the one before it.
 */
export const CLIP_TINTS = [
  '#6fe0f0', // cyan (handoff)
  '#6fe0a8', // mint (handoff)
  '#b78bff', // violet (handoff)
  '#ffb03a', // orange (handoff)
  '#ff7fb0', // pink (handoff)
  '#dce85c', // yellow (the handoff's hi-hat hue)
  '#6f9cff', // blue
  '#ff6b5c', // coral (the handoff's kick hue)
  '#8ee06f', // leaf green
  '#f06fe0', // magenta
] as const

/** The CSS colour for a clip's tint index. */
export function clipTint(tint: number): string {
  return CLIP_TINTS[tint] ?? CLIP_TINTS[0]
}
