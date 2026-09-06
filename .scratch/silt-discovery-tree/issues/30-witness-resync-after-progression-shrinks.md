# 30 - Sim never re-reports a witness after the progression shrinks

**Status:** needs-triage
**Type:** bug (pre-existing for "forget discoveries"; ticket 28 added a second
trigger)
**Reported:** 2026-09-06, noticed while building ticket 28 (per-scene
progression); deliberately left out of that PR as out of scope.

The sim reports each interaction key to the field notes **once per browser
session**. Two dedupe layers enforce this (ADR 0048):

- `simWorkerCore.ts` keeps a `#reported` string-key set, seeded once at boot
  from the store's witnessed set (`useSimLoop.ts:189` sends `seedWitnessed`
  with `witnessedAtBoot`).
- The sim core's `WitnessTable` (`src/sim/witness.ts`) tracks fired pairs and
  deliberately survives `clear` and `restore` (ADR 0048 point 7).

Neither layer is told when the working progression **shrinks**. Two ways it
now can:

1. "Forget discoveries" (`fieldNotes.reset`) - pre-existing since the
   discovery-tree epic.
2. Loading a scene whose snapshot has fewer edges than the working
   progression (`fieldNotes.replace`, ticket 28 / ADR 0055).

After either, recreating an interaction the session has already reported does
nothing: the sim swallows it, so the store never re-adds the edge and the
chart stays un-earned until the player reloads the page (a reload re-seeds
from the now-smaller store, so everything self-heals).

## Repro

1. Witness lava+water (obsidian charted).
2. Save the scene, then "Forget discoveries" (or load a pre-28 scene, which
   loads as empty).
3. Pour water on lava again. Nothing is recorded; the entry stays undiscovered
   until a page reload, after which the same pour records normally.

## Design sketch (untriaged)

The clean seam already exists: `seedWitnessed` is additive today. Either

- add a replace-flavoured message (or make `seedWitnessed` replace rather
  than add) and have `HomePage`/`useSimLoop` re-send the store's witnessed
  set whenever the progression is replaced or reset; the `#reported` set is
  cheap to rebuild. The sim-core `WitnessTable` ALSO dedupes, so a worker-set
  resync alone is not enough - the table needs a matching clear/rebuild path,
  which touches the perf-sacred core (spec §4, ADR 0048); read those before
  choosing where the reset lives.
- or accept the session-scoped behaviour and document it (wontfix): the
  store dedupes anyway, reload heals, and re-earning within a session may not
  matter for real play.

Perf constraint either way: nothing may be added to the per-event hot path
(one load, one branch - ADR 0048); any resync must be a rare, message-driven
operation off the tick.

## Acceptance (sketch, pending triage)

- [ ] After "Forget discoveries", re-firing a previously seen interaction
      records it again within the same session
- [ ] After loading an emptier scene, same
- [ ] Determinism test stays green; no new per-event work in the sim core
- [ ] Unit tests at the simWorkerCore/witness layer; one `.iwft` for
      forget-then-rewitness through the UI
