# 04 - Song mutations: add, remove, and swap rows

**What to build:** The pure domain operations the UI wires up: in
`song/song.ts`, three new mutations on the active clip - **add row**
(append an instrument with empty steps), **remove row** (delete a row and its
painted steps; refused at 1 row), **swap row instrument** (the row keeps its
painted steps - same rhythm, new sound). All three return a new song and are
"edited" per ADR 0031 as amended by ticket 02's ADR - callers pair them with
`afterEdit` like every other mutation.

Rules enforced here, not in the UI: no duplicate instrument within a clip
(add/swap refuse an id the clip already has), row count 1..roster, unknown
ids refused against the kit. A new clip (Blank, or a sample clip's resolved
rows) defaults to the roster's first six.

Wire the engine boundary: switching clips already flows through
`setPattern`; verify a clip switch carries each clip's own row set to the
engine and back, so clip 1's instrument choices survive visiting clip 2 with
nothing painted (the spec §5 scenario at the state level - the `.iwft`
version lands with the picker in ticket 05).

Spec: §1 (model), §4 (swap keeps steps), §5, §7 (edited definition).

**Blocked by:** 02, 03.

**Status:** done

- [x] `addRow`/`removeRow`/`swapRowInstrument` unit-tested: happy paths, duplicate-id refusal, the 1-row floor, roster cap, unknown-id refusal
- [x] Swap preserves the row's steps; remove discards them; add appends empty at the bottom
- [x] Each mutation marks the song edited exactly like existing mutations (ADR 0031 pairing)
- [x] Clip switch round-trips per-clip row sets through the engine (unit test over the seam)
- [x] Blank and sample-clip creation produce the default first-six rows
- [x] `mergePatterns` merges layered clips by `instrumentId` (union of rows), not by row index

## Comments

**2026-09-02 (orchestrator, scope addition):** Ticket 03 found a live gap while
keeping playback out of its own scope: `song.ts`'s `mergePatterns` overlays
layered clips by row **index**, which per-clip rows make unsound (it can merge
a cowbell row onto a kick row). Spec §1 says layered placements "sound their
union", so merging must key on `instrumentId` - the union of the layered clips'
rows, steps OR-ed where an instrument appears in more than one. That is this
ticket's `song.ts` territory; the acceptance box above is added for it. Ticket
03 already corrected the function's doc comment.

**2026-09-02 (built):** The three mutations are in `song/song.ts`, each pure,
each acting on the active clip and returning a new song - and each **refusing
by no-op** (returning the song it was given) rather than throwing, which is the
house idiom `addClip`/`deleteClip`/`moveClip` already use and what makes the
`afterEdit` pairing mark nothing on a refusal. `addRow(kit, song, id)` appends
with 16 off steps; `removeRow(song, rowIndex)` drops the row and its steps;
`swapRowInstrument(kit, song, rowIndex, id)` re-points the row and keeps its
steps. Rows are addressed by **index**, not by their current instrument: that
is what the rail and the picker have to hand, and index is a row's identity on
the grid (the hues are positional).

Decisions and deviations:

- **The 1..roster cap needs no check of its own.** Rows are unique ids drawn
  from the roster, so they cannot outnumber it - the duplicate rule *is* the
  cap. Recorded in `addRow`'s doc comment and covered by a test that fills a
  clip with the whole roster and then tries every id.
- **A swap to an instrument the clip already holds is refused, the row's own
  included.** That makes a re-tap of the current sound a no-op, which is what
  the picker's stay-open browse-by-ear needs (spec §4).
- **Merged layered patterns are ordered by first appearance in lane order**:
  the lowest-lane clip's rows in its own order, then whatever rows the next
  lane adds, in theirs (a `Map`'s insertion order). Nothing renders a merged
  pattern - it is what the conductor hands the engine and what the export
  renders - so the order only has to be deterministic, and this one leaves a
  single-clip position's pattern object untouched (`mergePatterns([p]) === p`
  still holds).
- **`blankPattern(kit)` now lives on the engine contract** (`sequencerEngine.ts`,
  beside `DEFAULT_CLIP_ROWS`) and is the *one* definition of "a fresh grid".
  Three copies of "the roster's first six, empty" existed - the engine
  constructor, `saveFormat`'s private `defaultRows`, and `HomePage`'s local
  `blankPattern` (which emitted the **whole** 20-voice roster, the cause of the
  11 `.iwft` geometry failures). All three now call it, which is the drift ADR
  0042 was explicit about wanting closed; a test asserts a fresh engine's
  pattern *equals* `blankPattern`.
- **`samplePattern` resolves over `blankPattern`**, so a sample clip on the
  20-voice roster is the classic six it was authored against, not twenty rows.
  A shorter kit still degrades to a shorter pattern.
- **Deviation (beyond the stated scope): "Clear grid" now keeps the clip's
  rows** and only empties their steps. It was calling `blankPattern`, so a
  clear would have thrown away the child's instrument choices the moment the
  picker landed. Covered by a new seeded `.iwft` test in `clipLanes.iwft.tsx`
  (verified red against the old behaviour) plus a new POM helper,
  `verifyGridRows(instrumentIds)`, which asserts the rows the grid shows, in
  order - tickets 05/06/07 will want it.
- Not touched: the hardcoded `"6 by 16 step grid"` aria copy in `Grid.tsx` /
  `PhoneGrid.tsx` (spec §4 wants it dynamic) - that belongs with the grid UI
  tickets, not here.

Verified: `pnpm lint`, `pnpm typecheck`, 426 boop unit tests (up 25) and all
**232** `.iwft` tests green - the 11 known "grid is still 6 by 16" failures
(`laptopColumnFits` x2, `playBarPinned` x6, `songBarIsHome` x3) all cleared, as
predicted, with one new `.iwft` test added.
