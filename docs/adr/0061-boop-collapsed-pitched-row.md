# 0061 - boop: the collapsed pitched row is a read-only summary

- **Status:** Accepted
- **Date:** 2026-09-18
- **Related:** [ADR 0060](0060-boop-pitched-lane-geometry.md) (the geometry
  policy this follows, and the consequence it names),
  [ADR 0025](0025-boop-save-format.md) / [ADR 0058](0058-boop-save-format-pitches.md)
  (the save document collapse deliberately stays out of).
  Implements [pitched-lane ticket 07](../../.scratch/pitched-instruments/issues/07-collapse.md);
  spec §2, §4, §6.

## Context

A pitched row is ~220px tall, so two of them make a clip that has to be
scrolled (ADR 0060's accepted cost). The handoff answers with a ~56px summary:
pebbles positioned by pitch, a mini four-bar contour in the label column, a
44x44 chevron. It draws that on its own 40px-step, 160px-rail world and leaves
three things open on boop's: what the summary is made of, where the chevron
goes, and whether the summary can be painted on.

## Decision

1. **The summary is a picture, not a surface.** The 16 tracks are plain
   elements with no pointer handlers, no `aria-pressed` node and nothing
   focusable inside; the strip is `aria-hidden` and the chevron carries the
   row's meaning. Painting a note means expanding first. The alternative - a
   one-pixel-per-pitch tap target - would have been a second, worse paint
   surface with its own hit arithmetic to keep in step with the lane's.
2. **A pebble is placed as a fraction, not as pixels.** `laneSummary.ts`
   answers "how far down its travel does this pitch sit" (0 at the top, 1 at
   the bottom) and the stylesheet spends whatever the track has left on it, so
   the summary rescales with the column the way ADR 0060 rescaled the lane -
   one rule for 56px desktop and 50px tablet tracks alike. On the handoff's own
   56px track the formula reproduces its drawn 27px and 31px pebbles, which is
   what the unit test pins.
3. **The track is boop's drum cell, and the summary wears the lane's hue
   ladder.** Same size, radius, alternation by bar and under-playhead lift as
   the row above it, so the columns and the bars stay countable; the pebble and
   the contour bar take the hue of the pitch they stand for. The handoff's four
   "bass pebble purples" are one instrument's derived set and there is no
   per-instrument ladder in the app - the lane's own ladder is the only
   self-consistent source.
4. **The contour is the rounded mean of each bar's notes**, and an empty bar
   keeps a dim 3px stub so four bars are always countable. A mean rather than a
   peak: a chord reads where the ear puts it, and a bar's shape is what the
   contour is for.
5. **The chevron takes the rail's second line.** boop's 160px rail (124px in
   the tablet band) cannot hold a 52px art plate, a 17px instrument name and a
   44px control side by side the way the handoff's does - "Marimba" needs ~66px
   and the handoff's layout leaves 40. So the name keeps the rail's full width
   exactly as on a drum row, and the pitch key (or the contour) shares the line
   below it with the chevron. Every handoff element keeps its designed size;
   only the flow changes. **The cost:** a collapsed row is ~64px rather than
   the handoff's 56. It is still a quarter of the expanded lane, and the
   alternative was truncating instrument names in a toy for six-year-olds.
6. **Collapse is component state and nothing else** (spec §4, grill Q8). It
   lives in `Grid`, keyed by `instrumentId`; rows open expanded, a reload opens
   them all, and `saveFormat.ts` never learns the word. Persisting it is an
   additive change later if it is ever wanted (spec §10).
7. **Arrow keys step over a folded row.** A collapsed row has nothing to focus,
   so `useGridKeyboardNav` now walks on in the move's direction until a row
   answers rather than stranding the cursor. This also retires the old
   clamp-to-self at the grid's top and bottom edge, which silently wrapped an
   arrow at the end of a lane to the other end of the same lane.

## Consequences

- Two renderings of one row now read the same masks. They share the step-group
  geometry (`stepGroups` in `PitchedLane.tsx`) so a column cannot line up in
  one view and not the other.
- The collapsed row is the only place a pitched row is taller than the handoff
  says. If the rail ever gets wider, (5) is the first thing to revisit.
- The phone (ticket 08) inherits (1), (2) and (6) but not the numbers - its
  tracks are its own, and the fraction follows whatever it draws.
- It lands dormant with the rest of the lane (spec §11): no kit entry is
  pitched, so nothing in the shipped app renders a chevron.

## Amendment (2026-09-18): read-only is about painting, and a tap opens the row

[Ticket 12](../../.scratch/pitched-instruments/issues/12-tap-a-folded-row-to-open-it.md).
Decision 1 made the summary inert, which left the 44x44 chevron the only way
back into a folded row. Ed, watching the phone lane, called that wrong: a
six-year-old who wants their marimba back taps the row, not a small control in
the rail. The inertness was reasoning about *painting*, and it still holds
there; it over-reached into *opening*.

1. **A tap anywhere on the summary expands the row**, at every breakpoint -
   the folded row is one component and one rule. **Expand only: nothing is
   painted.** A folded row is ~64px tall (60 on the phone), so its eight
   pitches would be ~8px bands aimed at blind; painting on that tap was
   considered and rejected. Once the row is open the lane's own gestures take
   over unchanged, so decision 1's "a one-pixel-per-pitch tap target would be
   a second, worse paint surface" is untouched.
2. **It is an `onClick`, never a `pointerdown`.** On the phone a horizontal pan
   of the step window begins with a press on whatever is under the finger; the
   browser claims it (`touch-action: pan-x`, ADR 0027 §3), cancels the pointer
   and fires no click. Expanding on the press would open a row every time a
   child reached for bar 3. This is ADR 0063 §1's trap one level up - the lane
   found it in the paint latch, the folded row meets it in the tap - and it is
   pinned by a test that plays the pan the browser actually delivers: moves,
   then `pointercancel`.
3. **The chevron is still the only control.** The summary keeps `aria-hidden`
   and nothing focusable inside it, so the tap adds no tab stop, no second
   announcement and no duplicate accessible name; `aria-expanded` and
   "Expand/Collapse the <name> row" stay where they were. A keyboard or screen
   reader user's path through a folded row is exactly what it was, decision 7's
   arrow-key step-over included.
