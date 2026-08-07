# silt

A falling-sand cellular-automaton playground at `silt.homeofed.com`. Scaffolded
from `templates/starter` ([ADR 0007](../../docs/adr/0007-reference-starter-app.md)),
**stateless** ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) — the
simulation runs client-side and scenes live in `localStorage`, so the backend
owns nothing but `/health`.

A fixed 300×200 world of four paintable elements (dirt, sand, water, lava), one
reaction (water + lava → obsidian), continuous-emitter spawners, and scene
save/load. Spec: `.scratch/sand-sim/spec.md`.

```
HomePage → useSimLoop → Sim (typed-array grid, chunked, seeded PRNG)
                     └→ Renderer (Canvas 2D, letterboxed, pixelated)
         → useScenes → SceneStore (localStorage) → sceneCodec (pure format)
```

The engine (`src/sim/`) is headless and DOM-free; the renderer sits behind a
narrow seam so WebGL or a worker is a later drop-in, not a restructure. Engine
decisions are in [ADR 0024](../../docs/adr/0024-silt-simulation-engine.md),
persistence in [ADR 0025](../../docs/adr/0025-silt-scene-persistence.md).

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=silt` | real router, no Store (Vite middleware) |
| .iwft | `pnpm test --filter=silt` | real router in-browser, no Store |
| production | `pnpm build && pnpm start` | real router, shallow `/health` |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + shallow
`/health`). No database, no migrations. See [`CLAUDE.md`](CLAUDE.md) for
layout, engine invariants, commands, and rules.
