# 0048 - silt: the discovery witness lives in the sim core

- **Status:** Accepted (2026-09-03, landed with
  `.scratch/silt-discovery-tree/issues/02-engine-witness-recorder.md`)
- **Date:** 2026-09-03
- **Related:** `.scratch/silt-discovery-tree/spec.md` §3-§5 (the Field notes
  metagame) and ticket 02 there;
  [ADR 0036](0036-silt-sim-in-a-worker.md) for the worker/local split this has
  to straddle;
  [ADR 0028](0028-silt-simulation-engine.md) for the engine and its element
  model. Implemented in `apps/silt/src/sim/witness.ts`, with the reporting edge
  in `apps/silt/src/features/sim/`.

## Context

Field notes tracks which transmutations the player has actually *witnessed* -
discovery is event-driven, never inferred from what is in the world (spec §3).
Only three places in the engine transmute a cell: `applyReactions` when a pair
applies, `applyLifetime` when a decay leaves a product, and the growth hook's
successful `api.set`. All three are on the hot path of a simulation that has
had two performance epics spent on it, and the sim runs in a worker over shared
memory (ADR 0036) or on the main thread in the local fallback.

Three questions had to be answered together: who owns the record, how the hook
reports something the engine cannot see, and how a discovery reaches the page.

## Decision

1. **The recorder is owned by the sim core** (`witness.ts`), not the worker
   glue, so the worker host and the main-thread fallback get it identically.
2. **It is a flat table indexed by small integers** - a byte per species id and
   a byte per packed species pair, as the registry's own lookups are. An event
   costs one index computation, one load and one branch; only a *first* witness
   stores a flag and allocates. Names are reached for only there, and edge keys
   are never built inside the sim at all: the core reports named events and
   `features/fieldNotes/edgeKeys.ts` maps them, so the sim stays below the
   metagame's vocabulary.
3. **A hook reports its own transmutation through `Api.witnessGrowth()`.**
   Reactions and decay are engine business and are recorded where they happen;
   the growth hook's `set` is not, and the element-facing `Api` is the only
   surface it has. The method takes no arguments and reads the grower off the
   cursor, so a hook cannot claim a growth it did not perform. It is the one
   thing on that surface that is not simulation.
4. **Recording never draws from the `Rng` and never touches a cell**, so the
   determinism test is what guards it - and every seeded outcome pinned across
   the sim suite with it.
5. **Firsts reach the page as a message** (`SimPageMessage`), batched per tick,
   rather than as another slot the render loop polls every frame: there are 37
   of them in the life of a roster. The `simHost` seam hides worker from local,
   and the page subscribes with a callback.
6. **What the page already knows is filtered at the reporting edge**, not
   seeded into the core's table: `seedWitnessed` fills a `Set` of edge keys in
   `SimWorkerCore`, which is what a `witnessed` message is checked against.
7. **A `Sim` keeps what it has witnessed across `clear` and `restore`** -
   discovery is global progression, and resetting the world does not reset it
   (spec §5).

## Consequences

- The recorder is invisible in the bench: the five scenarios move within noise
  (reaction churn 0.680 -> 0.682 ms/tick, wood ablaze 1.886 -> 1.895, plant
  growth 0.798 -> 0.781).
- `Api` has gained a member that is not simulation. It is documented as such at
  both the interface and the call site; an element with nothing to declare
  never calls it. A second hook that transmutes would report the same way,
  which is the point of putting it there rather than special-casing growth.
- Two things dedupe: the core's table (per session, on the hot path, by id) and
  the host's key set (against what has been persisted). They answer different
  questions, so the redundancy is deliberate - but a future consumer of
  `Sim.drainWitnessed()` will see seeded firsts once per session, because the
  table itself is never seeded.
- `witness.ts` allocates 64KB of pair table per `Sim`. That is half what
  `createRegistry` already spends on its pair index, and it buys a lookup with
  no hashing.
- Choosing names over ids on the wire means renaming an element orphans its
  keys - the same trade the scene codec already makes (spec §5).
