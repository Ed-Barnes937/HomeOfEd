# 0058 - boop: the save format learns pitch, additively

- **Status:** Accepted
- **Date:** 2026-09-17
- **Related:** [ADR 0025](0025-boop-save-format.md) (the V1 document and its
  all-or-nothing decode - its decisions stand), [ADR 0032](0032-boop-save-format-songs.md)
  (the additive-field pattern this follows, and the stale-build risk it
  accepted), [ADR 0026](0026-boop-share-links.md) (the share codec, which
  inherits every choice here), [ADR 0024](0024-boop-sequencer-engine-seam.md)
  as amended 2026-09-17 (the in-memory shape this persists). Implements
  [pitched-lane ticket 02](../../.scratch/pitched-instruments/issues/02-save-format-pitches.md);
  spec §3, §4 and §11.

## Context

A **pitched row** is a row whose 16 cells are **lanes**: 8 stacked pitches per
step, a column holding any number of them at once (a chord). Ticket 01 gave
the engine that shape in memory - `PatternRow.pitches`, 16 bitmasks, bit 0 the
bottom of the lane. It has to reach the disk, and reach a share link, without
costing anybody a boop.

The constraint is the same one ADR 0032 faced and is sharper here. Five of the
kit's instruments are about to become pitched, two of them (**marimba**,
**boop**) by *conversion* - they already appear in saved boops and in links
sent to other people. Nothing written before today can change meaning, and
nothing written today may stop an older tab opening it, because by ADR 0025 a
single invalid boop discards the **whole** save document: a version bump, or a
field an old build would reject, would not degrade - it would destroy every
boop a child had saved.

## Decision

1. **Additive `pitches` on `StoredRow`, no version bump.**
   `SAVE_FORMAT_VERSION` stays **1**. The field is optional, and its absence is
   meaningful rather than merely tolerated (see 4). A bump is the one thing
   that cannot be considered: every document on disk is version 1, a version it
   does not recognise reads as `EMPTY_DOCUMENT`, so bumping would empty every
   browser that has ever saved a boop. This is ADR 0032's decision (1) applied
   again, for the same reason.
2. **32 lowercase hex characters, two per step, in step order.** Each byte is
   a bitmask of pitch indexes: **bit 0 (the LSB) is pitch index 0, the bottom
   of the lane, do**; bit 7 is the top, high do. Regex `^[0-9a-f]{32}$`. It is
   fixed-width like `steps` beside it, it is the in-memory mask verbatim (no
   re-ordering, no per-note list), and it costs ~44 base64url characters per
   pitched row in a link - a non-issue. Lowercase and hex specifically, because
   a single spelling is what makes a byte-identical round-trip checkable.
3. **`steps` stays the any-note projection, and the writer derives it.**
   `steps[s] === '1'` iff step `s`'s pitch byte is non-zero. Two fields
   describing one truth can disagree, so only one of them is ever authored: on
   a pitched row `patternToStored` computes `steps` **from** `pitches` and
   ignores what it was handed. Keeping `steps` at all (rather than letting
   `pitches` replace it) is what lets an older build read a pitched boop as an
   ordinary rhythm instead of rejecting it - see 5.
4. **A row without `pitches` is legal, and means the anchor.** On a pitched
   instrument every on step reads as the anchor pitch "so" - the middle of the
   lane, zero semitones, the untransposed root sample (spec §3). That is what
   makes conversion free: a marimba boop saved last month sounds *identical*
   after marimba becomes pitched, and displays its notes mid-lane. The rule
   lives in `pitch.ts`'s `rowPitchMasks` and nowhere else, so **decode leaves
   the field absent** rather than materialising 16 anchor masks: a second copy
   of the rule is a second chance to get it wrong, and writing the anchor out
   would also break 6.
5. **The stale-build path is a degrade, not a break.** An un-refreshed old tab
   reading a pitched document drops the unknown `pitches`, validates fine
   against the `steps` it already understands, and plays the rhythm on the base
   sample. If it autosaves, it clobbers the pitches - the accepted ADR 0032
   stale-build class, and this is the *good* end of it: the child hears their
   rhythm, not an empty grid. That outcome is bought by 3, and is the whole
   reason `steps` is kept redundant.
6. **A boop with no pitched rows is byte-identical to what a pre-pitch build
   wrote.** A row carrying no `pitches` is written with exactly the two fields
   and the exact bytes it had before. This ticket lands **dormant** (spec §11):
   no kit entry is pitched yet, so until the activation nothing on any disk
   changes at all.
7. **Decode is strict, exactly as strict as everything else.** A `pitches` that
   is not a string, not 32 lowercase hex characters, not a whole number of lane
   bits (`isPitchMask` - the lane's shape is `pitch.ts`'s to state, not the
   codec's to assume), or whose projection is not this row's own `steps`,
   invalidates the boop, which discards the document per ADR 0025. Decode still
   never throws: invalid reads as `EMPTY_DOCUMENT`, and an invalid share link
   reads as no link. These documents have one writer; a disagreement between
   `steps` and `pitches` is corruption or a bug, and guessing which half to
   believe is more states than the risk earns.
8. **No `SHARE_FORMAT_VERSION` bump, and nothing share-specific.** The share
   codec calls `decodeStoredBoop`, so it inherits all of the above for free
   (ADR 0026). Tested, not assumed.

## Consequences

- Converting marimba and boop to pitched instruments (ticket 10) needs no
  migration and touches no saved data. That was the point.
- The redundancy between `steps` and `pitches` is deliberate and permanent.
  Anything that writes a pitched row must go through `patternToStored`, which
  is the only place the projection is computed - the existing
  "one encoding, in `saveFormat.ts`" rule, now load-bearing for a second
  reason.
- `pitches` cannot grow past 8 bits per step in this encoding: two hex
  characters is the field's width, and every string on disk fixes it. A
  taller lane would be a new field, not a wider one - the same shape of
  ceiling as `placements`' single-character alphabet (ADR 0032).
- The stale-build clobber of (5) is documented, not mitigated, consistent with
  ADR 0025 and ADR 0032. It is strictly milder than the layered-`placements`
  case, which a stale build *rejects*.
