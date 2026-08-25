# 0033 — boop's laptop column is sized to fit 1280, not to the handoff's 1356

- **Status:** Accepted
- **Date:** 2026-08-17
- **Related:** [ADR 0030](0030-boop-fixed-frame-one-scroller.md) (the fixed
  frame and its two nested scrollers, which is what made this visible), the
  clip-lanes handoff
  ([`docs/reference/design_handoff_clip_lanes/README.md`](../reference/design_handoff_clip_lanes/README.md),
  §5 and the token list, amended here), and the main-screen handoff
  ([`docs/reference/boop-design/README.md`](../reference/boop-design/README.md),
  "Cell geometry and state", amended here).

## Context

The laptop number set starts at 1280px — below that the tablet set applies and
its lane grid flexes to any width. But the laptop set was never able to fit
1280. Its column is a chain of fixed pixel values: rail 160 + railGap 18 +
steps 1142 + the well's 2×18 padding = the `--column-width` 1356px token, and
the frame adds 36px of padding on each side. That wants a **1420px viewport**.

Nothing surfaced it until ticket 23 gave the grid well and the lane grid their
own scroll boxes so the two play buttons could stay pinned. Before that the
overflow was absorbed by the scrolling region; afterwards `.wellScroll` and
`.lanes` each grew a horizontal scrollbar, on every window from 1280 to 1419.
Measured on a fresh one-clip page: at 1280 the well needed 1328px of inner
width and had 1188.

Padding alone cannot close it. At zero frame padding the laptop grid still
needs 1348px, so 1280–1347 would keep scrolling. Either the breakpoint moves
up to meet the numbers, or the numbers come down to meet the breakpoint.

## Decision

**The numbers come down.** 52px cells (was 62), which is the largest cell whose
column clears 1280:

| | Was | Now |
| --- | --- | --- |
| Laptop cell | 62 × 66, radius 14, artwork 35 | 52 × 56, radius 12, artwork 30 |
| Bar numeral (4 cells + 3 gaps) | 272 | 232 |
| `--column-width` | 1356 | **1196** |
| Frame padding ≥1280 | 36 | 32 |
| Lane square | 56 × 46 | 44 × 46 |
| Ruler numeral | 56 | 44 |

The column now needs a 1260px viewport, so the whole ≥1280 band fits with room
to spare, and no window at any width scrolls sideways.

**Why not move the breakpoint to 1420 instead.** That was the alternative, and
it is a bigger change dressed as a smaller one: it hands every 1280–1419
screen — most laptops — the tablet layout, which exists for a narrower frame
and shrinks its lane grid to fit. Keeping the laptop frame and making it
actually fit the width it claims is the smaller lie.

**The lane squares had to move with the cells.** They are a fixed 56px at
≥1280, sized to the old column. Shrinking the grid without shrinking them would
have swapped a scrolling grid well for a scrolling song bar. 44px is what fits
the lane row inside 1196 (chip 176 + gap 8 + 16 squares + 15×8 gaps), and their
height and radius are untouched, so the chip row's rhythm is unchanged.

## Consequences

- The handoff's `--column-width 1356px`, its 62px cell and its 56px lane square
  and ruler numeral are superseded by the table above. The handoff documents
  are left as the design record; this ADR is the amendment.
- The playhead column's `left`/`width` are derived from the cell and gap
  constants and were recomputed with them — they are duplicated in
  `Grid.module.scss` rather than tokenised, so any future cell change has to
  touch both.
- Six 56px rows plus the pinned clip-play footer still exceed the region on a
  800px-tall window, so the well keeps scrolling vertically there. That is
  ADR 0030's design and unchanged by this — the shorter rows only raise the
  height at which all six fit.
- `verifyCellGeometry(52, 56)` in `playBarPinned.iwft.tsx` is what pins the new
  cell; the lane grid's fit is already pinned by
  `verifyLaneGridFitsColumn`'s flush-content-edge assertion at tablet widths.
