# 02 - Save format: additive `pitches` per row

**Status:** ready-for-human (built, PR open)
**Blocked by:** 01

**What to build:** `StoredRow` gains the optional `pitches` field exactly as
spec §4 pins it: 32 lowercase hex chars, two per step, LSB = pitch index 0
(bottom, do); `steps` stays the `[01]` any-note projection derived from
`pitches` on encode; decode is strict (bad length/charset/projection mismatch
invalidates the boop, which discards the document per ADR 0025). A pitched
row without `pitches` is legal - the stale-build degrade path. Share links
inherit via the shared codec (nothing share-specific to build, but test it).
Write the ADR recording the additive-not-version-bump decision and the
degrade semantics (`docs/adr/`, MADR-lite, citing ADR 0025/0026/0032).

Decisions this implements: grill Q9 + R2-2 degrade rule (spec §3, §4).

Acceptance criteria:

- [x] Round-trip: a boop with pitched rows (notes, chords, empty steps)
      encodes and decodes byte-honestly, `steps` always the exact projection.
- [x] Every pre-existing document and share link decodes unchanged; a boop
      with no pitched rows is written byte-identically to today.
- [x] Invalid `pitches` (length, charset, projection mismatch, unknown-shape
      values) reads as `EMPTY_DOCUMENT`, never a throw.
- [x] A pitched row missing `pitches` decodes with every on step at the
      anchor pitch when materialised against the kit (the conversion path).
- [x] ADR written; `apps/boop/CLAUDE.md`'s persistence rule gains the
      one-line pointer (as the placements encoding did).

## Comments

- 2026-09-17: **built** on branch `pitched-02-save-format`. Verify loop green
  (`pnpm lint`, `pnpm typecheck`, boop's full suite: 541 vitest + 267
  playwright-ct). Vitest only - this is pure persistence, and no UI writes a
  pitch until ticket 06, so there is nothing for an `.iwft` to drive.

  `StoredRow.pitches` is the spec's encoding verbatim: 32 lowercase hex chars,
  two per step in step order, bit 0 the bottom of the lane. `steps` stays the
  any-note projection and `patternToStored` **derives** it from `pitches`,
  ignoring whatever `steps` it was handed - two fields describing one truth,
  so only one of them is ever authored. Decode rejects a bad length, a
  character outside lowercase hex, a byte that is not a whole number of lane
  bits (`isPitchMask`, so the lane's shape stays `pitch.ts`'s to state), or a
  projection that does not match, and by ADR 0025 that discards the document -
  never a throw. Still `SAVE_FORMAT_VERSION` 1; a bump would empty every
  browser that has ever saved a boop, which is the whole point of the ticket.

  A row with no `pitches` decodes with the field **absent**, not expanded:
  what absence means is `rowPitchMasks`'s single ruling, and materialising 16
  anchor masks here would put a second copy of that rule in the app. Tested
  through `rowPitchMasks` rather than restating the anchor.

  Recorded as [ADR 0058](../../../docs/adr/0058-boop-save-format-pitches.md),
  with the one-line pointer in `apps/boop/CLAUDE.md`'s persistence rule.
  `CONTEXT.md` needed nothing: the vocabulary is ticket 06's, and its
  **Pattern** entry already covers the in-memory masks ticket 01 added.

  **Dormant, as designed** (spec §11): nothing in the kit is pitched, nothing
  in the app writes a `pitches` yet, and a boop with no pitched rows hits the
  disk byte-identically to what a pre-pitch build wrote - asserted, not
  assumed.
