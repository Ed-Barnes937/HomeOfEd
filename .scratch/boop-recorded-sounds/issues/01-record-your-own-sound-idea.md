# 01 - Idea: record your own sound

**Status:** ready-for-human
**Type:** grilling
**Reported:** 2026-09-06, Ed - "just a sparky idea", parked deliberately

Let a kid record a sound (mic) and use it as an instrument. Ed flagged the
concerns himself: storage and persistence. Nothing should be built off this
ticket; the next step is a shaping conversation.

Grounding for that conversation:

- boop is stateless (ADR 0008): no server, no DB, saves in localStorage.
  Audio blobs in localStorage are a non-starter beyond a few short clips
  (base64-inflated, ~5MB total quota). Realistic homes: IndexedDB (per
  browser, no reach across devices) or a `BlobStore` behind the account layer
  (`.scratch/account-layer/`) - which makes this a likely *consumer* of that
  epic, worth naming in its discovery.
- The kit manifest is pure data with per-voice budget rules (peak 0.5,
  < 400 ms, retrigger buildup) enforced by tests. A recorded voice bypasses
  all of that - needs runtime normalisation/trimming instead.
- Mic permission UX for a kid, and a parent-comfort question: recordings of a
  child's voice persisting anywhere off-device touches the same territory as
  sprout's legal gate (ADR-0019) - worth a deliberate call, not a default.
- Related: `.scratch/boop-clips/issues/02` (clip persistence direction).

## Comments
