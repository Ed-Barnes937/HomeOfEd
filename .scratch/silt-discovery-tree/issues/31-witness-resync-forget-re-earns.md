# 31 - Witness resync seam: "Forget discoveries" re-earns within a session

**What to build:** after the panel's "Forget discoveries", recreating an
interaction the session already saw records it again immediately - no page
reload. Today the sim swallows it: the sim core's witness table and the worker
core's reported set both still remember it (see ticket 30 for the full
mechanism and repro).

**Blocked by:** None - can start immediately.

**Status:** done (built on silt-per-scene-notes, 2026-09-06)
**Parent:** 30-witness-resync-after-progression-shrinks.md
**Reported:** 2026-09-06, breakdown approved by Ed.

This is the tracer bullet through every layer; ticket 32 reuses the seam it
builds.

## Design

- The sim core's witness table (`src/sim/witness.ts`) learns to forget: zero
  its tables and drop anything pending. A rare, message-driven operation off
  the tick - nothing is added to the per-event hot path (one load, one
  branch - ADR 0048, spec §4), and it never draws from the `Rng`.
- The protocol's boot seed becomes a **resync**: replace (not extend) the
  worker core's reported set with the keys the page sends, and clear the sim's
  witness table in the same message. Boot then uses the same message it always
  conceptually was - "this is what the page knows" - so there is one shape,
  not an add-flavoured and a replace-flavoured one.
- Both hosts (worker and main-thread fallback) carry it, as they do every
  other message.
- The page fires the resync when the working progression is reset (the
  panel's armed "Forget discoveries"). Interactions still in the store may
  re-fire inside the sim afterwards and re-report; the replaced reported set
  filters what the page already knows, and the store dedupes regardless.
- Amend ADR 0048: point 7 ("a Sim keeps what it has witnessed across
  `clear`/`restore`") stays true for world clears; the new sentence is that an
  explicit progression resync is the one thing that resets the recorder.
  Update the witness-recorder bullet in `apps/silt/CLAUDE.md` to match.

## Acceptance

- [x] After "Forget discoveries", re-firing a previously witnessed interaction
      records it again in the same session (one `.iwft`:
      forget-then-rewitness through the UI)
- [x] The determinism test stays green; no new work per already-witnessed
      event in the sim core
- [x] Vitest at the witness-table, worker-core and host layers (resync
      replaces rather than extends; a resynced table re-reports; keys in the
      resync are not re-announced to the page)
- [x] ADR 0048 amended; the scoped CLAUDE.md bullet updated
