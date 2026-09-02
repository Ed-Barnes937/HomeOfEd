# 02 - Engine: dynamic pattern rows, audition(), and the ADR

**What to build:** The `SequencerEngine` contract's `Pattern` is redefined as
**the clip's own rows** - ordered, unique `instrumentId`s, length 1..roster -
instead of "one row per kit instrument, in kit order". `setCell`/`setPattern`/
`getPattern` signatures are unchanged; `setPattern` becomes the way a row
set changes (membership and order included). The engine's default pattern for
a fresh grid is the roster's **first six** instruments, empty.

New contract method: `audition(instrumentId: string): void` - play one
instrument's sample now, from a user gesture; a no-op while `locked` is being
unlocked, mirroring audition-on-toggle. The instrument picker (ticket 05) is
its only caller. Audition-on-toggle stays engine-internal as today.

The driver preloads the **whole roster's** samples up front regardless of
which rows any clip uses (20 short wavs). `engine.kit` remains the only
enumeration of instruments.

Write the new ADR ("boop dynamic clip rows") recording the model and its
amendments: ADR 0024 (`Pattern` wording + `audition`), ADR 0027 ("6 x 16,
always" becomes "16 steps always; the rows are the clip's own, default six,
minimum one - and no breakpoint may drop a row or a step"), ADR 0031 (row
add/remove/swap are song mutations). Note ADR 0030 needs no amendment.

Update `Grid.tsx`/`PhoneGrid.tsx` only as far as compiling and rendering from
pattern rows (artwork/name looked up in the kit by id) - the picker button,
add-row and geometry work are tickets 05/06.

Spec: §1 (model), §6 (engine changes), §7 (ADR bookkeeping).

**Blocked by:** None - can start immediately (test against fake kits; does
not need ticket 01's real roster).

**Status:** done

- [x] Contract tests (against `FakeAudioDriver`): a pattern with non-kit-order rows and rows absent from it plays exactly its own rows; hits stay in pattern-row order
- [x] `setPattern` accepts 1..N unique-id rows; duplicate ids or empty row lists are rejected the way other bad inputs are (document the chosen behaviour in the contract)
- [x] `audition(id)` plays the sample when running/unlockable and is a safe no-op when locked; never touches the pattern or transport
- [x] Driver preloads every kit instrument once, independent of pattern membership
- [x] Grid renderers compile and render row count = pattern length (visual chrome unchanged otherwise)
- [x] New ADR committed at `docs/adr/NNNN-boop-dynamic-clip-rows.md`; amendment notes added to ADRs 0024/0027/0031

## Comments

**2026-09-02** - Built.

- **ADR 0041** (`docs/adr/0041-boop-dynamic-clip-rows.md`): 0035-0040 are all
  taken on `origin/main` (silt, sprout, deploy), so 0041 was the next free
  number across every branch. Amendment notes appended to ADRs 0024, 0027 and
  0031; ADR 0030 deliberately untouched, and the new ADR says why.
- `Pattern` is now the clip's own rows. The engine keeps a `Map` (insertion
  order = row order), rebuilt wholesale by `setPattern`; a fresh grid is
  `kit.instruments.slice(0, DEFAULT_CLIP_ROWS)` with `DEFAULT_CLIP_ROWS = 6`
  exported from the contract so clip creation (ticket 04) cannot drift from it.
  A roster smaller than six gets all of it, which keeps the 3-voice test kits
  meaningful.
- `setPattern` refusals (all throw, and discard the new row set before adopting
  it, so the grid is untouched): empty list, an id named twice, an id the kit
  does not have, a row that is not 16 steps. `setCell` now tells "unknown
  instrument for this kit" from "not a row of this pattern".
- **`audition(instrumentId)` decision:** an id the kit does not know is
  *ignored*, not thrown - unlike every other id-taking method on the seam. It
  is a fire-and-forget side effect wired to a child's finger, so a stale
  picker row must not be able to crash the toy. Recorded in the contract and
  in ADR 0041 §3. It also sounds while the loop is running (a picker tap is a
  request for a sound), which is the opposite of audition-on-toggle's rule.
- **`toneAudioDriver.ts` is unchanged, on purpose.** `audition` needs nothing
  new from the `AudioDriver` seam - it is `play(instrumentId)`, which the
  driver already has - and the whole-roster preload already lived in
  `createSequencerEngine`. A new test pins the preload as
  pattern-independent rather than leaving it incidental.
- Grid renderers: both now resolve a row's instrument through
  `features/grid/rowInstruments.ts` (`instrumentsById`) instead of
  `kit.instruments[rowIndex]`. Row hues stay positional. No UI path can yet
  produce a non-kit-order pattern, so the *renderer* half of that proof lands
  with the picker's `.iwft` in ticket 05; here it is the id-keyed lookup unit
  test, typecheck, and the 175 existing CT tests staying green.
- Left to their owners on purpose: the dynamic "N by 16" aria copy (ticket 06),
  `blankPattern`/`samplePattern` defaulting to the first six (ticket 04),
  `storedToPattern` honouring stored rows (ticket 03), the gain re-measure
  (ticket 08). Nothing here needed ticket 01's roster.
- Docs: `apps/boop/CONTEXT.md` gained **Roster** and **Row**, and its
  **Pattern**, **Clip** and **Audition** entries were corrected;
  `apps/boop/CLAUDE.md` restates the grid rule and lists the new module.
- Verify: `pnpm lint`, `pnpm typecheck` (17/17 green),
  `pnpm --filter boop run test` - 385 Vitest + 175 Playwright CT, all passing.
