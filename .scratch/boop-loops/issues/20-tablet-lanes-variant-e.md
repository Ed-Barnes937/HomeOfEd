# 20 — Tablet lanes (variant E)

**What to build:** Between 1024px and 1279px the whole clip-lanes experience
works with no sideways scroll anywhere: the laptop song bar, pinned as
designed, but the lane grid **shrinks to fit the column** instead of
scrolling. Squares turn flexible (`flex: 1` with a min-width floor), chips
narrow to 128px, ruler numerals compress with the squares. Everything else
follows the laptop design. Reference shape: the `prototype/04-small-screen-lanes`
branch.

Spec: §4 (tablet).

**Blocked by:** 15 — Laptop clip lanes.

**Status:** ready-for-human

- [x] At 1024–1279px the song bar stays pinned and the lane grid fits the column with flexible squares and 128px chips
- [x] No horizontal scrolling anywhere at this width; the grid region remains the only scroller (ADR 0030)
- [x] All laptop behaviours (placements, clip management, playback rings) work unchanged at this width, covered by `*.iwft` at a tablet viewport

Done: the clip-lanes chrome now renders for every non-phone width (`useIsPhone`
alone picks the layout; `useIsLaptop.ts` deleted), with a
`@media (max-width: 1279px)` block in `SongBar.module.scss` doing variant E's
shrink — flexible squares/numerals (20px floor), 128px chips. Covered by
`tabletLanes.iwft.tsx` at 1100×800.

Remaining for a human: an eyeball pass at a tablet width (resize to
~1024–1279px) — the numbers are tested, the feel is not.
