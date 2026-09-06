# 32 - Scene load rides the witness resync

**What to build:** loading a scene whose snapshot has fewer edges than the
working progression lets the dropped interactions be re-witnessed in the same
session - the ticket-28 trigger of ticket 30's bug. After ticket 31 the seam
exists; this wires the scene-load path onto it.

**Blocked by:** 31 - Witness resync seam.

**Status:** done (built on silt-per-scene-notes, 2026-09-06)
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

- [x] One `.iwft`: witness lava+water, load a scene with an emptier snapshot
      (a pre-snapshot scene loads as empty and will do), pour water on lava
      again, and the entry re-earns without a reload
- [x] Loading a fuller scene still raises no moment cards and re-reports
      nothing (the existing quiet-load `.iwft` stays green)
- [x] Full verify loop green

## Decision: two explicit call sites, not an effect keyed on `generation`

Ticket 31 left this open. With the load wired there are now two places that
swap the working progression and must resync the sim (`forgetDiscoveries` and
the `useScenes` load callback), so "any progression swap resyncs the sim" is a
rule `HomePage` keeps by hand. The alternative was a `useEffect` keyed on
`fieldNotes.generation` sending `fieldNotes.witnessed`, which would enforce it
by construction. Rejected, on three counts:

1. **It would move the resync off the swap.** An effect runs after the render,
   so between the `replace` and the resync the sim is still filtering against
   the progression that has just been thrown away - a window in which a
   re-witnessed first is swallowed. The explicit calls happen in the same
   synchronous breath as the swap, in the order that matters.
2. **It does not fit both movers as they stand.** `reset` does not advance
   `generation` (only `replace` does), so collapsing the two call sites means
   making it - which changes what `generation` means to `useMoments`, whose
   baseline resync is the quiet-load rule (ADR 0055 §4). Changing the moments'
   contract to save one line in `HomePage` is the wrong trade.
3. **An effect reaching into the sim reads worse than a call beside the swap.**
   Each call site is one line, with the swap it belongs to directly above it.

The rule is documented where a third mover would be written: the field-notes
bullet in `apps/silt/CLAUDE.md` names both call sites and says a third swap is
a third resync. That is the moment to revisit - the enforced version earns its
cost at three, not at two.
