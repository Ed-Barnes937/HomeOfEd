# silt — performance audit

**Goal:** silt holds 60 fps on a low-end laptop (the reference machine is a 2018
MacBook Air, Core i5-8210Y / UHD 617 — roughly 3–4× slower single-threaded than
a current Apple-silicon Mac, with a much weaker GPU).

That is a **16.7 ms** budget per frame, shared between:

| Stage | Owner | Today |
| --- | --- | --- |
| sim tick | `src/sim/` | 1.0–1.8 ms/tick on a fast Mac in a busy world |
| rasterise 60k cells | `features/render/renderer.ts` | ~0.10 ms/frame |
| `putImageData` + scaled `drawImage` | canvas | unmeasured, GPU-bound |
| React reconcile | `pages/HomePage.tsx` | once **per pointermove** |
| layout reads | `useSimLoop` | one `getBoundingClientRect` per pointermove |

Multiply the CPU rows by 3–4× for the reference machine and the headroom is
thin, not absent. The worst cases — a world the user has poured sand across, so
chunk sleeping stops helping — are where it breaks.

## Measured baseline

Taken on the dev machine (Apple silicon) with `apps/silt/bench/sim.bench.ts`,
1500 ticks per scenario after a 200-tick warm-up:

```
spawners + mixed world       1.039 ms/tick   scanned=7667
reaction churn               1.812 ms/tick   scanned=4553
plant growth                 1.524 ms/tick   scanned=6859
```

Rasterise loop, isolated (2000 frames, 300×200):

```
current (Uint8Clamped, 4 stores/px)   0.0957 ms/frame
packed  (Uint32,       1 store/px)    0.0301 ms/frame
```

Chunk sleeping already works well — a settled world scans a few hundred cells a
tick, not sixty thousand. **The optimisations below are all about the active
path**, where sleeping buys nothing.

## What is in scope

Every area of silt was read. Findings are grouped by layer:

- **The sim engine** (`src/sim/`) — tickets 02–05. Per-cell `Map` lookups,
  iterator allocation in the neighbour loops, repeated index arithmetic, and
  object churn in the cross-chunk move queue.
- **The renderer** (`features/render/`) — ticket 06. A four-store-per-pixel
  rasterise loop, and a full redraw every rAF even when nothing changed.
- **The input loop** (`features/sim/useSimLoop.ts`) — ticket 07. A forced
  layout read and an array-of-objects allocation on every pointer event.
- **The React tree** (`pages/HomePage.tsx`) — ticket 08. A whole-page
  reconcile per pointermove and four times a second for the FPS readout.
- **Architecture** — ticket 09, a proposal: move the sim off the main thread.

## What is deliberately out of scope

- `features/scenes/` (`sceneCodec`, `sceneStore`, `useScenes`) — save and load
  are user-initiated, once, and never on the frame path. `encodeScene` walking
  the grid is fine where it is.
- `src/server/` — one `greeting` procedure with no frontend caller.
- `letterboxFit.ts` — pure maths, called on resize and per pointer event; the
  per-event cost is a handful of arithmetic ops and is not worth touching.
- `registry.ts` **boot-time** validation — runs once, at startup.

## Rules that constrain every ticket

These come from `apps/silt/CLAUDE.md` and ADR 0028. None of them may be traded
away for speed:

1. **Determinism is not negotiable.** Same seed, same inputs → same world. The
   RNG stream must be consumed in exactly the same order and the same number of
   times. `Math.random()` stays banned under `src/sim`.
2. **Chunk order is a row-major array indexed arithmetically**, never a hash.
3. **`Api` stays `(dx, dy)`-relative.** Out of bounds reads WALL.
4. **`Grid.stamp` must never mark a chunk dirty.**
5. **The cell never widens past 4 bytes.** New per-cell state is a parallel grid.
6. **Archetypes own movement, hooks own transmutation.**
7. Every ticket keeps `pnpm lint`, `pnpm typecheck` and
   `pnpm --filter silt run test` green, including the determinism tests.

## How the predictions held up

Recorded because the audit was wrong about roughly half of what it predicted,
and the shape of the error is worth keeping.

| Prediction | Outcome |
| --- | --- |
| Registry `Map` lookups are "the largest single win available in the engine" | **Overstated.** −12% / −7% / −2% |
| Neighbour-loop iterator allocation is "a modest but free win" | **Wrong.** Null — V8 never made the allocation |
| Deferred-move object churn matters for GC | **Unproven.** Null on throughput; the allocation is genuinely gone but nothing here measures pauses |
| Index arithmetic is "a broad few-percent-each win" | **Understated.** −16% / −20% / −6%, the biggest in the series |
| Packed palette gives ~3× on the rasterise loop | **Held.** 0.0935 → 0.0287 ms/frame |
| React is "very plausibly the single largest frontend cost" | **Wrong.** 0.060 ms/move — smaller than the rasterise loop, ~20× smaller than one sim tick |

The pattern: hypotheses about *allocation and lookup theory* under V8 came in at
or near null, and the one that paid was plain arithmetic and memory-access
shape. A modern engine is better at eliding the former than at fixing the
latter.

The corollary for [ticket 09](issues/09-sim-in-a-worker.md): the 3-4x
fast-Mac-to-Air multiplier used throughout this spec is the same kind of
unmeasured extrapolation. **Measure on the reference machine before spending
anything on the worker.**

## The one correctness finding

Ticket 05 disproved a claim in the `DeferredMoves` class comment: `(dst, src)`
is not a total order over queued moves, and 132 duplicate pairs were measured
across the bench scenarios. Determinism was resting on `Array.prototype.sort`
being stable rather than on the uniqueness the comment asserted. Now explicit.
That is worth more than any of the timings above.
