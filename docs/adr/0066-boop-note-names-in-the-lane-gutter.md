# 0066 - boop: the note gutter is the pitch key

- **Status:** Accepted
- **Date:** 2026-09-19
- **Related:** [ADR 0060](0060-boop-pitched-lane-geometry.md) (the tile ladder
  the gutter has to line up with),
  [ADR 0061](0061-boop-collapsed-pitched-row.md) (the rail flow this re-answers,
  and §5's "never truncate a name"),
  [ADR 0063](0063-boop-pitched-lane-on-the-phone.md) (the pinned rail and the
  snap window the gutter must not join),
  [ADR 0030](0030-boop-fixed-frame-one-scroller.md) /
  [ADR 0035](0035-boop-song-bar-is-the-home-surface.md) (the fixed frame),
  [ADR 0059](0059-boop-pitched-lane-is-in-f-major.md) (the key these names are
  derived from rather than repeating).
  Implements [pitched-lane ticket 15](../../.scratch/pitched-instruments/issues/15-note-names-in-the-lane-gutter.md);
  spec §7, §10, §11.

## Context

Spec §10 ruled note names out of the UI and grill Q6 settled on solfège. Ed
reversed that watching the activation preview: a child who wants to play a known
song should be able to read its notes instead of hunting for them by ear, and
songbooks are written in letters. So the lane needs a column of names beside its
cells, and the spec needs amending to say so.

Two things make that more than a label. The names have to survive a key change -
ticket 14 is re-rooting the whole kit in parallel - and the column has to line up
with the tiles at three breakpoints, one of which pins the rail and scrolls the
steps out from under it.

## Decision

1. **Every name is derived, and nothing writes a key down.** `noteNames.ts`
   walks `pitch.ts`'s ladder from the instrument's own `rootNote`
   (`laneNoteMidi`), so the manifest chooses the key and the gutter follows.
   A hardcoded `['F','G','A','Bb',...]` would have gone quietly wrong the moment
   ticket 14 merged; an iwft re-roots the kit and expects the names to move,
   which is the guard rather than the hope.
2. **Letter names, no octave numbers.** Ed's use case is reading a song off a
   page. Dropping the octave also makes the gutter identical for every lane, so
   marimba and bass do not disagree on screen about what is the same eight
   degrees. Accidentals are spelled by walking the letters - one letter per
   degree, the ladder choosing the sign - so F major prints `Bb` and never `A#`.
3. **The gutter is the rail's last column, hung into the gap.** It cannot go
   inside the lane: the lane sits on the grid's own step columns (ADR 0060 §1)
   and a leading column there would shift every pitched row's steps off the drum
   rows and off the playhead. So it is a column at the rail's edge, with a
   negative right margin into the row's gap and a negative left margin against
   the rail's own, which is what keeps the rail's name at the width ADR 0061 §5
   refused to truncate. `verifyRailNameClearsTheGutter` asserts that at every
   breakpoint rather than leaving it to arithmetic in a comment.
4. **The gutter replaces the HIGH/LOW gradient legend.** The legend exists
   because there was no other pitch cue in the rail (spec §7). Named notes say
   both what the legend said and which note it is, so keeping both is clutter -
   and on the tablet's 124px rail they do not fit together at all. **Ed's eye
   gates this one:** the legend is one component and its styles, and the before
   and after are screenshotted at all three breakpoints on the PR.
5. **It is decoration for the a11y tree.** `aria-hidden`, the way `LaneSummary`
   is. Every cell already announces its solfège name, so labels here would read
   each cell twice. Solfège stays the spoken name and `laneCellLabel` does not
   move: §7's two naming schemes now have two jobs - one is read, one is heard.
6. **One scheme is built, and a second is an array.** `laneNoteNames` returns
   eight names keyed by pitch index, the shape `solfege.ts` already has, and
   `LaneGutter` renders whatever it is handed. A preferences switch later picks
   the array; no layout, no component and no test moves for it. Ed's ruling was
   "we'll add a preferences switch later", so the door is open and the switch is
   not built.

## Consequences

- The tablet band is the binding width, not the phone: its 124px rail leaves
  12px once the plate and "Marimba" have been paid for, which is what sets the
  tablet gutter at 12px of 10px type. The phone had 16px of dead rail between
  the plate and the chevron and the laptop had 21px of slack, so both are
  comfortable. A pitched instrument with a name longer than "Marimba" would be
  the first thing to break, and the test says so out loud.
- All twelve keys come out as clean single-accidental scales, with one seam: the
  tonic's spelling is chosen by pitch class, not by how the manifest wrote the
  root. A `Db` register therefore prints its anchor as `C#`. Same note, other
  spelling, and the only fix would be a rule about which enharmonic a register
  meant - not worth it for a kit whose roots are ours to choose.
- The phone's rail is two columns now rather than three stacked lines. The
  gutter is pinned with the rail because a gutter inside the step window would
  scroll away from the cells it names, and because the strip is exactly 605px
  and the snap offsets are arithmetic over that number (ADR 0063 §5).
- `--lane-cell-height` / `--lane-cell-gap` are a mixin shared by the lane and
  the gutter. Two trees, one set of numbers - ADR 0063 §3's rule, one level up.
- It lands dormant with the rest of the lane (spec §11): no kit entry is
  pitched, so nothing in the shipped app renders a gutter.
