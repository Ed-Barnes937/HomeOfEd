# 0002 — Boids app: tech spec + implementation plan

- **Status:** Proposed
- **Date:** 2026-07-02
- **Related:** [ADR 0001](../adr/0001-foundation.md),
  [ADR 0003](../adr/0003-spa-default-tanstack-start-opt-in.md),
  ADR 0006 (to be written in B0 — DB-less app variant),
  [phase-4 runbook](../runbooks/phase-4-go-live.md)

## 1. Summary

A new leaf app `apps/boids` at **boids.homeofed.com**: a classic Reynolds
boids simulator on a full-viewport 2D canvas, with one floating frosted-glass
settings panel (theme chips, a boid-shape picker, seven sliders) and four
preset themes defaulting to **neon**. The hub landing page gains a link to it.

**Visual reference (authoritative).** A high-fidelity design prototype lives
in [`docs/reference/boids-design/`](../reference/boids-design/) — read its
`README.md` first, and view `screenshot.png`. For everything visual (layout,
tokens, type, radii, shadows, theme palettes, boid geometry, trails, panel
behaviour) **the handoff wins over prose in this spec**. Per its README:
recreate the design in this repo's stack (React + SCSS modules); port token
*values* from `styles.css`, don't copy the files; the canvas draw code in
`boids.js` `draw()` is directly reusable, but its simulation is a static
mock — the real motion comes from this spec's engine (§4).

Decisions already made (with Ed):

| Decision | Choice |
| --- | --- |
| Backend | **No database.** Layered skeleton kept, persistence dropped (§6, ADR 0006). |
| Rendering | **Canvas 2D** + spatial hash. Count range 20–400 (per the design). |
| Theming | **4 preset themes** from the design handoff, neon default. No free-form colour pickers. |
| Look & feel | The `docs/reference/boids-design/` prototype, recreated pixel-accurately. |

Assumptions this spec makes (flagged, not asked — overrule if wrong):

- **2D**, not 3D.
- **Edges wrap** (toroidal world) — no wall avoidance.
- Theme/shape/parameter choices **persist in `localStorage`**.
- **No pause/play or reset buttons** — the design's panel is final (theme,
  shape, sliders, collapse only), so they're follow-ups, not v1.
- `prefers-reduced-motion: reduce` → render **one static frame** instead of
  animating (exactly what the prototype itself paints); the panel still works
  and repaints that frame on change.
- **No pointer interaction** (attract/flee) in v1 — listed as a follow-up.
- `min_machines_running = 0` for the Fly app (gimmick app; accepts a
  cold-start pause after idle). Flip to 1 in `fly.toml` if that annoys.

## 2. Non-goals / follow-ups

WebGL/10k+ boids, 3D, pointer attract/flee, obstacle avoidance, pause/play +
reset-to-defaults controls (not in the final design), shareable preset URLs
(that last one would reintroduce the database — it was considered and
deliberately not chosen).

## 3. App architecture

Copied from `apps/hub` per the root `CLAUDE.md` checklist, then persistence is
stripped (§6). SPA (TanStack Router + Query), SCSS modules, own UI.

```
apps/boids/src/
  server/                     minimal layered backend (§6)
    store.ts                  StatusStore interface + InMemoryStatusStore
    handlers/healthHandler.ts business logic over the interface
    router.ts                 tRPC router (health only); exports AppRouter
    simulator.ts              dispatcher: real router + InMemoryStatusStore
    main.ts                   createAppServer + InMemoryStatusStore
    health.test.ts
  features/sim/
    engine/                   PURE TS — no React, no DOM, no Canvas
      vector.ts               2D vector ops
      spatialHash.ts          uniform grid for neighbour queries
      params.ts               SimParams type, defaults, ranges, clamp
      simulation.ts           Simulation class: boids[], step(dt), setParams
    render/
      renderer.ts             CanvasRenderer: draw(sim, theme, shape, params)
                              — port of the reference boids.js draw(); reads
                              trail + speed from params
    themes.ts                 Theme type + the 4 presets (neon default)
    settings.ts               load/save {theme, shape, params} ↔ localStorage,
                              key 'boids:settings:v1' — merge stored values
                              over defaults key-by-key and clamp each;
                              garbage or unknown keys → defaults win
    useSimulationLoop.ts      hook owning the rAF loop + canvas wiring
  features/controls/
    ControlPanel.tsx           the frosted panel (top-right) + collapse↔FAB
    Slider.tsx                 label/value row + filled range track
    ThemePicker.tsx            2×2 grid of theme chips
    ShapePicker.tsx            segmented control: triangle / dot / line
  pages/BoidsPage.tsx         full-viewport canvas + panel
  testing/                    IwftApp harness + BoidsPagePom
  boids.iwft.tsx
```

