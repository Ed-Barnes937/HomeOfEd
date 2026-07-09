# 0006 — karesansui implementation plan

**App:** `karesansui` — "Zen Gear Garden". A spirograph-as-zen-garden toy: build a
gear train, pick a rake head, "turn the crank," and watch a rake carve a
hypotrochoid pattern into a circular sand bed rendered on canvas with
carved-groove shading. Pure client-side compute, no accounts, no server data.

**Subdomain:** `karesansui.homeofed.com` · **Fly app:** `hoe-karesansui`

**Reference (mock, not law):** `reference/karasensui/project/Zen Gear Garden
Studio.dc.html` is the design to build. `Zen Gear Garden.dc.html` is exploration
(layouts 1a/1b/1c, sand studies 2a/2b/2c) — reference only.

**Precedent app:** `apps/boids` is the near-exact structural precedent — a
canvas toy, no DB, localStorage settings, pure-engine / renderer / hook /
React-controls split. Copy its shape wherever this plan is silent.

---

## 1. Decisions (settled in grill-me — do not relitigate)

| # | Decision |
|---|---|
| D1 | Build the **Studio 3-column** design. Other file is reference only. |
| D2 | **Stateless** (ADR 0008). Presets → `localStorage`. Backend is a health-only skeleton, no DB, no `@hoe/db`. |
| D3 | **Port the reference geometry/canvas math as-is** (visual match per the handoff README). The left-panel mechanism drawing stays *illustrative*, not physically-accurate gearing. |
| D4 | Document a **V2** in an ADR: a future engine could model true gear meshing so the sand curve derives from real ratios. Out of scope here. |
| D5 | **Responsive reflow.** Desktop = 3-col device card. Below **~900px** → single column, order **sand → mechanism → rake**. One breakpoint. |
| D6 | Canvases are **fluid, capped at design size** (bowl ≤524px, mech ≤262px). Resize rebuilds geometry + redraws current state (preview or carved) — **no re-animation on resize**. |
| D7 | Mobile controls: **plain vertical scroll**, everything visible. No drawer/collapse. |
| D8 | **All mock features in scope**: ring picker, gear-train add/remove (max 3), pin offset, speed, rotations, 4 rake heads, preview toggle, Run/Pause/Resume, Smooth, Save/load/delete presets, Export PNG. |
| D9 | **Full deploy scaffolding** written (Dockerfile, fly.toml, deploy.yml job, compose service). Real infra (`fly apps create`, Cloudflare) stays human-gated. |
| D10 | **Testing**: TDD the pure engine + settings as `*.test.ts`; thin `*.iwft` whole-page smoke. Canvas pixels not asserted. |
| D11 | Export filename `karesansui.png`. Fonts **self-hosted** `.woff2` (Spectral + Instrument Sans). Single warm-sand theme, no dark mode. Default state ported verbatim (ring 96, one 52-cog, offset 0.66, wide rake, speed 58, ~13 turns, preview on). |

**Naming note:** the git branch is `karasensui` (misspelling). The app dir,
package, subdomain, and Fly app all use the correct **`karesansui`**. UI display
text keeps `枯山水 Karesansui`.

---

## 2. Wiring reference values (unique per app — use exactly these)

| Touchpoint | Value |
|---|---|
| App dir / package name | `karesansui` |
| Dev port (`package.json` dev script) | **3006** |
| CT port (`playwright-ct.config.ts` `ctPort`) | **3106** |
| Compose host port | **8086**`:8080` |
| Fly app (`fly.toml` `app`) | `hoe-karesansui` |
| Subdomain | `karesansui.homeofed.com` |
| localStorage key | `karesansui:presets:v1` |

Ports in use today: dev `3000–3005`, CT `3100–3105`, compose host `8080–8085`.
3006 / 3106 / 8086 are the next free.

---

## 3. Architecture & target file tree

Mirror boids. Hard boundary: **`features/garden/engine/*` is pure TS — no React,
no DOM, no Canvas.** Renderers own canvas; the hook owns rAF + lifecycle; React
owns state and pushes changes imperatively.

