# 02 - Engine witness recorder + first-witness transport

**Status:** done (built on silt-interaction-tree, 2026-09-04)
**Type:** task
**Spec:** [../spec.md](../spec.md) §3, §4

The one engine seam: record which transmutations have fired, and get rare
first-witness events from the sim (worker or local) to the page. Perf is
sacred (the 60/120fps epics) - read spec §4 before touching anything.

## Design

- **Recorder lives in the sim core**, not the worker glue, so the worker and
  the main-thread fallback both get it. A flat "already seen" table (typed
  array or Set keyed by small ints - not strings on the hot path; map to the
  name-based keys of ticket 01 at the reporting edge, off the hot path).
- **Exactly three call sites** (spec §3): `applyReactions` when a pair
  applies; `applyLifetime` when a decay with a product fires (a fade records
  nothing); the growth hook's successful `api.set`. Per event: one index
  computation, one load, one branch, one store on first witness. No
  allocation, no RNG - `Rng` must not be touched, and no behaviour may change.
- **`step` counts** (it runs real ticks); paint/restore/spawners record
  nothing by construction (they are not these three sites).
- **Transport**: firsts are rare (37, ever), so the sim host reports a
  first-witness message rather than a per-frame shared-buffer poll. Extend
  `simProtocol` with a worker->page message carrying the new key(s) (batch per
  tick is fine); the `simHost` seam hides worker vs local exactly as it does
  everything else. The page subscribes via a callback on the host.
- **Seeding**: the page can hand the sim the already-witnessed set at boot
  (else a long-running world re-reports firsts after reload; the store dedupes
  anyway, so this is noise-reduction, not correctness - keep it simple).

## Tests

- Vitest on the sim core: script a world (water beside lava, tick) and assert
  the witness set contains exactly the fired keys; a fade (smoke expiring)
  records nothing; painting and `restore` record nothing.
- Growth: moss beside water eventually records `grow:moss` (deterministic
  seed).
- **The determinism test stays green with the recorder in place** - this is
  the non-negotiable one.
- simHost: first-witness callback fires once per key across both hosts
  (worker path can be covered by the existing host test patterns).
- Bench sanity: no new work per already-witnessed event beyond the single
  check (eyeball `pnpm --filter silt run bench` before/after; it is a tool,
  not a gate).
