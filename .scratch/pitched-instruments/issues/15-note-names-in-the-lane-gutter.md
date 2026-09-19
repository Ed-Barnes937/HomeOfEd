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