```
apps/karesansui/
  package.json            name=karesansui, dev --port 3006
  index.html              <title>Zen Gear Garden</title>, self-host font <link> removed (use @font-face)
  fly.toml                app='hoe-karesansui'
  Dockerfile              filters swapped starter→karesansui
  playwright-ct.config.ts ctPort:3106
  vite.config.ts          react + simulatorPlugin (unchanged from starter)
  vitest.config.ts        (unchanged)
  eslint.config.js        (unchanged)
  tsconfig.json           (unchanged)
  CLAUDE.md               scoped rules (new)
  README.md               app readme (new)
  public/fonts/           spectral-*.woff2, instrument-sans-*.woff2
  playwright/index.html
  playwright/index.ts
  src/
    main.tsx              (unchanged from starter)
    App.tsx               (unchanged)
    router.tsx            single index route → KaresansuiPage
    trpcClient.ts         (unchanged; frontend makes no tRPC calls, kept for parity)
    server/
      store.ts            StatusStore + InMemoryStatusStore (copy boids)
      handlers/healthHandler.ts   (copy boids)
      router.ts           t.router({ health })
      simulator.ts        real router + InMemoryStatusStore
      main.ts             createAppServer, healthCheck via store.ping
      health.test.ts      handler unit test w/ Store fake
    features/garden/
      engine/
        gears.ts          ringOpts/wheelOpts/MAXGEARS/gearPalette/gcd/lcm/fullTurns/prettyTurns
        geom.ts           geom(config, boardR) → {pts,tMax,full}; normals(pts)
        rake.ts           RakeId + rakePresets + rakeStyle inputs
        state.ts          GardenConfig type + DEFAULT_CONFIG + clamp helpers
        gears.test.ts
        geom.test.ts
        rake.test.ts
      render/
        sand.ts           pure draw helpers: sandFill, clipCircle, trace, emboss, rakeSegment, shade
        SandRenderer.ts   class: resize / renderStatic / beginCarve+carveTo / smoothStep / toDataURL
        MechRenderer.ts   class: resize / draw(config, carrierT)  (drawRing/drawGear/drawMech)
        sand.test.ts      (shade + geometry-adjacent pure helpers only)
      settings.ts         Preset type, load/save/delete presets (localStorage), name formatting
      settings.test.ts
      useRakeLoop.ts      rAF loop, carve-synced-to-mech, pause/resume/abort/invalidate, smooth, test seam
    features/controls/
      RingPicker.tsx / .module.scss
      GearTrain.tsx / .module.scss      (train chips + wheel dock)
      RakePicker.tsx / .module.scss
      Slider.tsx / .module.scss         (offset / speed / rotations)
      PreviewToggle.tsx / .module.scss
      ActionButtons.tsx / .module.scss  (Run/Pause · Smooth · Save · Export)
      SavedGardens.tsx / .module.scss
    pages/
      KaresansuiPage.tsx
      KaresansuiPage.module.scss        (3-col grid + reflow)
    styles/
      tokens.scss                       warm-sand palette + fonts
    testing/
      IwftApp.tsx
      iwftTest.tsx
      KaresansuiPagePom.ts
    karesansui.iwft.tsx
```

---

## 4. Shared contracts (freeze these first — they unblock parallel work)

Every downstream task codes against these signatures. **Task E1 writes this
file (`engine/state.ts`) and the type stubs before anything else starts.**

```ts
// engine/state.ts
export type RakeId = 'marble' | 'wide' | 'deep' | 'fine'

export interface GardenConfig {
  ring: number        // one of ringOpts(): 96 | 120 | 144
  wheels: number[]    // 1..3 entries, each in wheelOpts()
  offset: number      // pin offset, 0.08..0.94 (the "r" value)
  rake: RakeId
  speed: number       // 0..100 (maps to carve duration)
  turns: number       // 1..fullTurns
  showPreview: boolean
}

export const DEFAULT_CONFIG: GardenConfig = {
  ring: 96, wheels: [52], offset: 0.66, rake: 'wide',
  speed: 58, turns: 13, showPreview: true,
}
// turns is re-derived to prettyTurns() on config changes that alter fullTurns.
```

```ts
// engine/geom.ts
export interface Geom { pts: [number, number][]; tMax: number; full: number }
export function geom(config: GardenConfig, boardR: number): Geom
export function normals(pts: [number, number][]): [number, number][]
```

```ts
// engine/gears.ts
export function ringOpts(): number[]        // [96,120,144]
export function wheelOpts(): number[]       // [24,30,36,45,52,63]
export const MAX_GEARS = 3
export function gearPalette(teeth: number): [string, string]  // [light, dark]
export function gcd(a: number, b: number): number
export function lcm(a: number, b: number): number
export function fullTurns(ring: number, wheels: number[]): number   // 1..200
export function prettyTurns(ring: number, wheels: number[]): number // min(fullTurns,40)
```

