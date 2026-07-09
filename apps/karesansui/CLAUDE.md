# apps/karesansui — scoped rules

枯山水 Karesansui, "Zen Gear Garden": a spirograph-as-zen-garden canvas toy at
`karesansui.homeofed.com`. Build a gear train, pick a rake head, turn the crank
— a rake carves a hypotrochoid-family pattern into a circular sand bed rendered
on canvas with carved-groove shading. **No database** (ADR 0008) — presets live
in `localStorage`. Visual reference: `reference/karasensui/project/Zen Gear
Garden Studio.dc.html` (read it before touching anything under
`features/garden/engine/` or `features/garden/render/`; `Zen Gear Garden.dc.html`
in the same folder is unrelated exploration — see the fidelity rule below).

## Layout

```
src/
  server/                the app's backend (runs in Node for dev/prod, in-browser for .iwft)
    store.ts             StatusStore interface + InMemoryStatusStore (the only impl, everywhere)
    handlers/            Handler classes — business logic, AppContext only
    router.ts            tRPC router; exports AppRouter type (frontend makes no tRPC calls)
    simulator.ts         backendSimulator wiring: real router + InMemoryStatusStore
    main.ts              prod entrypoint: createAppServer + healthCheck via store.ping
    health.test.ts       Vitest unit — handler with a hand-written Store fake
  features/garden/
    engine/               PURE TS — no React, no DOM, no Canvas
      state.ts            GardenConfig type, DEFAULT_CONFIG, offset/speed clamp helpers
      gears.ts            ring/wheel opts, MAX_GEARS, gearPalette, gcd/lcm, fullTurns/prettyTurns, shade
      geom.ts             geom(config, boardR) → {pts,tMax,full}; normals(pts) — the summed-cosine curve
      rake.ts             RakeId + rakePresets (marble/wide/deep/fine → tines/spacing/lw/spread/light)
    render/                canvas classes — own the <canvas>, never touched by engine code
      sand.ts             pure draw helpers: sandFill, clipCircle, trace, emboss, rakeStyle, rakeSegment
      SandRenderer.ts     resize / renderStatic / beginCarve+carveTo / smoothStep / finishCarve / toDataURL
      MechRenderer.ts     resize / draw(config, carrierT) — the illustrative gear-cluster drawing
    settings.ts            Preset type; load/save/delete presets in localStorage (`karesansui:presets:v1`)
    useRakeLoop.ts         owns the rAF loop + both canvases: carve/pause/resume/smooth/export, resize rebuild
  features/controls/       RingPicker, GearTrain, RakePicker, Slider, PreviewToggle, ActionButtons, SavedGardens
  pages/KaresansuiPage.tsx  holds GardenConfig state, wires useRakeLoop, the 3-col → 1-col reflow at ~900px
  testing/                  IwftApp harness + KaresansuiPagePom
  karesansui.iwft.tsx
vite.config.ts             react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts    defineIwftConfig({ ctPort: 3106 })
```

## Commands

- `pnpm dev --filter=karesansui` — simulator mode on port **3006** (real
  router, in-memory store; restart to pick up server changes).
- `pnpm test --filter=karesansui` — Vitest (`*.test.ts`) then Playwright CT
  (`*.iwft.tsx`).
- Prod (container/release): `pnpm build` then `pnpm start` (default port 8080,
  see `.env.example`). No migrate step — there's nothing to migrate.

## Rules

- **Engine/render/hook boundary:** `features/garden/engine/*` is pure TS — no
  React, no DOM, no Canvas access. `SandRenderer`/`MechRenderer` own their
  `<canvas>` and know nothing about React. `useRakeLoop` owns
  `requestAnimationFrame`, the carve/pause/smooth state machine, and the
  `ResizeObserver`. `KaresansuiPage` holds `GardenConfig` in React state and
  pushes changes into the loop imperatively via refs — no engine state lives
  in React, no per-frame re-render. Mirrors boids' engine/React split.
- **Geometry fidelity:** the `geom()`/rake/emboss math in `engine/` and
  `render/sand.ts`, and the `drawMech` cluster in `MechRenderer`, are ported
  **verbatim** from the Studio reference for a pixel-accurate visual match —
  don't "clean up" or re-derive the formulas. The mechanism drawing is
  illustrative, not physically-accurate gearing: it does not use the same pin
  formula as `geom`, and syncs to the carve only via progress `t`. See
  [ADR 0016](../../docs/adr/0016-karesansui-geometry-fidelity.md). The
  `spiroPts`/`drawSpiro` formula in `Zen Gear Garden.dc.html` is a *different*,
  unused exploration — never port it.
- Server code changes go through TDD: unit test against `StatusStore` fake
  first, `.iwft` only for whole-page behaviour (keep it thin). Relative imports
  carry explicit `.ts`/`.tsx` extensions; server code sticks to erasable TS
  syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3006, CT 3106, compose host 8086 — a copied app must pick fresh
  ones (root `CLAUDE.md` checklist).
- No database, no migrations, no `@hoe/db` — see
  [ADR 0008](../../docs/adr/0008-apps-without-a-database.md). The `StatusStore`
  interface exists only to satisfy `createAppServer`'s `healthCheck` seam and
  keep the layered skeleton (boids' idiom — [ADR 0006](../../docs/adr/0006-db-less-apps.md)),
  not to persist anything. If karesansui ever needs server state, re-copy
  hub's DB touchpoints; don't bolt persistence onto `InMemoryStatusStore`.
