# 03 — Sim core (headless)

**What to build:** The simulation engine with no UI, verified entirely by
behavioural unit tests. From `.scratch/sand-sim/spec.md` §5 (architecture) and
§6 (grid):

- Fixed 300×200 logical grid as a build-time constant; typed-array storage,
  4 bytes per cell `{species, ra, rb, clock}`; worker-ready transferable
  buffer; never objects-per-cell
- Seeded PRNG owned by the sim — no `Math.random()` reachable from sim code
- Fixed-timestep tick, decoupled from any render loop (required by the clock
  trick)
- `clock` double-update guard: per-tick generation counter, writes stamp
  `generation + 1`, scan skips stamped cells
- Generation-alternating horizontal scan (no RNG consumed for fairness)
- WALL sentinel for out-of-bounds reads — no element branches on edges
- Element registry with boot-time validation (duplicate ids, unknown reaction
  targets, bad probabilities fail at load); pinned element ids
- Archetypes `static` and `powder {density, slide}` only (liquid/gas are
  ticket 06); v1 elements Dirt and Sand as pure config
- The chunk-relative `Api` shape (`get/set/swap/become` by `(dx,dy)` offset,
  `has(tag)`, `ra`/`rb` scratch, `rand()/randInt()`) — hooks that use it come
  in ticket 06, but the seam exists now

Tests are few and targeted (spec §10): a sand grain falls, slides off a pile,
rests on dirt, stops at the floor; same seed + same paint sequence → identical
grid after N ticks.

**Blocked by:** 02 — Scaffold `apps/silt` from starter

**Status:** claimed

- [ ] Behavioural unit tests pass: fall, slide, rest, floor, determinism-for-a-seed
- [ ] Registry rejects invalid definitions at boot
- [ ] No `Math.random()` in sim code; all randomness flows from the seeded PRNG
- [ ] Grid state lives in transferable typed arrays
- [ ] `pnpm lint`, `pnpm typecheck`, silt tests green
