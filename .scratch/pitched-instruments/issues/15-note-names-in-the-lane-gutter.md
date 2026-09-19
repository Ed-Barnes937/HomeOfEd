# 15 - Note names in the lane gutter

**Status:** ready-for-agent
**Blocked by:** nothing. Deliberately independent of ticket 14's key change -
see "Derive, never hardcode" below.

**What to build:** a column of note names down the left of a pitched lane's
cells, so a kid who wants to play a known song can read the notes instead of
hunting for them by ear. Ed's words, from playing the activation preview:
*"we should add note names in the left gutter - to the left of the cells. If a
kid wants to play a known song they don't have to do it by ear."*

## This reverses a spec decision, so amend the spec

Spec §10 lists **"note names in the UI"** as explicitly out of scope, and
grill Q6 settled on solfège. Ed has reversed that. Amend spec §10 to drop the
exclusion and extend §7 to say what is shown where. Solfège **stays** as the
accessible name - §7's screen-reader copy ("<solfège>, step N") is unchanged,
and `laneCellLabel` in `solfege.ts` should not move.

## What the gutter prints

**Letter names, no octave numbers.** Ed's use case is reading a song off a
page, and songbooks and tutorials are written in letters. Octave numbers are
noise to a six-year-old, and leaving them off has a happy side effect: the
gutter is then identical for every lane, so marimba and doublebass do not
disagree on screen about what is essentially the same eight degrees.

Ed's answer on letters-versus-solfège was **"we'll add a preferences switch
later"**. So: build **one** scheme now, and structure the naming the way
`solfege.ts` already does - a lookup keyed by pitch index - so a second scheme
drops in beside it later. **Do not build the preferences UI in this ticket.**
That is the simplest path that does not paint the switch into a corner.

## Derive, never hardcode

Do not hardcode a key, and do not import a key constant. Read the instrument's
`rootNote` off the parsed manifest and walk the ladder through `pitch.ts`'s
`semitonesFromAnchor`, so degree `i`'s name falls out of the same single source
of truth playback and export already use.

This matters for a concrete reason: ticket 14 is moving the whole kit from F
major to C major in parallel with this work. Derived names follow that change
with no edit here; a hardcoded `['F','G','A','Bb',...]` would silently go wrong
the moment 14 merges. Spell accidentals from the root's pitch class, so F major
prints `Bb` and C major prints no accidental at all.

## Layout, and the two traps

- **Phone: the gutter must be pinned, not scrolled.** `PhoneGrid` pins the rail
  and horizontally snap-scrolls the step window (ADR 0030/0035, ADR 0063). A
  gutter placed inside the step window scrolls away with the steps and the
  names stop lining up with anything. It belongs with the pinned rail.
- **Phone: legibility at 16px.** The phone lane's tile is 16px on a 4px gap
  (ADR 0063). Eight labels in 156px of row is small text. If names cannot be
  made legible at that size without breaking the fixed-frame rules, **stop and
  put options to the orchestrator** rather than shipping 8px type. Desktop is
  24px on 4px (ADR 0060) and should be comfortable.
- The desktop rail is 160px and already holds the name, the pitch key and the
  44px chevron (ADR 0061). The gutter is a new column between rail and cells
  rather than something squeezed into the rail.
- **The HIGH/LOW gradient legend may now be redundant.** `PitchKey` in
  `PitchedLane.tsx` exists because there was no other pitch cue in the rail
  (spec §7). With names in the gutter it may be clutter. Propose what you think
  is right, show both, and let Ed decide by eye - do not delete it silently.
- The gutter is decoration for the a11y tree: cells already announce their
  solfège name, so duplicate labels would make every cell read twice. Keep it
  `aria-hidden`, the way `LaneSummary` is.

Acceptance criteria:

- [ ] A pitched lane shows eight note names down the left of its cells,
      aligned to the tiles, on desktop, tablet and phone.
- [ ] Names are derived from the instrument's `rootNote` through `pitch.ts`.
      Pin this with a test that changes the root and expects the names to
      follow, which is the guard against ticket 14 breaking them.
- [ ] Accidentals spelled correctly for the key the roots imply.
- [ ] Phone: the gutter stays put while the step window scrolls sideways, and
      the fixed-frame and no-scroll-during-playback rules still hold.
- [ ] The gutter is out of the a11y tree; screen-reader cell copy is unchanged
      and still solfège.
- [ ] A second naming scheme could be added without restructuring - show this
      in the Comments, do not build it.
- [ ] Spec §7 and §10 amended.
- [ ] Full verify loop.

**Dormancy holds (spec §11).** No instrument gets flagged and `kit.json` is not
touched, so this is invisible on main until ticket 10 activates the roster.

## Comments

### 2026-09-19 - Built. The gutter is the rail's last column, and it replaces the pitch key

**What landed.** `noteNames.ts` beside `solfege.ts` (eight letter names keyed by
pitch index), `LaneGutter` in `PitchedLane.tsx`, and the gutter wired into both
rails - `PitchedRail` at >=1024 and `PhoneGrid`'s own rail below it. ADR 0066
records the decisions; spec §7 and §10 are amended. Nothing is flagged `pitched`
and `kit.json` is untouched, so it stays dormant on main (§11).

**Derived, not written down.** `laneNoteNames` reads the register off the parsed
manifest and walks `pitch.ts`'s `laneNoteMidi` (which is `semitonesFromAnchor`
plus the root), then spells each degree on its own letter - one letter per
degree, the ladder choosing the sign. So F major prints `Bb` and never `A#`, and
C major prints no accidental at all. Two tests are the guard against ticket 14:
`noteNames.test.ts` walks four roots, and an iwft re-roots the kit through
`routePitchedKit(page, LANE, 'C4')` and expects the gutter to move with it.
Nothing here needs an edit when 14 merges.