```ts
// engine/rake.ts
export interface RakePreset { tines: number; spacing: number; lw: number; spread: number; light: number }
export function rakePresets(): Record<RakeId, RakePreset>
```

```ts
// render/SandRenderer.ts
export class SandRenderer {
  constructor(canvas: HTMLCanvasElement)      // dpr cap 2, same __init pattern as reference cv()
  resize(cssSize: number, dpr: number): void  // square canvas; rebuild backing store
  renderStatic(geom: Geom, showPreview: boolean): void  // sandFill + optional faint preview line
  beginCarve(geom: Geom, rake: RakeId): void   // resets internal cursor, clips, fills sand
  carveTo(progress: number): void              // draw rake segments from last→progress (0..1)
  smoothStep(progress: number): void           // sweep board leveling sand (0..1)
  finishCarve(): void                          // restore ctx state; mark carved
  toDataURL(): string                          // PNG data url of current sand
}
```

```ts
// render/MechRenderer.ts
export class MechRenderer {
  constructor(canvas: HTMLCanvasElement)       // dpr cap 2
  resize(cssSize: number, dpr: number): void
  draw(config: GardenConfig, carrierT: number): void  // drawRing + cog cluster + pin/rake indicator
}
```

```ts
// useRakeLoop.ts
export interface UseRakeLoopOptions {
  sandRef: RefObject<HTMLCanvasElement | null>
  mechRef: RefObject<HTMLCanvasElement | null>
  config: GardenConfig
  running: boolean          // driven by Run/Pause button state
  onCarveComplete(): void   // hook tells page to flip running=false when carve finishes
}
export const RAKE_TEST_SEAM_KEY = '__karesansuiTestSeam'
export interface RakeTestSeam {
  getProgress(): number     // 0..1 carve progress, for .iwft to assert advance
  getConfig(): GardenConfig
  isCarved(): boolean
}
export function useRakeLoop(opts: UseRakeLoopOptions): {
  smooth(): void            // imperative: run the smoothing sweep
  exportPNG(): void         // toDataURL → download karesansui.png
}
```

```ts
// settings.ts
export interface Preset { name: string; ring: number; wheels: number[]; offset: number; rake: RakeId; turns: number; speed: number }
export function loadPresets(storage: Pick<Storage,'getItem'|'setItem'>): Preset[]  // never throws; garbage→[]
export function savePreset(config: GardenConfig, presets: Preset[], storage): Preset[] // append, cap 8, persist, return next
export function deletePreset(index: number, presets: Preset[], storage): Preset[]
export function presetName(config: GardenConfig): string  // `${ring}·${wheels.join('·')} ${rake[0].toUpperCase()}`
```

---

## 5. Reference-porting map

The Studio file (`Zen Gear Garden Studio.dc.html`) is authoritative for the
math. Port these functions verbatim (adjust only to TS/module form). **Do not
substitute the classic `spiroPts`/`drawSpiro` from the exploration file** — the
Studio uses a different generalized-epicyclic formula and that difference is the
look.

| Target | Source in `Zen Gear Garden Studio.dc.html` | Notes |
|---|---|---|
| `gears.ts` gcd/lcm/fullTurns/prettyTurns | `gcd`, `lcm`, `fullTurns`, `prettyTurns` | fullTurns clamps to `[1,200]`; prettyTurns to `min(full,40)`. |
| `gears.ts` opts/palette | `ringOpts`, `wheelOpts`, `MAXGEARS`, `gearPalette`, `shade` | palette is a teeth→`[c0,c1]` map. |
| `geom.ts` geom/normals | `geom(boardR)`, `normals` | the summed-cosine epicyclic; scales to `boardR/(maxReach*1.03)`; point count `max(400,min(8000,…))`. |
| `sand.ts` | `sandFill`, `clipCircle`, `trace`, `emboss`, `rakeSegment`, `rakeStyle` | emboss = shadow+highlight+groove strokes; rakeSegment offsets N tines along normals. |
| `SandRenderer` | `cv`, `buildTrace`, `renderPreview`, `startRake`/`rakeTick`, `smooth`, `exportImg` | reshape into resize/renderStatic/beginCarve/carveTo/smoothStep/toDataURL. Keep the DPR-cap-2 `cv()` init. |
| carve duration curve | `startRake`: `1500 + Math.pow((100-speed)/100,1.7)*30000` | brisk ≈1.5s → meditative ≈31s. Lives in the hook. |
| `MechRenderer` | `drawRing`, `drawGear`, `drawMech` | `drawMech(t)` is the illustrative cluster + pin + rake-head indicator; sync `t` to carve progress via `G.tMax * progress`. |
| labels/values | `renderVals` | speed label slow/steady/brisk; offsetLabel `x.xx r`; patternLabel; addHint at max. |
| defaults | `constructor` state | see D11. Note the reference key is `zgg_presets_v3`; we use a fresh `karesansui:presets:v1`. |

