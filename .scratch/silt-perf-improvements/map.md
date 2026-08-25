# silt performance — map

**Spec:** [spec.md](spec.md) · **Target:** 60 fps on a 2018 MacBook Air

## Notes

The audit read every file under `apps/silt/src`. Chunk sleeping already does
the heavy lifting for settled worlds; everything here targets the **active**
path, which is what a user actually creates when they pour material about.

Tickets are sequential — each branches from and merges into
`silt-perf-improvements`, so they never collide on files.

| # | Area | Files | Status |
| --- | --- | --- | --- |
| 01 | committed sim benchmark | `bench/` | ready-for-agent |
| 02 | registry lookups off `Map` | `sim/registry.ts` | ready-for-agent |
| 03 | neighbour-loop allocation | `sim/lifecycle.ts`, `sim/growth.ts` | ready-for-agent |
| 04 | grid/chunk index arithmetic | `sim/grid.ts`, `sim/chunks.ts`, `sim/sim.ts` | ready-for-agent |
| 05 | deferred-move object churn | `sim/moves.ts` | ready-for-agent |
| 06 | renderer: packed palette + frame skip | `features/render/*` | ready-for-agent |
| 07 | pointer path: layout reads, brush offsets | `features/sim/useSimLoop.ts` | ready-for-agent |
| 08 | React re-render pressure | `pages/HomePage.tsx`, `features/render/WorldOverlay.tsx` | ready-for-agent |
| 09 | sim in a Web Worker (proposal) | architecture | needs-triage |

## Decisions so far

_(appended as tickets resolve)_

## Fog

- The renderer's `putImageData` + scaled `drawImage` cost on the reference
  machine's UHD 617 is unmeasured. If ticket 06 lands and the frame budget is
  still tight, that blit is the next thing to profile.
- Nobody has profiled silt on the actual reference machine. Every number in the
  spec is a fast-Mac measurement with a 3–4× multiplier applied by hand.
