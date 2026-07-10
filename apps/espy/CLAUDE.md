# apps/espy — scoped rules

A calm, single-screen, fully client-side canvas doodling toy at
`espy.homeofed.com`: procedurally-generated ink blots on warm paper that
the user turns into little creatures with freehand lines and stamped eyes.
**No database** (ADR 0008) — the layered backend skeleton survives, persistence
doesn't, except the current drawing (mirrored to `localStorage` — see
`session.ts` below). Full spec: `.claude/tasks/espy-doodle/spec.md`;
ratified decisions: `.claude/tasks/espy-doodle/decisions.md`; divergences
from the design guide: [ADR 0016](../../docs/adr/0016-espy-doodle.md).

## Layout

```
src/
  server/                       stateless skeleton (ADR 0008) — no Store, no DB
    handlers/healthHandler.ts   Handler<void, {ok:true}, void>
    router.ts                   createTRPC<void>(), one `health` query
    simulator.ts                backendSimulator wiring: real router, no Store
    main.ts                     prod entrypoint: createAppServer + shallow /health
    health.test.ts              Vitest unit — handler exercised over the auth seam
  features/doodle/
    engine/                     PURE TS — no React, no DOM, no Canvas
      types.ts                  Op / Blot / Stroke / Eye / Point / ViewBox / Rng
      rng.ts                    mulberry32 seedable generator (deterministic tests)
      blot.ts                   generateBlot(cx,cy,r,rng[,archetype]) — 4 archetypes (blob/streak/splatter/cluster), per-type knobs in SHAPES
      field.ts                  generateField(viewBox,rng) — count/size/non-overlap placement
      eye.ts                    makeEye(x,y,base,rng)
      layout.ts                 blobCount(w,h) / blobRadiusFraction(count)
      history.ts                History (push/undo/floor), visibleOps(), currentViewBox()
      coords.ts                 computeFit(viewBox,cssW,cssH) + toLogical/toDevice
    render/surface.ts           DoodleSurface — the ONLY 2D-canvas module; blits the baked fluid raster (plain outline fallback)
    render/fluid.ts             WebGL2 stable-fluids sim — blooms seeded ink then bakes the field raster (render-layer: touches GL)
    render/fluid.helpers.ts     PURE TS — blot→splat mapping + brush archetypes (dot/peanut/bean/clump/spike/arch), no GL
    render/fluid.color.ts       PURE TS — hex→rgb01 palette helper
    render/fluid.tuning.ts      TEMP (tech debt) — tunable look knobs (DEFAULT_TUNING = shipped look) + ?tune live state
    FluidTuner.tsx/.module.scss TEMP (tech debt) — ?tune-only debug panel (live knobs + one-of-each grid)
    theme.ts                    SKETCHBOOK canvas colour literals (single fixed direction)
    session.ts                  load/save current Op[] ↔ localStorage (single slot; quota-safe, never throws)
    useDoodle.ts                hook: sizing, pointer, history, fluid bloom+bake, save, seam
    useDoodle.helpers.ts        pure glue (initialOps) — unit-testable, no DOM
  features/intro/
    IntroSplash.tsx / .module.scss   one-shot "espy" definition splash on load
                                     (~1.5s, pointer-events:none, reduced-motion aware)
  pages/DoodlePage.tsx / .module.scss   intro splash → header → canvas card → toolbar footer
  features/controls/
    Toolbar.tsx / .module.scss
    ToolToggle.tsx               Pen | Eyes
    NibPicker.tsx                3 nib dots
  styles/tokens.scss            sketchbook CSS custom properties (chrome, not canvas)
  testing/                      IwftApp harness + iwft fixture + DoodlePagePom
  doodle.iwft.tsx               whole-frontend tests via the in-browser backend + seam
  App.tsx / main.tsx / router.tsx
vite.config.ts                  react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts         defineIwftConfig({ ctPort: 3106 })
```

No `schema.ts`, `store.ts`, `migrations/`, `migrate.ts`, `drizzle.config.ts`, or
`@hoe/db` dependency — a stateless app has none of these.

## Commands

- `pnpm dev --filter=espy` — simulator mode on port **3006** (real router,
  no persistence; restart to pick up server changes).
- `pnpm test --filter=espy` — Vitest (`*.test.ts`) then Playwright CT
  (`*.iwft.tsx`, CT port **3106**).
- Prod (container): `pnpm build` then `pnpm start` (default port 8080).

## Rules

- **The one hard boundary** (spec §2, root CLAUDE §3): `features/doodle/engine/*`
  and the fluid pure helpers (`render/fluid.helpers.ts`, `render/fluid.color.ts`)
  are pure TS — no React, no DOM, no Canvas/GL access. Only `render/surface.ts`
  (2D), `render/fluid.ts` (WebGL), and `useDoodle.ts` may touch a canvas/DOM. The
  drawing itself is **not** React state (it lives in refs, projected
  imperatively) — React holds only `tool`/`nib`/`canUndo`, so a stroke never
  triggers a re-render.
- **Persistence is the one exception, not a pattern:** `session.ts` mirrors the
  *current* drawing's `Op[]` to a single `localStorage` slot so an accidental
  reload doesn't lose it. There is no gallery, no history of past drawings, no
  server-owned data — see [ADR 0016](../../docs/adr/0016-espy-doodle.md).
- Undo is command-replay (an `Op[]` History), not raster snapshots — see
  `engine/history.ts` and [ADR 0016](../../docs/adr/0016-espy-doodle.md).
- Single fixed sketchbook look (`theme.ts` + `styles/tokens.scss`) — no
  theme/mode/ink-engine switcher.
- Server code changes go through TDD: unit test against the injected seams
  first, `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3006, CT 3106.
- No database, no migrations, no `@hoe/db` — see
  [ADR 0008](../../docs/adr/0008-apps-without-a-database.md).

## Tech debt

- **`?tune` fluid tuner is still in.** `render/fluid.tuning.ts` +
  `features/doodle/FluidTuner.{tsx,module.scss}` are dev-only tooling for dialling
  in the ink-field look; the panel and the `liveDebug` grid mode mount only with
  `?tune` in the URL, so they're inert in normal use. The shipped look lives in
  `DEFAULT_TUNING`. Left in deliberately for future tuning — when the look is
  final, delete those files and fold the numbers into plain consts in
  `render/fluid.ts` / `render/fluid.helpers.ts`.
