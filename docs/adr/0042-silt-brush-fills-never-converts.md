# 0042 - silt: the brush fills, it never converts

- **Status:** Accepted
- **Date:** 2026-09-02
- **Related:** [ADR 0036](0036-silt-sim-in-a-worker.md) for the host/worker
  seam the change lands in. Implemented in
  `apps/silt/src/features/sim/simWorkerCore.ts` (`paintCells`).

## Context

A paint stroke wrote its species into every cell of the brush footprint,
occupied or not. Drawing a fire brush across a stone basin cut a channel
through the stone; sweeping a sand brush through a pond deleted the water it
crossed. Built structures were one slip of the pointer away from destruction,
which punishes exactly the careful play the app is for.

Spawners already took the opposite stance: `emitSpawners` skips a cell that
isn't empty, "so a spawner never stomps out material". The brush was the odd
one out.

## Decision

### 1. Painting skips occupied cells; erasing is exempt

`paintCells` only writes a cell whose current species is `EMPTY`. A stroke
through existing material adds around it instead of cutting through it. The
erase brush paints `EMPTY`, and clearing occupied cells is its whole job, so
the guard does not apply to it. Replacing material is therefore a two-step
gesture - erase, then paint - rather than a side effect of every stroke.

### 2. The guard lives in `SimWorkerCore.handle`, not `Sim.paint`

`Sim.paint` stays the raw write primitive. It is what `restore` and the tests
build worlds with, and `emitSpawners` already carries its own emptiness check;
giving the primitive fill-only semantics would have made "put this species in
this cell" impossible to express. The `paintCells` message *is* the brush
stroke, and both hosts (worker and main-thread fallback) run the same
`SimWorkerCore.handle`, so one guard covers every way a pointer paints.

## Consequences

- A stroke that lands entirely on occupied cells writes nothing, so it bumps
  no revision and wakes no chunks - a brush dragged over a settled structure
  is free.
- Repainting your own material is now a no-op instead of a rewrite, so it no
  longer re-rolls the per-cell colour variant in `rb` (ADR 0040) - brushing
  over a heap you just poured no longer makes it shimmer.
- Fire can still ignite: painting fire beside wood works as before, because
  ignition is a reaction between neighbours (`lifecycle.ts`), not an overwrite.
- Determinism is untouched - the guard reads the grid and consumes nothing
  from the RNG stream; skipped cells simply never call `paint`.
