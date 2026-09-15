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

**2026-09-15 (agent, from the account-infra map):** The BlobStore home this
idea was missing now has a decided shape - see the
[decision sitting](../../account-infra-discovery/issues/05-decision-sitting.md)
and the [first-slice spec ticket](../../account-infra-discovery/issues/08-first-slice-spec-boop.md).
What it means here:

- The **family service's central SaveStore** (opaque blobs keyed
  `(appId, accountId, slotKey)`) is the natural off-device home for recorded
  sounds; boop itself stays stateless. First slice is boop `boop:save` -
  audio would come after that proves the shape (and note the spec's
  slotKey/quota conventions are one of the proposals awaiting Ed).
- **Sensitivity flag, from the gate ADR
  ([ADR 0057](../../../docs/adr/0057-family-service-legal-gate.md), proposed):**
  recorded child voice audio is explicitly named a step up from
  boops/scenes/doodles - it never lands in the SaveStore by default, and
  storing it re-opens the legal gate's question even inside the household
  pilot. The shaping conversation this ticket wants must treat off-device
  voice persistence as a deliberate, gate-citing decision, not a storage
  detail.
