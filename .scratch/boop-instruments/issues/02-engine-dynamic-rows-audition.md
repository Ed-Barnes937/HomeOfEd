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

**Status:** ready-for-agent

- [ ] Contract tests (against `FakeAudioDriver`): a pattern with non-kit-order rows and rows absent from it plays exactly its own rows; hits stay in pattern-row order
- [ ] `setPattern` accepts 1..N unique-id rows; duplicate ids or empty row lists are rejected the way other bad inputs are (document the chosen behaviour in the contract)
- [ ] `audition(id)` plays the sample when running/unlockable and is a safe no-op when locked; never touches the pattern or transport
- [ ] Driver preloads every kit instrument once, independent of pattern membership
- [ ] Grid renderers compile and render row count = pattern length (visual chrome unchanged otherwise)
- [ ] New ADR committed at `docs/adr/NNNN-boop-dynamic-clip-rows.md`; amendment notes added to ADRs 0024/0027/0031