**Behaviour to preserve (from the reference logic):**
- Changing ring / wheels / offset / turns / rake → `invalidate`: abort any run,
  reset `running/paused/smoothing=false`, re-derive `turns=prettyTurns()`,
  redraw preview. Speed change does **not** invalidate (only affects next run).
- Run button cycles: idle → carving → (Pause) paused → (Resume) carving →
  complete → idle (re-run re-carves fresh). Run is disabled/again during smoothing.
- Preview toggle only affects the faint guide line drawn under static/preview state.
- Smooth: sweep a fresh sand fill left→right over the carved board (~1.55s),
  with the pushed-sand shadow + bright lip + trailing comb overlay.
- Export: `karesansui.png` from the sand canvas only.
- Presets cap at 8 (`slice(-8)`); train max 3 cogs; wheel chips dim to 0.32 when at max.

---

## 6. Task breakdown

Vertical-ish slices with explicit deps. **Owner** is a suggestion for the
Opus/Sonnet split (Opus = the geometry/canvas port + the rAF hook; Sonnet =
scaffold, controls, tests, docs). Each card lists files, the definition of done,
and its verify command.

Every task ends green on:
```bash
pnpm lint && pnpm typecheck && pnpm test --filter=karesansui
```

### Phase 0 — Scaffold to a green baseline · **Owner: Sonnet** · deps: none

**T0.1 Copy + rename.** `cp -r templates/starter apps/karesansui`, then apply
every touchpoint in §2 (package.json name+`--port 3006`, index.html `<title>`,
playwright-ct `ctPort:3106`, fly.toml `app='hoe-karesansui'`, Dockerfile
filters/paths `starter`→`karesansui`).

**T0.2 Health skeleton (replace the greeting demo).** Copy boids'
`server/store.ts` (StatusStore + InMemoryStatusStore, message e.g. `'garden is
up'`), `handlers/healthHandler.ts`, wire `router.ts` to `t.router({ health })`,
`simulator.ts` + `main.ts` to inject the store and use `store.ping` as the
health check. Delete the greeting handler/query/test/page bits. Keep
`trpcClient.ts` for parity (frontend makes no calls).

**T0.3 Deploy wiring.** Add `compose.yml` `karesansui` service (context `.`,
`apps/karesansui/Dockerfile`, `command: node src/server/main.ts`, port
`8086:8080`, no DB). Add `.github/workflows/deploy.yml` `deploy-karesansui` job
by cloning `deploy-boids` (swap `APP_URL=https://hoe-karesansui.fly.dev`, the
affected `select(.name == "karesansui")`, `--config apps/karesansui/fly.toml`).

**DoD:** app builds, `/health` skeleton passes, verify loop green with a
placeholder page. This is the green baseline everything branches from.

### Phase 1 — Pure engine (TDD) · **Owner: Opus** · deps: T0.1

**T1.0 Contracts.** Write `engine/state.ts` (§4) first and commit the type
stubs for `geom.ts`/`gears.ts`/`rake.ts` so Phase 2 & 4 can compile against them.

**T1.1 `gears.ts`.** Port gcd/lcm/fullTurns/prettyTurns/opts/palette/shade.
Tests: gcd/lcm known pairs; `fullTurns(96,[52])`, `(120,[45])`, multi-wheel
combos match the formula and clamp to `[1,200]`; `prettyTurns` caps at 40;
palette returns known pair for each wheel size and a fallback otherwise.

**T1.2 `geom.ts`.** Port `geom` + `normals`. Tests: returned `pts` all satisfy
`hypot(x,y) ≤ boardR` (within the `*1.03` fit tolerance); point count within
`[400,8000]` and scales with `turns`; `full` equals `fullTurns`; `normals`
returns unit-length vectors and length matches `pts`.

**T1.3 `rake.ts`.** Port `rakePresets` (marble/wide/deep/fine → tines/spacing/
lw/spread/light). Test: tine counts are 1/4/3/7 and all fields present.

