# apps/boids — scoped rules

A Reynolds boids simulator on a full-viewport canvas at `boids.homeofed.com`.
**No database** (ADR 0006) — the layered backend skeleton survives, persistence
doesn't. Visual reference: `docs/reference/boids-design/` (read its `README.md`
before touching anything under `features/controls/` or `features/sim/render/`).

## Layout

```
src/
  server/                the app's backend (runs in Node for dev/prod, in-browser for .iwft)
    store.ts             StatusStore interface + InMemoryStatusStore (the only impl, everywhere)
    handlers/            Handler classes — business logic, AppContext only
    router.ts            tRPC router; exports AppRouter type (frontend makes no tRPC calls)
    simulator.ts          backendSimulator wiring: real router + InMemoryStatusStore
    main.ts               prod entrypoint: createAppServer + InMemoryStatusStore
    health.test.ts        Vitest unit — handler with a hand-written Store fake
  features/sim/
    engine/               PURE TS — no React, no DOM, no Canvas (vector, spatialHash, params, simulation)
    render/renderer.ts    CanvasRenderer — port of the reference boids.js draw()
    themes.ts             Theme type + the 4 presets (neon default)
    settings.ts           load/save {theme, shape, params} ↔ localStorage
    useSimulationLoop.ts  hook owning the rAF loop + canvas wiring
  features/controls/      ControlPanel, Slider, ThemePicker, ShapePicker
  pages/BoidsPage.tsx     full-viewport canvas + panel
  testing/                IwftApp harness + BoidsPagePom
  boids.iwft.tsx
vite.config.ts            react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts   defineIwftConfig({ ctPort: 3102 })
```

## Commands

- `pnpm dev --filter=boids` — simulator mode on port **3001** (real router,
  in-memory store; restart to pick up server changes).
- `pnpm test --filter=boids` — Vitest (`*.test.ts`) then Playwright CT (`*.iwft.tsx`).
- Prod (container/release): `pnpm build` then `pnpm start` (default port 8080,
  see `.env.example`). No migrate step — there's nothing to migrate.

## Rules

- **Engine/React boundary:** `features/sim/engine/*` is pure TS — no React, no
  DOM, no Canvas access. `BoidsPage` holds the `Simulation` + `CanvasRenderer`
  in refs; `useSimulationLoop` drives `requestAnimationFrame`. Settings changes
  go to the engine imperatively via `sim.setParams(...)` — no engine state in
  React, no per-frame re-render.
- Visual work (panel, canvas draw, themes, shapes) recreates
  `docs/reference/boids-design/` pixel-accurately — port token *values* from
  its `styles.css`, don't copy the file; the `boids.js` `draw()` function is
  the reusable reference for `CanvasRenderer`.
- Server code changes go through TDD: unit test against `StatusStore` fake
  first, `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks
  to erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3001, CT 3102 — a copied app must pick fresh ones (root `CLAUDE.md` checklist).
- No database, no migrations, no `@hoe/db` — see [ADR 0006](../../docs/adr/0006-db-less-apps.md).
  If boids ever needs server state, re-copy hub's DB touchpoints; don't bolt
  persistence onto `InMemoryStatusStore`.
