# 0060 - boop: the pitched lane adopts the grid's geometry

- **Status:** Accepted
- **Date:** 2026-09-18
- **Related:** [ADR 0027](0027-boop-small-phone-layout.md) as amended by
  [ADR 0042](0042-boop-dynamic-clip-rows.md) ("the grid never shrinks" - the
  rule this ADR refuses to bend),
  [ADR 0033](0033-boop-laptop-column-fits-its-breakpoint.md) (the 52px laptop
  cell the lane lands on),
  [ADR 0024](0024-boop-sequencer-engine-seam.md) as amended 2026-09-17 (the
  engine's pitch shape this draws), [ADR 0058](0058-boop-save-format-pitches.md).
  Implements [pitched-lane ticket 06](../../.scratch/pitched-instruments/issues/06-desktop-lane.md);
  spec §2, §6, §7, §11.

## Context

The pitched-lane design handoff draws the lane in a **40px-step world** and
narrows every existing row - drums included - to match, losing 250px of clip
width. Ed rejected that at the grill session (spec §2): boop's geometry is the
fixed frame and the handoff is direction, not pixels. That leaves the lane to be
re-derived on 52px desktop / 42px tablet columns, and it leaves three things the
handoff does not answer on those columns: the tile size, where a tap lands, and
what a drag down the column is.

## Decision

1. **The lane renders on the existing step columns; no drum row changes by a
   pixel.** The handoff's step width, its 1022px card and its bar-strip widths
   are dissolved. Everything non-geometric is exact as drawn: hue ladder, plate
   treatment, playhead column, the dark-inside/light-outside ring, the HIGH/LOW
   gradient legend, the label-column variant, the type.
2. **Tile 24px on a 4px gap at ≥1280, 20px on 4px in the tablet band** (lane
   220px / 188px tall). The handoff's own 20/4 is kept where the column is
   nearly its own width (42 ≈ 40); the wider desktop column gets a taller tile
   so it reads as a note rather than the wide bar the handoff warned 52px
   columns produce. Vertical space is the scarce axis on this frame (ADR 0030),
   so the tile grows to the aspect and no further.
3. **The column carries the hit, and the bands are measured, not assumed.** A
   tile is far under the 44px floor, so the eight bands are the column's, each
   centred on its tile, the end bands absorbing the plate's padding
   (`laneGeometry.ts`, unit-tested at both column sizes). The component reads
   the rendered lane's own rects rather than trusting constants, so the
   stylesheet and the bands cannot drift into the handoff's warned
   "taps land one note low" bug.
4. **The tile is the visual and the accessible node; it takes no pointer
   events.** `pointer-events: none` on the cell buttons puts every pointer event
   on the column while leaving each cell focusable, `aria-pressed`, and
   announced in solfège - the ring is both the playhead ring and the focus ring.
   The alternative (eight hit-target elements) would have hidden the band
   arithmetic in CSS where nothing can test it.
5. **The plate's vertical padding is owned by the column.** The handoff's
   negative-margin flush trick is kept horizontally, which is what it is for -
   the lane's columns sit flush with the drum columns above. Vertically the same
   8px lives on the column instead of the plate, because that is what lets the
   end bands reach the plate's edge; the drawn result is identical.
6. **`useDragPaint` is extended, not forked.** A lane cell is an existing cell
   address plus a pitch, and the latched add-or-remove decision, the per-pointer
   latches and the trailing-click suppression are wanted unchanged - a sibling
   hook would have been the same code with two chances to diverge. A lane column
   reports "the pointer is over this cell" with `pointermove` (its cells share
   one hit surface) where a drum cell uses `pointerenter`; re-applying a latch
   to a cell it already painted is a no-op, so the flood costs nothing. A drag
   therefore fills every cell it crosses and never line-draws or replaces.
7. **Keyboard: a lane is a second axis inside the row.** Up and down walk the
   lane before leaving it, entering the next row at the end the move came from;
   left and right keep the pitch. One model, in `useGridKeyboardNav`.
8. **Solfège is the one naming decision** (spec §7) - do, re, mi, fa, so, la,
   ti, high do, indexed from the bottom like every `pitchIndex`. The hue
   ladder's table is the only place that index is turned around.
9. **It lands dormant.** No kit entry is pitched yet (spec §11), so the lane is
   reachable in tests and in a local edit to `kit.json` only; a test flags its
   own instrument the way ticket 10 will flag the roster.

## Consequences

- A pitched row is ~4x a drum row tall, so two of them make a clip that has to
  be scrolled in the well. That is what ticket 07's collapse is for, and it is
  the cost Ed accepted with (1) - the alternative was narrowing every row.
- Two geometries now describe the lane: `PitchedLane.module.scss` draws it and
  `laneGeometry.ts` pins the arithmetic. They are mirrored deliberately, but
  only the stylesheet is authoritative at runtime (3), so a drift shows up as a
  failing unit test rather than as taps landing a note out.
- The phone (ticket 08) inherits (3), (4) and (6) but not the numbers: its
  columns are its own, and the measured bands follow whatever it draws.
- Because pointer events belong to the column, anything later that wants a
  per-cell hover or drag affordance has to go through the column too.
