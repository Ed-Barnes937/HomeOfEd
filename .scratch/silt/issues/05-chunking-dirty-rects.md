# 05 — Chunking and dirty rects

**What to build:** The chunk/dirty-region structure inside the sim, per
`.scratch/sand-sim/spec.md` §5.3 — structure now, multithreading never (in
v1):

- Chunk struct with **two** dirty rects (working + current, swapped at frame
  end), a 2-cell margin, and a filled-cell count that lets empty chunks skip
  work entirely
- Deferred cross-chunk move list; when two cells contend for the same
  destination the tie-break **draws from the seeded PRNG**, and chunk
  resolution order is **fixed** — these are the two places chunking can
  silently destroy determinism, and both get tests
- Chunk size is a tunable constant, not a commitment — pick something
  reasonable and leave it adjustable

Observable behaviour must not change: the existing behavioural tests pass
unmodified, and determinism-for-a-seed holds across the chunked
implementation.

**Blocked by:** 03 — Sim core (headless)

**Status:** resolved

- [x] All pre-existing behavioural tests pass unchanged
- [x] Determinism test passes: same seed + same inputs → identical grid, including across cross-chunk contention
- [x] Idle chunks provably skip work (unit test on the skip path, e.g. tick count or dirty-rect assertions)
- [x] Cross-chunk tie-break uses the sim PRNG; chunk order is fixed
- [x] `pnpm lint`, `pnpm typecheck`, silt tests green

## Comments

Resolved in commit `a6889ac` (Opus agent, worktree branch merged fast-forward).
New `chunks.ts` (Chunk with two dirty rects + filled count, row-major ChunkMap,
2-cell margin) and `moves.ts` (DeferredMoves: total-order sort by (dst,src),
PRNG tie-break via `randInt`, stale-move revalidation). `CHUNK_SIZE = 32`
tunable. 19 new tests incl. both determinism traps: cross-chunk contention
(same seed → same winner; across seeds both winners occur) and fixed chunk
order. Each test negative-checked (mechanism broken → test fails).
Key finding: chunk sleeping alone breaks the 256-tick clock-byte wrap — fixed
by a restore pass re-stamping all awake chunks before any is scanned, with a
wrap-exact test. Deviations (all sound): `Sim.scannedLastTick` getter for the
skip-path assertion; `tryMove` returns true for queued moves (loser forfeits
the tick); within-band scan order differs from unchunked sim for structures
wider than a chunk (inherent to chunking). Agent recommends an engine ADR
post-merge (clock-guard restore pass + scan-order note) — assigned to
ticket 06's agent. sim.test.ts untouched; orchestrator re-ran the gate:
40 vitest + 3 CT green, lint/typecheck clean.