**DoD:** engine is pure (grep the dir for `document`/`window`/`canvas` → none),
tests green.

### Phase 2 — Canvas renderers · **Owner: Opus** · deps: T1.0–T1.3

**T2.1 `sand.ts`.** Port pure helpers: `sandFill`, `clipCircle`, `trace`,
`emboss`, `rakeSegment`, `rakeStyle`, `shade`. Small unit tests only where pure
(`shade` clamps 0–255; `rakeSegment` line-count = tines). Drawing correctness is
visual — not asserted.

**T2.2 `SandRenderer.ts`.** Class per §4 API. Reshape the reference's
`buildTrace`/`renderPreview`/`startRake`+`rakeTick`/`smooth`/`exportImg` into
`resize`/`renderStatic`/`beginCarve`+`carveTo`/`smoothStep`/`finishCarve`/
`toDataURL`. Keep DPR-cap-2 init. `resize` rebuilds the backing store and the
caller re-invokes `renderStatic`/redraw (no animation on resize — D6). Tests:
`toDataURL()` returns a `data:image/png` string; `resize` sets backing store to
`cssSize*dpr`.

**T2.3 `MechRenderer.ts`.** Class per §4. Port `drawRing`/`drawGear`/`drawMech`.
`draw(config, carrierT)` renders the ring, the auto-scaled cog cluster spun by
`carrierT`, the arm, pin, and the rake-head indicator (marble dot vs tine bar
per `rakePresets`). Visual — minimal asserts (draw does not throw for 1/2/3-cog
configs and each ring size).

**DoD:** renderers compile against engine types; the pure helpers' tests green.

### Phase 3 — Hook + settings · **Owner: Opus (hook) / Sonnet (settings)** · deps: Phase 1–2

**T3.1 `settings.ts` (TDD, Sonnet — can start after T1.0, parallel to Phase 2).**
Preset load/save/delete against `karesansui:presets:v1`, `presetName` formatting,
cap 8, garbage-tolerant load (mirror boids `loadSettings` validation style).
Tests: roundtrip; garbage/missing → `[]`; cap at 8 keeps newest; delete by index;
name format.

**T3.2 `useRakeLoop.ts` (Opus).** Owns the rAF loop and both canvases via refs.
Builds `Geom` from `config` at the sand canvas' current board radius; on
`running` true → `beginCarve` then tick `carveTo(progress)` while syncing
`mech.draw(config, tMax*progress)`; on complete calls `onCarveComplete()`. Pause
= cancel rAF and hold elapsed; resume = continue. Any `config` change =
invalidate (abort, redraw static preview). Speed→duration curve from §5.
`smooth()` and `exportPNG()` returned as imperative handles. ResizeObserver on
the sand canvas rebuilds geometry and redraws current state (preview or the
carved final) without animating. Expose `RAKE_TEST_SEAM_KEY` on the sand canvas
(`getProgress`/`getConfig`/`isCarved`) — the boids test-seam pattern.

**DoD:** settings tests green; hook compiles and drives a manual page without
errors (validated by the Phase 5 `.iwft`).

### Phase 4 — React controls + page + reflow · **Owner: Sonnet** · deps: Phase 3 (contracts from T1.0 + hook API)

**T4.1 Tokens + fonts.** `styles/tokens.scss` with the warm-sand palette
(`#3a2c1c` ink, `#a07a4a`/`#b08a54` labels, `#c9a24b` accent, sand gradients,
wood gradients from the mock). Self-host Spectral + Instrument Sans in
`public/fonts/` with `@font-face`; remove the Google Fonts `<link>` from the
mock. Fonts: Spectral 300/400/500/600, Instrument Sans 400/500/600.

**T4.2 Control components.** One per §3 tree, each porting the corresponding
mock markup/styles. `Slider` is reused for offset/speed/rotations (label +
right-aligned value + range with the gold fill gradient). `GearTrain` = removable
train chips + the wheel dock (dim at max, `addHint`). `RakePicker` = 4 cards with
marble-dot / tine-bar glyphs and selected state. `SavedGardens` = preset pills
with load + delete. `ActionButtons` = Run/Pause (label from running/paused),
Smooth, Save, Export. Give every interactive element a stable `data-testid` +
`aria-label`/`aria-pressed` for the POM.

