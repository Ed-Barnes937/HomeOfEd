# apps/karesansui — scoped rules

枯山水 Karesansui, "Zen Gear Garden": an automated zen-garden canvas toy at
`karesansui.homeofed.com`. Build a gear train and press Play — each cog is a
planet rolling in the ring carrying its own single marble, and each marble
grooves its own line into a flat sand bed rendered on canvas with carved-groove
shading. N cogs → N overlapping rosettes ("many pens, one garden" — plan 0008 /
ADR 0020). An optional **clearing rake** sweeps the bed smooth and draws again
forever. **No database** (ADR 0008) — presets live in `localStorage`. Visual
reference: `reference/karasensui/project/Zen Gear Garden Studio.dc.html` (the
gear/ring/groove drawing primitives) plus the "Many pens" section of the
layout-spikes artifact (the current model); `Zen Gear Garden.dc.html` in the
same folder is unrelated exploration — see the fidelity rule below.

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
      state.ts            GardenConfig type (ring/wheels/offset/speed/showPreview/clearingRake), DEFAULT_CONFIG, offset/speed clamps
      gears.ts            ring/wheel opts, MAX_GEARS (4), gearPalette, gcd/lcm, fullTurns/prettyTurns, shade
      garden.ts           gardenCurves(config, boardR) → {curves: CogCurve[], scale} — one rosette per cog (the sand's source of truth)
      geom.ts             geom(config, boardR) → {pts,tMax,full,scale}; normals(pts) — retained only for reference / the N=1 anchor
    render/                canvas classes — own the <canvas>, never touched by engine code
      sand.ts             pure draw helpers: clipCircle, gardenBed, drawGroove, drawMarble, clearingSweep
      SandRenderer.ts     resize / renderStatic / beginCarve+carveTo / clearTo / finishCarve / toDataURL
      MechRenderer.ts     resize / setPattern(config) / draw(progress) — planetary: N cogs + marbles; getMarbles()
    settings.ts            Preset type; load/save/rename/delete presets in localStorage (`karesansui:presets:v2`, v1→v2 migration)
    useRakeLoop.ts         owns the rAF loop + both canvases: draw / pause / resume / clear / perpetual loop / export, resize rebuild
  features/controls/       StripCycle (Ring/Rake/Preview), StripRange (Offset/Speed), CogDots, ActionButtons, PresetsMenu — shared Strip.module.scss (minimal console, ADR 0021)
  pages/KaresansuiPage.tsx  holds GardenConfig state, wires useRakeLoop; room → wordmark → stage → dim console strip; sand-hero-first reflow at ~760px
  testing/                  IwftApp harness + KaresansuiPagePom
  karesansui.iwft.tsx
vite.config.ts             react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts    defineIwftConfig({ ctPort: 3107 })
```

## Commands

- `pnpm dev --filter=karesansui` — simulator mode on port **3007** (real
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
- **Geometry fidelity:** the single-wheel spirograph maths (`gardenCurves` in
  `engine/garden.ts`), the groove/marble/bed drawing in `render/sand.ts`, and
  `drawGear`/`drawRing` in `MechRenderer`, follow the Studio reference — don't
  "clean up" or re-derive the formulas. The current model is **many pens, one
  garden** (plan 0008 / [ADR 0020](../../docs/adr/0020-karesansui-many-pens-model.md)):
  each cog is an independent planet (`carrierAmp = R−wᵢ`, `a = offset·wᵢ`,
  `f = (R−wᵢ)/wᵢ`, phase `i·2π/N`) carrying one marble; the mechanism draws N
  cogs + marbles, each marble on its own gear. The **summed-cosine `geom()` and
  the epicycle arm-chain are retired** (superseded parts of ADR 0018/0019);
  `geom()` survives only as the N=1 reference. The `spiroPts`/`drawSpiro` formula
  in `Zen Gear Garden.dc.html` is a *different*, unused exploration — never port it.
- Server code changes go through TDD: unit test against `StatusStore` fake
  first, `.iwft` only for whole-page behaviour (keep it thin). Relative imports
  carry explicit `.ts`/`.tsx` extensions; server code sticks to erasable TS
  syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3007, CT 3107, compose host 8087 — a copied app must pick fresh
  ones (root `CLAUDE.md` checklist).
- No database, no migrations, no `@hoe/db` — see
  [ADR 0008](../../docs/adr/0008-apps-without-a-database.md). The `StatusStore`
  interface exists only to satisfy `createAppServer`'s `healthCheck` seam and
  keep the layered skeleton (boids' idiom — [ADR 0006](../../docs/adr/0006-db-less-apps.md)),
  not to persist anything. If karesansui ever needs server state, re-copy
  hub's DB touchpoints; don't bolt persistence onto `InMemoryStatusStore`.
