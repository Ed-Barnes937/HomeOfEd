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

**Status:** claimed

- [ ] Painting sand while paused, then pressing play, makes it fall and pile — visibly, in the browser
- [ ] Rendering is letterboxed, crisp (no smoothing), sharp on HiDPI, margins in the `world` colour
- [ ] Window resize refits without disturbing the running sim
- [ ] `*.iwft` test covers paint → play → movement
- [ ] `pnpm lint`, `pnpm typecheck`, silt tests green
