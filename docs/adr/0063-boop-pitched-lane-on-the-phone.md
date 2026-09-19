# 0063 - boop: the phone's vertical axis was already paint's

- **Status:** Accepted
- **Date:** 2026-09-18
- **Related:** [ADR 0060](0060-boop-pitched-lane-geometry.md) (the geometry
  policy and the measured hit bands this inherits),
  [ADR 0061](0061-boop-collapsed-pitched-row.md) (the folded row, and the rail
  flow this re-answers on 92px), [ADR 0027](0027-boop-small-phone-layout.md)
  (the pinned rail, the snap window, and `touch-action: pan-x`),
  [ADR 0030](0030-boop-fixed-frame-one-scroller.md) /
  [ADR 0035](0035-boop-song-bar-is-the-home-surface.md) (the fixed frame and
  its nested-scroller inventory), [ADR 0042](0042-boop-dynamic-clip-rows.md)
  (playback never scrolls, on either axis).
  Implements [pitched-lane ticket 08](../../.scratch/pitched-instruments/issues/08-phone-lane.md);
  spec §2, §8, §11.

## Context

The ticket was written expecting a gesture collision: the phone's rows box
scrolls vertically, and a pitched lane wants a vertical paint drag. It carried a
tripwire - if the 8-cell lane could not be made to work without a new phone
interaction model, kick phone back to the design project.

The collision turned out not to exist. `touch-action: pan-x` on the step window
(ADR 0027 §3) hands the browser the horizontal pan and keeps **everything
vertical for us**, which is exactly what already lets a drum drag paint down
through rows. A finger that wants to scroll the rows starts on the pinned rail
beside the window, where there is no `touch-action` at all. So the lane inherits
a vertical axis that was never scroll's to begin with, and no new model is
needed.

What was genuinely new is smaller and sharper. A lane column carries the hit for
its eight tiles (ADR 0060 §3/§4), so it reports "the pointer is over this cell"
with `pointermove` rather than `pointerenter` - and `pointermove` fires on the
first pixel. On the phone `useDragPaint` runs deferred (`applyOnPointerDown:
false`), where the *first* report is what proves a press is a paint and not a
swipe. A lane therefore handed it that proof immediately, for nothing.

## Decision

1. **A report of the cell the press started on is not a crossing.**
   `useDragPaint` ignores an unlatched `onPointerEnter` naming its own origin.
   That restores ADR 0027's "a drag paints only once it crosses a cell boundary"
   for a surface that reports continuously, and it fixes a second fault the same
   path had: applying the latch to the origin twice - once as the origin, once
   as the reported cell - toggled it on and straight back off, so a finger that
   settled before it dragged lost the note it landed on. The guard is in the
   hook rather than in the lane, because it is the hook's contract.
2. **The lane column takes the click.** The tiles are `pointer-events: none`, so
   on the laptop a tap paints through `pointerdown` and the tile's own `onClick`
   only ever fires for the keyboard. Deferred, there is no `pointerdown` paint -
   so without a click handler on the column, a tap on a phone lane would do
   nothing at all. The column's handler ignores clicks whose target is not
   itself, which is how a keyboard click on a tile passes through on its way up
   without being counted twice.
3. **One row height, spent by both columns.** The phone's rail is pinned and its
   steps scroll, so they are separate trees that only line up if they agree.
   `PhoneGrid` owns `--pitched-row-height` / `--pitched-collapsed-row-height` on
   the layout, and the lane derives its tile from the first
   (`(156 - 7 x 4) / 8 = 16px`) rather than carrying a number of its own. The
   alternative - the same constant written in two stylesheets - is the drift
   ADR 0060 built measured hit bands to avoid, reappearing one level up.
   `verifyPitchedRowAligns` measures both rows anyway.
4. **156px expanded: a 16px tile on a 4px gap, 20px hit bands.** 16 on the
   phone's 32px column is the handoff's own 20-on-40 ratio, so the tile reads as
   a note rather than a bar - the same reasoning ADR 0060 used to make the
   laptop tile 24. The bands are the column's eight, measured from the rendered
   rects as before.
5. **No horizontal bleed.** The plate keeps the flush trick vertically and drops
   it sideways (`--lane-pad-x: 0`). The strip is exactly 605px and `phoneWindow.ts`'s
   snap offsets are arithmetic over that number, so a plate 8px wider each side
   would give the window scrollable width the bar lines do not know about.
6. **The chevron takes the rail's first line, beside the plate, and the name
   drops below it.** ADR 0061 put the chevron on the rail's *second* line on a
   160px rail; 92px cannot hold a 32px plate, a name and a 44px control at all,
   in any order. Plate + chevron is 83 of the 92, and the name then gets the
   rail's full width - more than it has on a drum row. The pitch key takes
   whatever the two lines leave.
   **The cost:** a folded row is 60px rather than the laptop's 64 but against a
   44px drum row, because the chevron's line plus the name's line is what the
   rail needs. The summary track fills all 60, which is a deviation from ADR
   0061 §3's "the track is boop's drum cell" - and it is what makes the pebbles
   readable, 5.7px of travel per pitch against the laptop's 4.6.
7. **No new scroller, and the inventory is now asserted.** `verifyGridScrollBoxes`
   lists the scroll boxes inside the well and pins them to exactly one, the step
   window. ADR 0030's inventory was prose; on a ticket that adds a tall thing to
   a short frame it is worth a test.

## Consequences

- Measured at 390px wide: two expanded lanes make the rows 596px of content
  against a 500px box at 844 and a 91px box at 380 - so the rows box scrolls,
  which is what it is for. Folding one lane is 500 (exactly the 844 box), both
  is 404, and the all-drum baseline is 372. The page does not scroll and clip
  play stays inside the viewport at 844, 640, 505, 420 and 380, with two lanes
  open and with both folded.
- Collapse carries the phone the way the ticket expected: a folded row gives
  back 96px, more than two drum rows.
- The origin guard is shared code, so the laptop got it too. Nothing there
  reported its own origin before, so nothing there changes - but a future hit
  surface that reports continuously now has the contract it needs.
- The lane's breakpoint sets are custom properties on `.lane` / `.summary`, one
  block per breakpoint, rather than per-property media queries. That is what
  lets the phone's block be a set of numbers instead of a second copy of the
  rules.
- 20px hit bands are the smallest in the app, and no test can tell whether they
  suit a six-year-old's finger. That is Ed's check on a real phone, and the
  tile is one constant away if it is wrong.