**React/engine boundary.** The engine runs outside React: `BoidsPage` holds a
`Simulation` and `CanvasRenderer` in refs; `useSimulationLoop` drives
`requestAnimationFrame`. React owns the *settings* state (params + theme);
every change is pushed imperatively via `sim.setParams(...)` — no re-render
per frame, no engine state in React.

## 4. Simulation spec

Standard three-rule Reynolds model. Each step, per boid: find neighbours
within `vision` (spatial hash, cell size = vision), compute separation /
alignment / cohesion steering, weight, clamp each steering force to
`maxForce`, integrate, clamp speed to `[minSpeed, maxSpeed]`, wrap position.

The parameter set is fixed by the design handoff's `state` block (its
README, "State Management") — same keys, ranges, steps, and defaults, so the
sliders map 1:1:

| Param | Range (step) | Default | Consumed by |
| --- | --- | --- | --- |
| `count` | 20 – 400 (1) | 150 | engine |
| `speed` | 0.5 – 6 (0.1) | 2.6 | engine + renderer (streak length) |
| `separation` | 0 – 3 (0.05) | 1.3 | engine |
| `alignment` | 0 – 3 (0.05) | 1.0 | engine |
| `cohesion` | 0 – 3 (0.05) | 0.9 | engine |
| `vision` (px) | 20 – 140 (1) | 66 | engine |
| `trail` | 0 – 1 (0.01) | 0.42 | renderer only (streak length) |

All seven live in `SimParams` (1:1 with the panel and `localStorage`); the
engine ignores `trail`. `shape` (`'triangle' | 'dot' | 'line'`, default
`'triangle'`) is renderer-only state alongside the theme — never in the
engine. All values are clamped by `params.ts` on input **and** on
`localStorage` load.

Unit mapping: the design's `speed` is unitless (px/frame at 60 fps in the
prototype). The engine defines `maxSpeed = speed × 60` px/s and integrates
with real `dt`, so a given slider value looks the same at any refresh rate.
Fixed internals (not sliders): `minSpeed = maxSpeed × 0.4`, `maxForce`
derived from `maxSpeed`, separation uses a closer radius (`vision × 0.5`).

**Engine interface.** The engine is pure TS with no DOM access, so world size
and randomness are injected — this is what makes the determinism test
possible:

```ts
class Simulation {
  constructor(opts: { width: number; height: number; params: SimParams; rng: Rng })
  step(dt: number): void
  setParams(params: SimParams): void      // count changes add/remove in place
  setBounds(width: number, height: number): void  // resize: re-wrap into new bounds
  readonly boids: ReadonlyArray<{ x: number; y: number; vx: number; vy: number; colorIndex: number }>
}
type Rng = () => number  // [0,1) — prod: Math.random; tests: seeded (mulberry32)
```

The DOM side (`useSimulationLoop`) owns `ResizeObserver` and calls
`setBounds`; the engine never reads the canvas.

Robustness rules:

- `step(dt)` clamps `dt` to 33 ms — a backgrounded tab must not explode the
  flock on return.
- Determinism: same constructor opts (seeded `rng`) + same `step` sequence →
  identical `boids` state. A unit test pins this.
- Changing `count` adds/removes boids without resetting the rest of the flock.

## 5. Rendering + theming

Everything in this section is defined by `docs/reference/boids-design/` —
what follows is the map from the handoff to this codebase, not a competing
design. When in doubt, open the handoff's `README.md`, `styles.css`, and
`boids.js`, and compare against `screenshot.png`.

