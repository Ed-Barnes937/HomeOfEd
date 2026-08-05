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

**Status:** claimed

- [ ] All pre-existing behavioural tests pass unchanged
- [ ] Determinism test passes: same seed + same inputs → identical grid, including across cross-chunk contention
- [ ] Idle chunks provably skip work (unit test on the skip path, e.g. tick count or dirty-rect assertions)
- [ ] Cross-chunk tie-break uses the sim PRNG; chunk order is fixed
- [ ] `pnpm lint`, `pnpm typecheck`, silt tests green
