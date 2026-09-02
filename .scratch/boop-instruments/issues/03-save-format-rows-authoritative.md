# 03 - Save format: stored rows become authoritative

**What to build:** A clip's instrument selection round-trips because its
pattern's row list IS the selection (spec §5) - including all-off rows, which
still store `{ instrumentId, steps: "0000000000000000" }`. No shape change,
no version bump: `SAVE_FORMAT_VERSION` stays 1 and the share codec inherits
everything.

- `storedToPattern` stops rebuilding one-row-per-kit-instrument and honours
  the stored rows verbatim (membership **and order**), dropping ids the kit
  no longer knows. Old documents wrote exactly the launch six in kit order,
  so they decode identically - pin that with a test.
- `decodePattern` gains validation: at least 1 row, no duplicate
  `instrumentId` within a pattern. Unknown ids still decode (they drop at
  `storedToPattern`, per the existing tolerance) - a doc from a newer roster
  must not be rejected.
- The stale-build story is accepted and documented (same class as ADR 0032's
  layering risk): an old build shows the classic six with new-instrument rows
  silently absent. Degrades, never rejects.
- `sampleClips.ts` stays position-keyed over the roster's first six; verify
  the authored clips resolve unchanged against the 20-instrument kit.

Spec: §5 (persistence), §1 (model limits).

**Blocked by:** 02 (the `Pattern` contract this decodes into).

**Status:** done

- [x] Round-trip: a clip with chosen instruments and **no painted cells** encodes and decodes with its exact rows (the spec's "come back to clip 1" scenario, at the unit level)
- [x] A pre-dynamic-rows document (launch six, kit order) decodes byte-honest and re-encodes identically
- [x] Rows decode in stored order, not kit order; a non-kit id drops without invalidating the boop
- [x] Zero rows or a duplicate `instrumentId` invalidates the boop (and, per ADR 0025, the whole document)
- [x] Share links carry a mixed-row song and round-trip it; an old `#g=` link still opens
- [ ] Sample clips resolve to the roster's first six on the 20-instrument kit
      *(position-keying verified against the real 20-instrument `kit.json` - the
      authored clips land on exactly the same instruments and steps as before.
      The row-count trim to six is `samplePattern`, which is ticket 04's.)*

## Comments

**2026-09-02** - Built. `SAVE_FORMAT_VERSION` stays 1; no shape change, so the
share codec inherited everything for free.

- `storedToPattern` no longer walks the kit. It filters the stored rows to ids
  the kit knows and maps them in place, so membership **and** order are the
  clip's. Nothing is invented for a kit instrument the clip left out, and an
  all-off row survives - which is the whole "come back to clip 1" guarantee
  (spec §5).
- **Decision worth flagging: an all-unknown row set degrades to a fresh grid,
  not an empty pattern.** Filtering alone can return `[]` (a share link from a
  different kit, or a roster that dropped a voice), and ticket 02's
  `setPattern` *throws* on an empty row list - so a literal reading would turn
  a tolerated document into a crashed toy. `storedToPattern` therefore falls
  back to `kit.instruments.slice(0, DEFAULT_CLIP_ROWS)`, empty. This keeps the
  function's post-condition equal to `Pattern`'s invariant (1..roster rows) and
  keeps decode total, per ADR 0025. Happily it also means the old
  "ignores instruments that are not in the kit" test keeps its exact
  expectation, now via the fallback rather than a kit rebuild.
- `decodePattern` gained two rules: a pattern with **no rows** and a pattern
  naming the **same instrument twice** are both invalid documents (and so, per
  ADR 0025, discard the whole save document). Unknown ids deliberately stay
  *valid* at the document level - they drop at `storedToPattern` - so a boop
  written against a bigger roster still opens. Both directions are pinned by
  tests. The 16-char `/^[01]+$/` bitstring rule is untouched, and `MAX_BPM`
  was not touched (spec §10.3).
- Old data pinned two ways: a hand-written pre-dynamic-rows save document
  (launch six, kit order) re-serialises byte-identically and rebuilds as the
  same six in the same order on a grown roster; and a hard-coded `#g=` token
  from before this change still decodes in `shareLink.test.ts`. A mixed-row
  song (different instruments, different orders, one unpainted clip)
  round-trips through the link codec unchanged.
- `sampleClips.ts` untouched. A new test reads the real
  `public/kits/launch/kit.json` and pins that its first six are still
  kick/snare/hat/tom/marimba/boop and that every authored clip resolves to the
  same sounding rows on the 20-instrument roster as on the six. The remaining
  gap - `samplePattern` still materialising one row per *kit* instrument, so 20
  rows on the real kit - is ticket 04's, along with `blankPattern` and the
  HomePage defaults.
- One `.iwft` fixture had to change: `grid.iwft.tsx`'s "a multi-clip working
  song survives a reload" hand-wrote **one** row per clip as shorthand, relying
  on the old kit rebuild to give clip 2 a kick row for its
  `verifyCellOff('kick', 0)`. Under the new semantics that fixture is a genuine
  one-row clip, so it now lists the launch six per clip - which is what a real
  document written by `storedBoopFromSong` lists. Assertions unchanged.
- **Left for someone else, deliberately:** `song.ts`'s `mergePatterns` overlays
  layered clips by row **index**, which was only sound while every pattern was
  the kit in kit order. With per-clip rows it can now merge a cowbell row onto
  a kick row. No ticket names it; I corrected its doc comment to say so rather
  than change playback behaviour outside this ticket's scope. Spec §1 says
  layered placements "sound their union", so this wants merging by
  `instrumentId`.
- Verify: `pnpm lint` and `pnpm typecheck` green; `pnpm --filter boop exec
  vitest run` 401 passed (389 at branch tip, 2 replaced, 14 added). The `.iwft`
  suite runs 11 failed / 220 passed both before and after this change, the same
  11 by name - all "grid is still 6 by 16" geometry assertions against
  `blankPattern`/`samplePattern`/HomePage defaults, i.e. ticket 04's.
