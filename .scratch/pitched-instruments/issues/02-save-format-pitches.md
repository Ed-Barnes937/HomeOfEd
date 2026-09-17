# 02 - Save format: additive `pitches` per row

**Status:** ready-for-agent
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

- [ ] Round-trip: a boop with pitched rows (notes, chords, empty steps)
      encodes and decodes byte-honestly, `steps` always the exact projection.
- [ ] Every pre-existing document and share link decodes unchanged; a boop
      with no pitched rows is written byte-identically to today.
- [ ] Invalid `pitches` (length, charset, projection mismatch, unknown-shape
      values) reads as `EMPTY_DOCUMENT`, never a throw.
- [ ] A pitched row missing `pitches` decodes with every on step at the
      anchor pitch when materialised against the kit (the conversion path).
- [ ] ADR written; `apps/boop/CLAUDE.md`'s persistence rule gains the
      one-line pointer (as the placements encoding did).

## Comments