**Canvas.** One full-viewport `<canvas>` (`position: fixed; inset: 0`),
scaled by `devicePixelRatio`, resized via `ResizeObserver` (world size = CSS
pixels; boids re-wrap into the new bounds on resize). Each frame: clear to
the theme background, then draw every boid's trail streak + body — a direct
port of the reference `boids.js` `draw()` (gradient streak behind each boid,
**direction** from the boid's heading `atan2(vy, vx)`, **length**
`6 + trail×46 + speed×3` where `speed` is the slider param; body geometry per
shape; glow via `shadowBlur` at the theme's value). The handoff's draw code
is explicitly marked reusable; port it into `CanvasRenderer`, typed.

**Themes** — the four presets from the handoff, verbatim (full token sets in
its `styles.css` `:root` + `[data-theme]` blocks):

| id | `--bg` | `--accent` | boid palette | glow | draw mode |
| --- | --- | --- | --- | --- | --- |
| `neon` (default) | `#08080c` | `#00e6ff` | `#00e6ff` `#ff2bd6` `#8b5cff` | 14 | fill |
| `retro` | `#221436` | `#ff5d8f` | `#ff5d8f` `#ffb03a` `#39d5c6` | 9 | fill |
| `asteroids` | `#000000` | `#ffffff` | `#ffffff` `#d9e2ff` | 0 | stroke |
| `autumnal` (light) | `#f2ece0` | `#b8451f` | `#b8451f` `#d98a37` `#7c7a3a` `#9c392c` | 0 | fill |

```ts
interface Theme {
  id: 'neon' | 'retro' | 'asteroids' | 'autumnal'
  name: string
  background: string     // canvas clear colour each frame (= the theme's --bg)
  palette: string[]      // boid colours — see colour assignment below
  glow: number           // canvas shadowBlur; 0 disables
  drawMode: 'fill' | 'stroke'
}
```

**Colour assignment.** The engine assigns each boid a stable,
theme-independent `colorIndex` (sequential: boid `i` gets `i`); the renderer
maps it as `palette[colorIndex % palette.length]` — exactly what the
reference does (`pal[b.ci % pal.length]`). The modulo lives in the renderer
because palette length is theme-dependent (2–4 colours) and the engine knows
nothing about themes.

CSS tokens (`--bg`, `--accent`, `--text`, `--panel-bg`, …) live in SCSS as
`:root` / `[data-theme="…"]` blocks ported from the handoff's `styles.css`;
the `Theme` object carries only what the canvas needs. Switching theme sets
`data-theme` on `<html>` (swaps all tokens) and hands the new `Theme` to the
renderer. Unknown persisted theme id → fall back to neon.

**Boid shapes** (renderer-only, geometry from the handoff): `triangle` — path
`(6.5,0) (-5,3.7) (-2.4,0) (-5,-3.7)` rotated to heading; `dot` — circle
r≈2.7; `line` — 11px stroke with a small head circle at the tip.

**Fonts.** IBM Plex Sans (300, wordmark only) + IBM Plex Mono (400/500,
every label and value). Self-host via `@fontsource/ibm-plex-sans` +
`@fontsource/ibm-plex-mono` (import in `main.tsx`) — no Google Fonts CDN, so
CT tests stay offline-safe and prod makes no third-party requests.

**The panel.** Recreate pixel-accurately from the handoff (its README's
"Panel components" + "Design Tokens" sections have exact sizes, radii,
shadows, and the frosted-glass recipe): fixed top-right 296px `aside`, header
wordmark + `FLOCK STUDY` tag + collapse button, THEME group (2×2 chips with
swatch previews + palette dots), SHAPE group (3-button segmented control),
hairline, then the seven sliders (mono label left, mono value right, 3px
track filled to value in `--accent`, 15px thumb). Collapse hides the panel
and shows a 46×46 FAB in the same corner; the FAB restores it. Transitions
per the handoff (.15s borders/backgrounds, thumb scale 1.14 on hover). No
other chrome.

**Reduced motion.** `prefers-reduced-motion: reduce` → run one `step` and
draw a single static frame instead of animating (the prototype itself paints
exactly this); panel changes still repaint the static frame.

## 6. Backend: the DB-less variant (ADR 0006)

Boids has no server data, so it keeps the **layered skeleton** (rule 3) but
drops persistence. What changes vs `hub`:

- **Store** = `StatusStore` interface with a single `InMemoryStatusStore`
  impl (a `ping()` and a static status string). It is *both* the prod and the
  simulator store — `simulator.ts` and `main.ts` differ only in transport.
  The handler-class pattern and tRPC router shape carry over as-is; iwft gets
  **faster** (no PGlite WASM boot).
- **Three entrypoints must be rewritten, not just trimmed** — in hub each of
  them imports the deleted DB modules (`freshTestDb`, `loadMigrationsFromDir`,
  `createDbClient`/`loadDbEnv`, `hubSchema`, `migrations`,
  `DrizzleHealthStore`):
  - `server/main.ts` — drop `loadDbEnv`/`createDbClient`; construct
    `new InMemoryStatusStore()` directly; `healthCheck` closes over
    `store.ping()`.
  - `server/simulator.ts` — no migrations, no `freshTestDb`; the dispatcher
    is built over `new InMemoryStatusStore()` and is now synchronous.
  - `testing/IwftApp.tsx` — hub's version awaits
    `applyPendingSeed(await freshTestDb(...))` before building the
    dispatcher. Boids has no DB to seed, so the async IIFE goes away
    (mountApp's `seed` option is simply never used; the `failures` link and
    `testUserAuth` auth seam are DB-independent and stay):

    ```tsx
    exposeDispatcher(
      createDispatcher({
        router: appRouter,
        createContext: createContext({
          store: new InMemoryStatusStore(),
          blobs: new InMemoryBlobStore(),
          logger: new ConsoleLogger({ app: 'boids', mode: 'iwft' }),
          auth: testUserAuth,
        }),
      }),
    )
    ```
- **Deleted:** `schema.ts`, `migrations/`, `migrations.ts`, `migrate.ts`,
  `drizzle.config.ts`, `server/store.test.ts` (it tests the Drizzle store
  over PGlite + migrations — delete, don't adapt), `health.iwft.tsx`,
  `testing/HomePagePom.ts`, `features/health/` (the frontend health query
  and the status-footer UI it feeds), the `@hoe/db`, `drizzle-orm`,
  `drizzle-kit` deps, and the `generate`/`migrate` package scripts.
- **Survives, adapted:** `server/health.test.ts` (the handler-over-fake unit
  test) — retarget it at `StatusStore`; `testing/iwftTest.tsx` (fixture
  wiring — swap its `HomePagePom` import for the new `BoidsPagePom`);
  `server/store.ts` becomes the `StatusStore` interface +
  `InMemoryStatusStore`; `server/handlers/healthHandler.ts` — its `Handler`
  type parameter renames `HealthStore` → `StatusStore`; `router.tsx`
  re-points to `BoidsPage`; `trpcClient.ts` becomes unused (no frontend tRPC
  calls) — delete it.
- **Copy hygiene:** `.env.example` shrinks to `PORT` only (no
  `DATABASE_URL`); `index.html` `<title>` → `boids`; rewrite the app
  `README.md` and scoped `CLAUDE.md` for boids.
- **Added deps:** `@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono`
  (§5 fonts) — the only additions to boids' `package.json`.
- **`/health`** = `createAppServer`'s injected `healthCheck` closes over
  `store.ping()` (in-memory). It now means "process up + serving", not a DB
  round-trip. The CI smoke (health + SPA index + hashed asset) still proves
  what matters for this app: the artifact serves.
- **fly.toml:** no `release_command`, no `DATABASE_URL` secret.
- The frontend makes **no tRPC calls** (nothing to fetch); the router exists
  to satisfy `createAppServer`, keep the skeleton conventional, and leave a
  ready seam if a backend feature ever lands.

**ADR 0006** (written first, task B0) records this variant: when an app may
skip persistence, what its `/health` and smoke mean, that `hub` remains the
DB-backed reference, and that reintroducing a DB later = re-copying hub's
`db` touchpoints + runbook G4.1.

## 7. Hub change

`apps/hub/src/pages/HomePage.tsx` gains an apps section — a link card to
`https://boids.homeofed.com` (plain `<a>`; separate origin, not a router
link). Styles stay in hub's own SCSS (no shared UI). `HomePagePom` and
`health.iwft.tsx` grow an assertion that the boids link renders with the
right href.

## 8. Wiring checklist (root CLAUDE.md, adjusted for no-DB)

| # | Touchpoint | Value for boids |
| --- | --- | --- |
| 1 | App name | `apps/boids`, package name `boids` |
| 2 | Subdomain | `boids.homeofed.com` |
| 3 | Ports | dev **3001**, CT **3102** (hub=3100, packages/db=3101) |
| 4 | Fly app | `hoe-boids` in `fly.toml`; no `release_command`; `min_machines_running = 0`; fix the copied comments (the health check is an in-memory ping, not a Postgres round-trip) |
| 5 | Cloudflare | proxied CNAME `boids → hoe-boids.fly.dev`, Fly cert (human) |
| 6 | Postgres | **skipped** — ADR 0006 |
| 7 | CI | copy `deploy-hub` job → `deploy-boids`: affected check `boids`, config `apps/boids/fly.toml`, `APP_URL=https://hoe-boids.fly.dev`; drop the "release_command runs migrations" wording from the deploy step name |
| 8 | compose.yml | one `boids` service, host port **8081**, `command: node src/server/main.ts` (no migrate step), **no db service** |

**Dockerfile deltas** (copy hub's): prune/build `boids`; prod-deps filters =
`boids @hoe/backend-kit @hoe/logger` (no `@hoe/db`); runtime `COPY` only
`packages/backend-kit` + `packages/logger`. **Every hard-coded `apps/hub`
path must become `apps/boids`** — the runtime `COPY` lines, the final
`WORKDIR`, and especially the test-source `rm -rf` targets
(`apps/boids/src/testing apps/boids/src/boids.iwft.tsx` — note the renamed
iwft file). A stale `apps/hub/...` rm target is a silent no-op that ships
test code into the production image. Keep the `typescript` cleanup; the
pglite cleanup line becomes unnecessary (nothing pulls it in) but is
harmless to keep.

## 9. Implementation plan (TDD, each task ends green)

Verify loop for every task: `pnpm lint && pnpm typecheck &&
pnpm test --filter=boids` (plus `--filter=hub` for B6).

- **B0 — ADR 0006.** Write `docs/adr/0006-db-less-apps.md` (MADR-lite) per §6.
- **B1 — Scaffold.** Copy `apps/hub` → `apps/boids`; apply §8 items 1–3;
  strip persistence per §6 (including the three entrypoint rewrites and the
  deletion list — hub's health iwft/POM/query do **not** survive the copy);
  rewrite scoped `CLAUDE.md` + `README.md`; placeholder `BoidsPage`.
  *Verify:* full loop green; `pnpm dev --filter=boids` serves on 3001; a
  minimal `boids.iwft.tsx` + `BoidsPagePom` assert the placeholder page
  renders (no tRPC assertions — the frontend makes no tRPC calls, §6).
- **B2 — Engine.** `vector` → `spatialHash` → `params` → `simulation`, each
  red/green. Tests: hash returns exactly the in-radius neighbours (incl.
  across wrap); each rule steers correctly in hand-built 2–3 boid scenes;
  speed/force/dt clamps; count add/remove; seeded determinism (§4).
- **B3 — Canvas + loop.** `CanvasRenderer` (port the reference `boids.js`
  `draw()` — shapes, trail streaks, glow), `useSimulationLoop`, `BoidsPage`
  with the flock animating on neon defaults. *Verify:* iwft — page mounts,
  canvas sized, sim advances (expose boid positions on the POM via a test
  seam, assert they change between frames); by eye via `pnpm dev` against
  `screenshot.png` — **perf gate: 60 fps at count=400 (the max) on a dev
  laptop**; if `shadowBlur` can't hold that, swap the glow for a
  `globalCompositeOperation:'lighter'` double-draw and note it in the ADR.
- **B4 — Controls + persistence.** The panel per §5 (header, collapse↔FAB,
  sliders), `settings.ts`. Unit: clamping, load/save round-trip,
  garbage-in-localStorage falls back to defaults. iwft: dragging a slider
  updates readout + sim params; collapse hides the panel and the FAB
  restores it; reload restores persisted values.
- **B5 — Theming + shapes.** `themes.ts` + `ThemePicker` chips +
  `ShapePicker` + CSS-token application. Unit: the four presets match §5's
  table exactly, unknown-id fallback. iwft: clicking a chip flips
  `data-theme`/CSS tokens and marks it selected; shape buttons toggle
  `aria-pressed`; both persist across reload; reduced-motion renders a
  static frame (positions do NOT change between frames).
- **B6 — Hub link.** §7. *Verify:* hub loop green.
- **B7 — Ship wiring.** Dockerfile, `fly.toml`, compose, `deploy-boids` CI
  job (§8 items 4, 7, 8). *Verify:* `docker compose up boids` →
  `curl localhost:8081/health` ok, SPA index + asset served (mirror the CI
  smoke by hand); CI green on the PR (deploy job stays affected-gated/inert).
- **B8 — Go-live (human, §10).**

## 10. Go-live runbook (human-gated — agents stop here)

Add as a section in `docs/runbooks/` during B7 (this is the content):

```bash
fly apps create hoe-boids          # must match fly.toml
# NO fly postgres attach — ADR 0006
fly certs add boids.homeofed.com --app hoe-boids   # after first deploy
```

Cloudflare: proxied CNAME `boids → hoe-boids.fly.dev` (Full-strict TLS is
zone-wide already); grey-cloud any ACME validation record `fly certs add`
asks for.

> **⚠ Deploy-token gotcha:** the existing `FLY_API_TOKEN` GitHub secret was
> minted with `fly tokens create deploy --app hoe-hub` — it is **scoped to
> hoe-hub** and cannot deploy `hoe-boids`. Before B8, mint a token that
> covers both (e.g. an org-scoped deploy token) and replace the repo secret,
> or the `deploy-boids` job will fail auth.

Verify: `curl -fsS https://hoe-boids.fly.dev/health`, then the same via
`https://boids.homeofed.com`, then open it and push some sliders.
