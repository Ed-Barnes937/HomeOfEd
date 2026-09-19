# 13 - Swapping a pitched row keeps its melody

**Status:** ready-for-human
**Blocked by:** nothing - the defect is on main today, dormant

**This is a defect in the epic's own work, not a new feature.** Found by Ed
playing the activation preview: swap a pitched row's instrument and the melody
flattens into a monotone line across the middle of the lane.

`song.ts:406` rebuilds the swapped row as `{ instrumentId, steps: row.steps }`.
It carries `steps` and **silently drops `pitches`**. Every surviving on-step
then reads as `ANCHOR_PITCH_INDEX` through the anchor rule, so a kid who
paints a tune on marimba and swaps to piano to hear it on piano gets their
tune replaced by sixteen notes at "so".

The line was correct when it was written - `f336f20` predates `pitches`
existing. Tickets 02/03 added the field and updated `mergeRows` (`song.ts:235`
handles both rows' pitches properly) but not this call site. `mergeRows` is
the in-repo precedent for the shape the fix should take; follow it rather than
inventing a second convention.

**What to build.** A swap between two pitched instruments carries `pitches`
across unchanged. Ed's ruling, given with the report: *"we should either keep
the chosen cells or clear the grid for that instrument if that's easier"* -
keeping is both easier and better, so keep.

The three other swap directions are already correct and must stay that way:

- **pitched -> one-note:** dropping `pitches` is right. A drum has no lane, and
  the field is defined absent on a one-note row (`sequencerEngine.ts:182`).
- **one-note -> pitched:** there are no pitches to carry. The row arrives with
  the field absent and every on-step reads as the anchor, which is the
  documented meaning of a pitched row that has never been painted.
- **one-note -> one-note:** untouched.

Both lanes are the same eight degrees regardless of instrument, so carrying
`pitchIndex` values straight across is meaningful: degree 3 on marimba and
degree 3 on piano are the same scale degree, three octaves apart or not. There
is no transposition to do here. Do not invent one.

**Watch for the same bug elsewhere.** `swapRowInstrument` is the one call site
found, but sweep the row-rebuilding paths in `song.ts` (`addRow`, clip
duplication, decode fallback, `mergeRows`) and confirm each either carries
`pitches` or drops it deliberately. Note in the Comments what you checked, so
ticket 10 does not have to re-check.

Acceptance criteria:

- [x] Swapping a pitched instrument for another pitched instrument preserves
      every painted note at its own degree, chords included.
- [x] Swapping a pitched instrument for a one-note one drops `pitches`, and
      the resulting row is byte-identical in `saveFormat` to a row that never
      had pitches (spec §3's guarantee reaches this path too).
- [x] Swapping a one-note instrument for a pitched one yields a row with
      `pitches` absent, whose on-steps sound the root sample untransposed.
- [x] An iwft covering the swap through the UI, since the flattening is only
      visible as a lane: paint a contour, swap, see the contour survive.
- [x] The other row-rebuilding paths are audited and the finding recorded.
- [x] Full verify loop.

**Dormancy holds (spec §11).** Nothing here flags an instrument or touches
`kit.json`. The defect is unreachable on main until ticket 10 activates the
roster, which is the only reason it is not urgent - but it must land **before**
activation, or the first kid to browse instruments by ear loses their tune.

## Comments

**2026-09-19 - built. Status: ready-for-human (Ed's play check below).**

`swapRowInstrument` now looks the target instrument up rather than merely
asking whether the roster has it, and hands the row to a five-line
`swappedRow`. The rule is one line: `pitches` travels iff the new instrument
plays a lane. That is not three cases with a shared branch - it is one
predicate that happens to give the right answer in all four directions,
because a row arriving from a one-note instrument has no `pitches` to carry in
the first place. The masks go across untouched: degree 3 is degree 3 on either
lane (ADR 0059's ladder is the same shape in any register), so there is no
transposition, and pitch is still read only through `pitch.ts`.

`rosterHas` was kept, expressed as `rosterInstrument(...) !== undefined`, so
`addRow`'s guard reads the same as it did.

**Mutation-checked.** With the carrying branch deleted - the exact line that
was on main - the new iwft fails at the first note, `verifyNoteOn('bell', 0,
0)` reading `data-active="false"`, and the two direction-guard unit tests stay
green. So the tests pin the defect and not merely the shape of the code.

**What the tests are.** Three unit cases in `song.test.ts` under a new
`across a lane` describe, over a `pitchedRoster` that flags `marimba` and adds
a pitched `bell` (nothing on main is pitched - spec §11 - so a swap between
two lanes has to make its own pair). The pitched-to-one-note case asserts
through `patternToStored`, which is the byte-identity criterion said in the
form the save format actually writes. Three iwfts at the bottom of
`pitchedLane.iwft.tsx`, because the flattening is only visible as a lane: a
contour of a low note, a two-note chord and a high one survives
marimba -> bell, and each of the three on steps is asserted *absent* at the
anchor, which is the flattening's signature. The lane -> drum test reads the
autosaved row back out of `localStorage` and expects exactly
`{ instrumentId, steps }` - no `pitches` key.

**The audit ticket 10 does not have to redo.** Every path that constructs a
`PatternRow` rather than passing one through:

| Path | `pitches` | Verdict |
| --- | --- | --- |
| `song.ts` `mergeRows` | unioned via `rowPitchMasks` | correct - the precedent this fix followed |
| `song.ts` `swapRowInstrument` | was dropped | **the defect; fixed** |
| `song.ts` `addRow` | omitted | correct - a fresh row has nothing painted, and the field is absent until a note is |
| `saveFormat.ts` `rowToStored` | branches on presence, derives `steps` from it | correct |
| `saveFormat.ts` `storedToPattern` (incl. the all-rows-dropped fallback) | kept absent when the document has none; the fallback is `blankPattern` | correct |
| `sequencerEngine.ts` `blankPattern` | omitted | correct - same reason as `addRow` |
| `createSequencerEngine.ts` `getPattern` | spread in only when the engine row holds notes | correct - the engine keeps `pitches: null` internally and the boundary is where absence is restored, which is what keeps a fresh engine's grid equal to `blankPattern` |
| `HomePage.tsx` `clearedPattern` ("Clear grid") | dropped | correct *and deliberate*: no on steps means no notes, and absent is the canonical form for that |
| `sampleClips.ts` `samplePattern` | dropped | correct today - see the watch-item below |
| `HomePage.tsx` `copyClip`, `withActivePattern`, `addClip`, `deleteClip`, `renameClip`, `moveClip`, `removeRow`, `singleClipSong` | pattern passed by reference | nothing rebuilt, nothing to lose |

`export/`, `share/` and `songConductor.ts` construct no rows at all; they take
patterns whole or go through `saveFormat.ts`.

**One watch-item for ticket 10.** `samplePattern` rebuilds a sample clip's
rows as `{ instrumentId, steps }` off `blankPattern`, matched by position. That
is right while every authored sample clip is step-only, which they all are. If
activation ever gives a sample clip a melody - a "Twinkle" starter, say - that
line drops it the same way this one did, and `SampleRowSteps` would need a
notes field first. Nothing to do now; it is a trap with a trigger, not a bug.

**Dormancy holds.** No manifest entry is flagged, `kit.json` is untouched, and
the two test kits that flag anything are a page-level `page.route` patch and a
literal in a unit test. The shipped roster has no lane, so this changes nothing
a child can reach until ticket 10.

**Verify loop:** `pnpm lint`, `pnpm typecheck`, `pnpm --filter boop run test`
all green - 613 unit, 307 iwft.

**For Ed, by hand, and only after ticket 10 activates the roster:** paint a
tune on marimba, open the picker from the rail, and tap through two or three
other lane instruments by ear. The tune should stay put at its own degrees each
time, and tapping a drum should leave the rhythm with the notes gone rather
than a row of mid-lane notes.

**2026-09-19 - fresh-context review round.**

Nothing blocking, and the reviewer re-ran the mutation check independently
rather than taking the claim on trust. It went further than I did, with three
mutations rather than one: deleting the carrying branch (the iwft and the
pitched-to-pitched unit test go red), dropping the target-pitched check so the
predicate is `!row.pitches` alone (the byte-identity test goes red), and
flipping the `||` to `&&` (the same test goes red). So each half of the
predicate is pinned by a test, not just the branch as a whole.

**One real find, and it was in the audit rather than the code.** The table
claimed to cover every path that constructs a `PatternRow`, and it missed
`createSequencerEngine`'s `getPattern`, which spreads `pitches` in only when
the engine row holds notes. That is correct - the engine stores `pitches: null`
internally and `getPattern` is the boundary where absence is restored, which is
exactly what keeps a fresh engine's grid equal to `blankPattern` - but an audit
whose value to ticket 10 is its completeness should not have a hole in it. The
table now has the row.

The reviewer also raised the length of `swappedRow`'s doc comment against the
comment-density rule, and then argued itself out of it: every function in
`song.ts` carries a comment of that length or more, and matching surrounding
style is the rule that wins. Left as written.
