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

**Status:** resolved

- [x] Behavioural unit tests pass: fall, slide, rest, floor, determinism-for-a-seed
- [x] Registry rejects invalid definitions at boot
- [x] No `Math.random()` in sim code; all randomness flows from the seeded PRNG
- [x] Grid state lives in transferable typed arrays
- [x] `pnpm lint`, `pnpm typecheck`, silt tests green

## Comments

Resolved in commit `83f66a1` (Opus agent). `apps/silt/src/sim/` — constants,
types, elements (pinned ids dirt=1…obsidian=5, WALL=255), registry with
boot-time validation (reports all problems at once), interleaved single
ArrayBuffer grid, chunk-relative `Api` (one reused cursor, no per-cell
allocation), archetype kernels (static + powder, exhaustive switch so
liquid/gas can't land without kernels), sim (gen-alternating scan, clock
guard), FixedTimestep (wired by ticket 04). 23 vitest tests green; orchestrator
re-ran lint/typecheck/test. Deviations (all sound): `has(dx,dy,tag)` instead of
`has(tag)`; Archetype union declares only the two implemented kinds; `clear()`
also rewinds generation + RNG (spec §3 reset semantics); sand `slide: 1`;
ESLint `no-restricted-properties` bans `Math.random` under `src/sim/**`. Clock
guard stamps every occupied cell each tick so the 256-tick byte wrap can't skip
settled cells — note for tickets 05/06.
