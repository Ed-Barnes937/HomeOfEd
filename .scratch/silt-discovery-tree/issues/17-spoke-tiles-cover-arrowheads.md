# 17 - Product tiles overlap the outward arrowhead on the ring's lower half

**Status:** needs-triage
**Type:** task
**Blocked by:** 09 (same drawing pass; whatever 09 does to spoke layout decides
where the tiles can go)
**Source:** found during ticket 10 (2026-09-04) - both of 10's review passes
independently flagged it. Pre-existing, not a regression from 10.
**Spec:** [../spec.md](../spec.md) §6.

The `.spokeTiles` row hangs a fixed 10-28px *below* the label point regardless
of spoke direction, so on downward-pointing spokes the tiles sit on top of the
outward arrowhead. Ticket 10 moved the *words* clear at every angle and pinned
(in `ringGeometry.test.ts`) that the tiles never get closer to a head than the
six o'clock spoke has always held them - but the overlap itself remains, and
is most visible on mobile where the words are hidden and the tiles are all
that is drawn.

## Design (sketch)

Give the tiles a side of their own, like the words got: place them relative to
the spoke's direction (above the label point on downward spokes, below on
upward ones), or fold them into whatever spoke layout ticket 09 lands. This is
a change to how the panel draws the tiles, not to `labelPoint` - the geometry
module already exposes everything needed.

## Tests

- ringGeometry or panel-level: at every spoke angle, the tiles' box does not
  intersect the arrowhead polygon.
- Mobile iwft screenshot check on a downward spoke.
