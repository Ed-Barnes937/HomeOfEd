# 04 — Renderer and painting

**What to build:** The first demoable slice: open Silt in a browser, paint
sand, press play, watch it fall. From `.scratch/sand-sim/spec.md` §3, §5.5,
§6:

- Canvas 2D renderer behind a narrow sim/renderer interface (WebGL is a
  future drop-in): sim draws into a 300×200 backing buffer (one pixel per
  cell); the on-screen canvas scales it aspect-preserving into the play area,
  **letterboxed**, smoothing off (`image-rendering: pixelated`); letterbox
  margins painted the `world` colour `#181510`
- DPR-aware backing store (`cssSize × dpr`, re-evaluated on resize/zoom);
  window resize refits the canvas only — the sim is untouched
- Render loop decoupled from the fixed-timestep sim tick
- Click/drag painting of the selected element (Dirt or Sand for now; a
  minimal element picker is fine — the real rail is ticket 07); painting
  works both paused and running
- Play/pause toggle (paused = setup mode)

An `*.iwft` whole-frontend test covers the loop: paint → play → cells move.

**Blocked by:** 03 — Sim core (headless)

**Status:** resolved

- [x] Painting sand while paused, then pressing play, makes it fall and pile — visibly, in the browser
- [x] Rendering is letterboxed, crisp (no smoothing), sharp on HiDPI, margins in the `world` colour
- [x] Window resize refits without disturbing the running sim
- [x] `*.iwft` test covers paint → play → movement
- [x] `pnpm lint`, `pnpm typecheck`, silt tests green

## Comments

Resolved in commit `bef0eca` (Sonnet agent, worktree branch merged cleanly
alongside ticket 05/06's sim work). `features/render/` — pure `letterboxFit`
maths (unit-tested, no DOM), a `palette` LUT built from the registry, and
`SimRenderer` drawing ImageData into a 300×200 backing canvas then blitting
DPR-aware/letterboxed with smoothing off, reading only a narrow
`RenderableSim` shape (the sim/renderer seam). `features/sim/useSimLoop.ts`
owns Sim + renderer + FixedTimestep: RAF renders every frame, sim ticks only
via the fixed timestep, refit on both ResizeObserver and a `resolution`
media-query watcher (zoom-only DPR changes). Starter greeting placeholder
replaced by the app shell with a minimal rail (colours read from the registry,
not hardcoded) — the real rail is ticket 07. 4 iwft cases: paint→play→settle,
paint-while-running, no-smoothing, resize-refits-without-disturbing-sim.
Orchestrator gate on the merged tree (04+05+06 together): 81 vitest + 4 iwft
green, lint/typecheck clean.

Process note: the agent correctly refused to bypass commit signing on a peer's
say-so while the 1Password agent was broken; the commit landed normally once
signing recovered.
