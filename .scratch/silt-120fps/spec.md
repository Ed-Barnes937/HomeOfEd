# silt — 120 fps

**Goal:** silt never misses a frame at the display's refresh rate — 60 fps on
ordinary hardware including the reference machine (2018 MacBook Air), 120 fps
on high-refresh devices. A 120 Hz display gives an **8.3 ms** budget per frame.

This epic came out of the 2026-08-26 "Rust backend" exploration: could porting
the sim engine to Rust/WASM (the sandspiel architecture) unlock 120 fps? The
conclusion was that it is the third lever, not the first — see **Decisions**
below. The two levers ahead of it are this epic's tickets.

## Where the frame goes today

Measured baseline, carried over from the perf audit
(`.scratch/silt-perf-improvements/spec.md` — on the `silt-perf-improvements`
branch until PRs #96–#101 merge):

| Stage | Measured (fast Mac) |
| --- | --- |
| sim tick, busy world | 1.0–1.8 ms/tick (~15–20% better on the perf branch) |
| rasterise 60k cells (CPU loop) | 0.03–0.10 ms/frame |
| `putImageData` + scaled `drawImage` | **unmeasured** — the one unknown on the frame path |
| React reconcile / pointer path | ~0.06 ms/move — ruled out by the audit |

Two structural facts shape the plan:

- **Chunk sleeping already works.** A settled world scans a few hundred cells,
  not 60k. Only a fully churning world pays the worst-case tick. (Sandspiel has
  no equivalent — it brute-forces its whole grid every tick, which is *why* it
  needs Rust.)
- **The tick is fixed at 60/s and decoupled from rAF.** At 120 Hz, every other
  frame is render-only. The tick has no upper bound (a user can always pour
  more sand); the frame rate should not be hostage to it.

## The plan

1. **[01 — WebGL renderer](issues/01-webgl-renderer.md).** Swap the Canvas 2D
   blit for a texture upload and one quad. Removes the unmeasured GPU-bound row
   and the CPU rasterise loop, and measures the before/after so the blit stops
   being a guess. The seam was built for this — `renderer.ts` declares
   `RenderableSim` as exactly `{ width, height, cells }`.
2. **[02 — sim in a worker](issues/02-sim-in-a-worker.md).** Move the tick off
   the main thread, so a heavy world degrades the *simulation* rate while the
   page holds the display rate. Continues the perf audit's ticket 09 proposal.

The sequencing is the audit's own lesson: its predictions were wrong about half
the time, and the wins were in memory-access shape, not theory. Measure the
blit (ticket 01 does), land the cheap structural win, then the architectural
one.

## Decisions

### Rust/WASM port of the sim engine — deferred (2026-08-26)

Not rejected; deferred behind tickets 01 and 02. The reasoning, recorded so it
does not have to be re-derived:

- **The expected win is modest where it matters least.** The engine is already
  flat typed arrays with no hot-path allocation (post perf epic). WASM over
  well-tuned typed-array JS is typically 1.5–3× — real, but it only speeds the
  tick, and ticket 02 makes tick cost invisible to the frame rate anyway.
- **The cost is a second toolchain.** ~2,000 lines of engine TS ported to a
  wasm-bindgen crate; ~2,400 lines of engine vitest needing a cargo-test +
  cross-validation story; Rust in CI and the Docker build; the element roster
  and hooks move into Rust (per-cell calls back into JS would erase the gain),
  so adding elements becomes a Rust job. Scale of the materials epic: 6–10
  stacked PRs.
- **Determinism is the hard part, not the syntax.** Same seed, same world means
  replicating the PRNG and its consumption order bit-for-bit, or accepting a
  new baseline.

**Revisit if** either happens: (a) after 01 + 02 land, a busy world on the
reference machine still can't hold its simulation rate — the tick itself is
then the limiter and WASM is the right tool; or (b) the open question below is
answered with 120 ticks/s, which doubles the tick budget's importance. The port
composes cleanly with both tickets — the worker would host the WASM, and the
WebGL renderer reads the same byte layout.

## Open question

**Is 120 fps rendering, or 120 Hz sand?** The sim ticks 60 times a second
regardless of frame rate, so at 120 Hz each world state renders twice — only
pointer and chrome get smoother. True 120 Hz sand means
`TICKS_PER_SECOND = 120`, which doubles worst-case tick cost *and* changes
element behaviour (every move probability and lifetime is per-tick). That is a
design decision, not a perf one, and nothing in this epic forecloses it.

## Constraints

The perf audit's non-negotiables all still hold (its spec §"Rules that
constrain every ticket", from `apps/silt/CLAUDE.md` and ADR 0028): determinism,
row-major chunk order, `(dx, dy)`-relative `Api`, `Grid.stamp` never dirties,
4-byte cells, archetypes own movement. Every ticket keeps `pnpm lint`,
`pnpm typecheck` and `pnpm --filter silt run test` green.