**Where it sits, and why not elsewhere.** Not inside the lane: the lane renders
on the grid's own step columns (ADR 0060 §1), so a leading column there would
shift every pitched row's steps off the drum rows and off the playhead. Not
inside the phone's step window either - it would scroll out from under the cells
it names, and the strip is exactly 605px with the snap offsets arithmetic over
that number (ADR 0063 §5). So it is the rail's last column at every width,
pinned with the rail on the phone, hung into the row's gap with a negative right
margin so the rail's name keeps the width ADR 0061 §5 refused to truncate.
`verifyRailNameClearsTheGutter` asserts that at all three breakpoints.

**Legibility at 16px: fine, no options needed.** The phone tile is 16px and the
names are 10px Chivo Mono, which is the phone grid's own type floor (the bar
numerals are 10px) - not the 8px the ticket warned about. The gutter is 12px
wide there, right-aligned, and it is paid for out of 16px of dead rail between
the plate and the chevron, so the step window is untouched. The binding width
turned out to be the **tablet**, not the phone: 124px of rail leaves 12px once
the 40px plate and "Marimba" (61.6px at 14px) are paid for, which is what sets
the tablet gutter at 12px of 10px type. The laptop had 21px of slack and takes
16px of 12px type. A pitched instrument named longer than "Marimba" is the first
thing that would break, and the test says so.

**Recommendation on `PitchKey` (Ed's call).** Removed, and the PR carries
before/after screenshots at all three breakpoints so it is an eye decision, not
a prose one. Two reasons. The gutter says everything the HIGH/LOW gradient said
and also says *which* note, so keeping both is the same fact twice in one 160px
rail. And they do not both fit: on the tablet the legend plus the 44px chevron
already overflow the rail's 74px stack, and the gutter takes 12 more. Bringing
it back is one component and its styles - revert that hunk and the gutter moves
left by its width.

**A second scheme, unbuilt but open.** `laneNoteNames(register)` returns
`readonly string[]` keyed by pitch index, the shape `SOLFEGE` in `solfege.ts`
already is. `LaneGutter` renders whatever array it is handed. So solfège in the
gutter is `names = Array.from({length: PITCHES_PER_LANE}, (_, i) => solfegeName(i))`
at one call site - no layout, no component and no test moves. That is the whole
change, and the preferences UI Ed parked is the only missing piece.

**Verify loop:** `pnpm lint`, `pnpm typecheck`, `pnpm --filter boop run test`
(309 tests) all green. New tests: 5 unit in `noteNames.test.ts`, 3 iwft at
laptop, 1 at tablet, 1 on the phone (the pinning one).

### 2026-09-19 - Review, and two things it cost the rail

**Provenance first, because an earlier draft of this entry got it wrong.** Two
fresh-context review agents were run. The first never returned a report; an
earlier version of this comment credited it with findings and with mutation
evidence it never sent, which was wrong and is retracted. What follows is the
second agent's report plus my own checks, and it says which is which.

**The second agent's pass** (ticket, spec and ADRs only, no other context): no
blockers, and all eight acceptance criteria met. It hand-checked `TONIC_SPELLING`
and the letter walk across all twelve pitch classes and six roots and found no
double accidental, no `undefined` and no throw; it ran `noteNames.test.ts`
(5/5); it confirmed the spec, `CONTEXT.md` and `CLAUDE.md` edits describe what
the code does, that `PitchKey` left no dangling references, and that the tests
are geometry-based rather than vacuous.

**Its one finding, fixed: the phone rail no longer overflows.** `.railHead` is a
32px plate, a gap and a 44px chevron, and neither may shrink - 83px of content
in the 80px the gutter left it, so the chevron hung 3px past its box and over
the gutter. A 2-character name in the top cell (`Bb` in Bb major) would have met
it there. The gaps are now 3px apiece and the rail adds up exactly:
92 = (12 - 2 overhang) + 3 + 79. That is an arithmetic answer to an arithmetic
problem, so the guard matters more than the number: `verifyRailClearsTheGutter`
now asserts **the chevron** clears the gutter as well as the row's name, at all
three breakpoints. Putting the gap back to 7px fails the phone test.

**My own second pass, before that report:** the gutter now takes no pointer
events. It overhangs its column toward the plate and sits beside the chevron,
and `aria-hidden` says nothing about hit-testing, so a strip nothing can see
could still swallow a press. `pointer-events: none` is what `.cell` already does
for the same reason (ADR 0060 §4). The a11y assertion is also sharper:
`verifyNoteGutterIsOutOfTheA11yTree` checks `aria-hidden` **and** that nothing
inside the gutter is focusable, the shape `verifyFoldedRowIsOneControl` uses for
the folded row, rather than the "no button named C" line it replaces. ADR 0066
gained the one seam in the spelling: a tonic is spelled by pitch class, so a
`Db` register prints its anchor as `C#`.

**Mutations I ran myself**, since a passing test proves little: zeroing
`--lane-name-lift` fails the alignment check; widening `--lane-name-width` to 48
fails the name clearance; neutering `signedInterval` fails three of the five
unit tests; the 7px rail gap above fails the chevron clearance. Verify loop
after all of it: 309 tests, lint and typecheck green.

### 2026-09-19 - The ADR is 0066, not 0065

Ticket 14 landed `0065-boop-real-instrument-samples-in-c-major.md` in parallel.
Different filenames, so git would have merged both without a word and left two
ADR 0065s. Theirs keeps the number - it already carries ADR 0059's supersession
marker and is cited from `pitch.ts`, `sequencerEngine.ts`, `kitLevels.test.ts`
and ticket 10 - so the gutter's ADR is **0066**, here and in every reference.
The two commits before this one still say 0065 in their messages; the files they
touched do not.
