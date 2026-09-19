# 13 - Swapping a pitched row keeps its melody

**Status:** ready-for-agent
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

- [ ] Swapping a pitched instrument for another pitched instrument preserves
      every painted note at its own degree, chords included.
- [ ] Swapping a pitched instrument for a one-note one drops `pitches`, and
      the resulting row is byte-identical in `saveFormat` to a row that never
      had pitches (spec §3's guarantee reaches this path too).
- [ ] Swapping a one-note instrument for a pitched one yields a row with
      `pitches` absent, whose on-steps sound the root sample untransposed.
- [ ] An iwft covering the swap through the UI, since the flattening is only
      visible as a lane: paint a contour, swap, see the contour survive.
- [ ] The other row-rebuilding paths are audited and the finding recorded.
- [ ] Full verify loop.

**Dormancy holds (spec §11).** Nothing here flags an instrument or touches
`kit.json`. The defect is unreachable on main until ticket 10 activates the
roster, which is the only reason it is not urgent - but it must land **before**
activation, or the first kid to browse instruments by ear loses their tune.
