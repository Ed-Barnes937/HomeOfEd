# 0034 — boop's song play button is the song grid's header at every width

- **Status:** Accepted
- **Date:** 2026-08-22
- **Related:** [ADR 0030](0030-boop-fixed-frame-one-scroller.md) (the fixed
  frame, the capped dock and the lane grid's scroll box — all three of the
  problems here surfaced in that box),
  [ADR 0033](0033-boop-laptop-column-fits-its-breakpoint.md) (the column and
  lane-square sizes this builds on), and the clip-lanes handoff
  ([`docs/reference/design_handoff_clip_lanes/README.md`](../reference/design_handoff_clip_lanes/README.md),
  §5 "Song play column", amended here).

## Context

Three reports from the repo owner, one cause between them.

1. **A vertical scrollbar started a horizontal one.** At ≥1280 the lane grid is
   a fixed 1008px inside a 1020px box — 12px of slack. On macOS with "always
   show scroll bars", the lane grid's own vertical scrollbar (it gained that
   axis with the dock cap) takes ~15px of that box, so the row no longer fits
   and a horizontal scrollbar appears under it. Chromium's overlay scrollbars
   mean no CT viewport could ever reproduce it.
2. **The band from 1024 to 1279 compressed the squares to their 20px floor**,
   however much room the row had. The squares are `flex` there, but `.lanes`
   was `flex: 0 1 auto`, so the box took its *content's minimum* width rather
   than the row's — the squares then shared out that minimum.
3. **The song play button was in two different places.** A play *column* down
   the left of the laptop lane grid; the header row on the phone.

## Decision

**Song play leads the song bar's header at every width** — the phone bar's
arrangement, made the only arrangement. The play column and its `Song`/`Stop`
label are gone; the header grows from 64px to 72px for the 56px circle plus
8px of air.

That is also the fix for the other two, because the column was 93px of the
lane grid's width (56 circle + 18 gap + 1px divider + 18 gap):

- The lane grid gets those 93px. `.lanes` becomes `flex: 1` so it takes the
  row's width instead of its content's minimum, and carries
  `scrollbar-gutter: stable` so a space-taking vertical scrollbar changes
  nothing about the row's width.
- On the tablet band the flexible parts turn one-directional: lane squares and
  ruler numerals are `flex: 0 1 44px` and the song strip's track
  `flex: 0 1 824px`. They shrink towards the 20px floor where 16 × 44px does
  not fit — 1024 to about 1150 — and sit at the laptop's own 44px where it
  does, rather than growing past it.

**Why not just add slack for the scrollbar.** Reserving the gutter alone leaves
the ≥1280 lane grid with 12px less than it needs, which trades a sideways
scroll for a clipped row. The width had to come from somewhere, and the play
column was the only thing in that row that was not the grid.

## Consequences

- The handoff's §5 "Song play column" is superseded: the button keeps its 56px
  circle, its shadows and its playing flip, and loses its column, its 24px
  offset and its label. `aria-label` was always what named it.
- The dock's cap floor drops with the change. The song bar's irreducible height
  was 193px (14 margin + 64 header + 14 body padding + the 101px `flex: none`
  play column); it is now 100px (14 + 72 + 14), because the lane grid under the
  header shrinks to nothing. `max-height: max(32dvh, 100px)` — measured at 1280
  from 600px tall down to 420, and the page scrolls at none of them.
- `verifyLaneGridFitsColumn` no longer asserts the squares are flush with the
  content edge at every tablet width — flush is now the narrow end only, so it
  takes an `expectFlush` flag, exercised at 1024. Its other half (all 16 equal,
  never past the content edge, ≤44px) holds at every width in the band.
- `verifyLaneGridClearsAClassicScrollbar` pins report 1 as the slack a 15px bar
  would need, since CT's browser cannot draw one.
