# 32 - Scene load rides the witness resync

**What to build:** loading a scene whose snapshot has fewer edges than the
working progression lets the dropped interactions be re-witnessed in the same
session - the ticket-28 trigger of ticket 30's bug. After ticket 31 the seam
exists; this wires the scene-load path onto it.

**Blocked by:** 31 - Witness resync seam.

**Status:** ready-for-agent
**Parent:** 30-witness-resync-after-progression-shrinks.md
**Reported:** 2026-09-06, breakdown approved by Ed.

## Design

- Where a scene load already replaces the working progression wholesale
  (ADR 0055), send the same resync ticket 31 built, carrying the snapshot's
  witnessed set. Pure wiring - no new protocol, no sim-core change.
- Loading a *fuller* scene must stay quiet, exactly as ADR 0055 §4 rules for
  moment cards: the resync tells the sim what the page now knows; it raises
  nothing by itself.

## Acceptance

- [ ] One `.iwft`: witness lava+water, load a scene with an emptier snapshot
      (a pre-snapshot scene loads as empty and will do), pour water on lava
      again, and the entry re-earns without a reload
- [ ] Loading a fuller scene still raises no moment cards and re-reports
      nothing (the existing quiet-load `.iwft` stays green)
- [ ] Full verify loop green
