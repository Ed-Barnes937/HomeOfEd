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

**Status:** ready-for-agent

- [ ] Round-trip: a clip with chosen instruments and **no painted cells** encodes and decodes with its exact rows (the spec's "come back to clip 1" scenario, at the unit level)
- [ ] A pre-dynamic-rows document (launch six, kit order) decodes byte-honest and re-encodes identically
- [ ] Rows decode in stored order, not kit order; a non-kit id drops without invalidating the boop
- [ ] Zero rows or a duplicate `instrumentId` invalidates the boop (and, per ADR 0025, the whole document)
- [ ] Share links carry a mixed-row song and round-trip it; an old `#g=` link still opens
- [ ] Sample clips resolve to the roster's first six on the 20-instrument kit