**T4.3 `KaresansuiPage.tsx` + layout.** Holds `GardenConfig` state
(`useState(DEFAULT_CONFIG)`), preset list state, and `running` state. Wires
`useRakeLoop`. Config setters apply the invalidate semantics (re-derive
`prettyTurns` where relevant). Two `<canvas>` refs (sand, mech). CSS grid:
desktop 3-col (`312px | 1fr | 320px`) inside a centered device card with the
plywood texture + radial page background; **at `max-width: 900px`** collapse to
one column with DOM/visual order **sand → mechanism → rake** (use grid
`order`/template areas so source order can stay logical). Canvases sized fluid
via `aspect-ratio:1` + `max-width` caps (bowl 524, mech 262); a `ResizeObserver`
(in the hook) keeps backing store in sync.

**DoD:** `pnpm dev --filter=karesansui` on :3006 renders the studio, all controls
work, Run carves, Smooth/Save/Export/presets work, resizing the window reflows
and keeps the pattern.

### Phase 5 — `.iwft` + POM · **Owner: Sonnet** · deps: Phase 4

**T5.1 Harness.** `testing/IwftApp.tsx` (copy boids — real router +
InMemoryStatusStore), `testing/iwftTest.tsx`, `testing/KaresansuiPagePom.ts`.

**T5.2 `karesansui.iwft.tsx`.** Whole-page smokes (thin — logic is unit-tested):
page renders sized sand + mech canvases; selecting a ring updates its label and
resets preview; adding a cog updates the train label and disables adds at 3;
removing a cog; dragging offset/speed/rotations updates readouts; picking a rake
head marks it selected; **Run advances the carve** (test seam `getProgress`
increases, then `isCarved` true on complete); Smooth runs; Save adds a preset
pill and persists to localStorage; load + delete a preset; Export triggers a
`karesansui.png` download; **at a narrow viewport the layout is single-column
with sand first**.

**DoD:** `pnpm test --filter=karesansui` green (vitest + CT).

### Phase 6 — Docs + ADR · **Owner: Sonnet** · deps: all

**T6.1 Scoped docs.** `apps/karesansui/CLAUDE.md` (engine/React boundary, ports
3006/3106, no-DB reminder, reference pointer, V2 note) and `README.md`
(commands, layout, what it is).

**T6.2 ADR 0016.** `docs/adr/0016-karesansui-geometry-fidelity.md` (MADR-lite):
decision to port the reference epicyclic math verbatim for visual fidelity and
treat the mechanism drawing as illustrative; **V2** option = model physically
accurate gear meshing so the sand curve derives from true ratios; consequences /
why deferred.

**DoD:** docs present and accurate; root `CLAUDE.md` "Adding an app" checklist
items all satisfied.

---

## 7. Dependency graph / parallelization

```
T0.1 ─┬─> T0.2 ─┐
      └─> T0.3   ├─> (baseline green)
                 │
T1.0 (contracts) ─┬─> T1.1,T1.2,T1.3 ─┬─> T2.1,T2.2,T2.3 ─┐
                  └─> T3.1 (settings) ─┘                   ├─> T3.2 (hook) ─> T4.* ─> T5.* ─> T6.*
```

- **T1.0 is the gate** for parallel work: land the contracts, then Opus takes the
  engine→renderer→hook column while Sonnet runs T3.1 (settings) and pre-builds
  T4.1/T4.2 control shells against the frozen types.
- T0.3 (deploy wiring) is independent and can land any time after T0.1.

---

## 8. Risks & watch-items

- **`fit()` transform vs reflow (D5/D6).** The mock scales one fixed 1200×824
  node. We are *not* porting `fit()`; we rebuild as a responsive grid with fluid
  canvases. This is the biggest divergence from the mock — the canvas sizing +
  ResizeObserver rebuild (T2.2 + T3.2) is where bugs will hide. Redraw-on-resize
  must reproduce the current state (preview vs carved) without re-animating.
- **Two curve maths in the bundle.** Only the Studio's `geom()` is authoritative.
  Reviewers will see `spiroPts`/`drawSpiro` in the other file — ignore them.
- **Mechanism/sand decoupling.** `drawMech` is decorative and does not use the
  same pin formula as `geom`. Keep them independent; sync only via progress `t`.
- **Native Node TS (ADR 0004).** `server/*.ts` must stick to erasable syntax and
  explicit `.ts`/`.tsx` import extensions, like boids.
- **Infra is human-gated.** Writing fly.toml/Dockerfile/compose/CI is in scope;
  `fly apps create`, `fly postgres`, Cloudflare DNS/cert are not — hand to the
  human via the go-live runbook.
```
