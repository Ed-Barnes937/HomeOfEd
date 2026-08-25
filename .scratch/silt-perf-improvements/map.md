# silt performance — map

**Spec:** [spec.md](spec.md) · **Target:** 60 fps on a 2018 MacBook Air

## Notes

The audit read every file under `apps/silt/src`. Chunk sleeping already does
the heavy lifting for settled worlds; everything here targets the **active**
path, which is what a user actually creates when they pour material about.

Tickets are sequential — each branches from and merges into
`silt-perf-improvements`, so they never collide on files.

| # | Area | Files | Status | Result |
| --- | --- | --- | --- | --- |
| 01 | committed sim benchmark | `bench/` | done | four scenarios, all still scanning |
| 02 | registry lookups off `Map` | `sim/registry.ts` | done | −12% / −7% / −2% |
| 03 | neighbour-loop allocation | `sim/lifecycle.ts`, `sim/growth.ts` | **wontfix** | null result — V8 already elides it |
| 04 | grid/chunk index arithmetic | `sim/grid.ts`, `sim/chunks.ts`, `sim/sim.ts` | done | **−16% / −20% / −6%** |
| 05 | deferred-move object churn | `sim/moves.ts` | done | null on speed; fixed a latent determinism hazard |
| 06 | renderer: packed palette + frame skip | `features/render/*` | done | 3.3× on the rasterise loop; paused draws to zero |
| 07 | pointer path: layout reads, brush offsets | `features/sim/useSimLoop.ts` | done | 2 forced layouts + 49 allocs per event → 0 |
| 08 | React re-render pressure | `pages/HomePage.tsx`, `features/render/WorldOverlay.tsx` | done | rail 73 → **0** renders per 100 moves |
| 09 | sim in a Web Worker (proposal) | architecture | needs-triage | gated on a real measurement on the Air |

## Decisions so far

- **Ticket 03 is closed `wontfix`.** Five interleaved runs put the win at 2-4%,
  inside the machine's run-to-run spread, and an `Int8Array` variant measured
  2-4% *slower* than the original. V8 escape-analyses the iterator away for a
  `for...of` over a small module-level const array, so the allocation the audit
  predicted was never being made. Recorded here so nobody re-runs it.

- **`(dst, src)` is NOT a total order over deferred moves** — ticket 05's
  premise (and the `DeferredMoves` class comment) said it was. A cell that
  queues a cross-chunk move keeps its index, so a later cell in the same chunk
  can displace it and queue from that same source. Measured: **132 duplicate
  pairs** across the bench scenarios. What actually held determinism up was
  `Array.prototype.sort` being stable. The comparator now ends in `|| a - b`
  (push order) so the ordering is total explicitly, and the class comment says
  so. This was the most valuable finding in the series and it is a correctness
  point, not a performance one.

- **The audit over-weighted allocation and lookup theory.** Tickets 02, 03 and
  05 all came in at or near null; the one that paid (04) was plain arithmetic
  and memory-access shape. Treat micro-allocation hypotheses about V8 as
  needing measurement before they earn a ticket.

- **React was not the largest frontend cost.** The audit called it "very
  plausibly the single largest"; measured, it was 0.060 ms per pointer move
  — smaller than the rasterise loop (0.096 ms/frame) and ~20x smaller than one
  sim tick. The memo work still landed (rail 73 → 0 renders per 100 moves) but
  it is a small win.

- **The imperative brush cursor was declined, on measurement.** After
  memoisation a pointer move costs 0.038 ms, of which React is 0.034 ms — the
  entire ceiling for going imperative. Under 2% of the frame budget on the
  reference machine, against moving four pieces of chrome to imperative DOM
  writes. Not worth it.

- **`Sim.paint` batching was declined, on reasoning.** A 7x7 brush spans at
  most 2x2 chunks, so the redundant `activate` calls are a few hundred integer
  comparisons — not in the class of the forced layouts ticket 07 removed. A
  second painting seam would have to track `paint`'s settled-clock and
  dirty-rect semantics forever.

- **The FPS readout now counts drawn frames, not rAF callbacks** (ticket 06),
  so a paused, untouched world honestly reads 0.

## Fog

- **Nobody has profiled silt on the reference machine.** Every number here is a
  fast-Mac measurement with a 3-4x multiplier applied by hand. That measurement
  is the precondition for ticket 09 and may close it.
- The renderer's `putImageData` + scaled `drawImage` cost on the UHD 617 is
  still unmeasured. If the budget is tight after all this, that blit is next.
- The bench's `reaction churn` scenario scans 1968 cells, well short of the
  4553 the audit's own version held — the wood slab burns out partway, so the
  row meant to stress `reactionFor` hardest measures it least. It understates
  ticket 02 in particular. Worth strengthening, then re-benching the whole
  epic branch in one pass.
- Ticket 07's DPR-change rect refresh is uncovered: Playwright CT cannot
  trigger a real `devicePixelRatio` change at runtime.
