# Tech spec — cursor force + cursor glyph + pull-range field

**App:** `apps/boids` · **Status:** proposed · **Author:** (agent draft)

## 1. What we're building

Three linked additions to the boids simulator:

1. **Cursor force** — a bipolar slider `cursor` in the sidebar. Negative =
   repulsive (boids flee the pointer), positive = attractive (boids swarm the
   pointer), `0` = off. The pointer becomes a steering influence in the
   simulation while it's over the canvas.
2. **Cursor glyph** — an optional little icon that follows the mouse. Three
   modes: **off**, **ring** (a plain circle), **creatures** (a berry when the
   force is attractive, a cat when it's repulsive). The berry/cat pairing is
   the semantic hook — birds swarm a berry, birds scatter from a cat.
3. **Pull-range field** — a gentle radial colour gradient centred on the
   pointer, sized to the influence radius, that fades out to nothing at the
   edge so you can see how far the force reaches. Shown only while the force is
   active. Tinted by sign (warm for attract, cool for repel).

## 2. Design decisions

| Decision | Choice | Why |
|---|---|---|
| Where the force lives | New signed field `cursor` on `SimParams` | It's a force slider like the others; rides the existing `clampParams` → `setParams` → persistence path with the least new code. |
| Force shape | Radius-limited steer via the existing `addSteer`, linear falloff to 0 at the edge | Reuses the Reynolds steering already in `step()`; a local field is more controllable than a global pull. Blends and clamps like every other rule. |
| Pointer → engine | `sim.setPointer(p | null)`, fed each frame from a ref | Mirrors the "settings pushed into the engine imperatively" rule. Engine stays pure TS — it receives world-space coords, never touches the DOM. |
| Glyph rendering | DOM overlay element, not canvas draw | Independent of the rAF loop, so it tracks the cursor even under `prefers-reduced-motion` (frozen sim). Easy to theme via CSS/SVG. Kept as one pointer listener (below). |
| Pull-range field | Same DOM overlay, a sibling `div` with a CSS `radial-gradient` background sized `2 × CURSOR_RADIUS` | Reuses the one overlay + one pointer listener. CSS gradient = zero canvas/render cost; the soft edge mirrors the physics linear falloff for free. |
| Radius single source | Export `CURSOR_RADIUS` from the engine; the field sizes itself from it | The visual ring and the physics radius must not drift — one constant feeds both. |
| One pointer listener | `useSimulationLoop` owns it; updates the physics ref **and** the overlay node's transform imperatively | No second subscription, no per-frame React re-render — same discipline as the rest of the loop. |
| Glyph style enum | `cursorIcon: 'off' | 'ring' | 'creatures'` on `Settings` | Mirrors `shape` exactly (picker + persistence + validation). |

**Metaphor / theming:** berry and cat are fixed semantic glyphs (attract vs
repel), not per-visual-theme art. They inherit colour from CSS tokens so they
sit correctly on each of the four themes.

## 3. Engine changes (pure TS)

### `features/sim/engine/params.ts`

Add `cursor` to `SimParams`, ranges, and defaults:

```ts
cursor: { min: -3, max: 3, step: 0.05 }   // PARAM_RANGES
cursor: 0                                  // DEFAULT_PARAMS  (off)
```

`clampParams` already handles arbitrary min/max, so a signed range needs no
special-casing. Update the "seven flocking parameters" comment to eight.

### `features/sim/engine/simulation.ts`

- New private state: `private pointer: { x: number; y: number } | null = null`.
- `setPointer(p: { x: number; y: number } | null): void` — store it.
- **Exported** tuned constant (not a slider):
  `export const CURSOR_RADIUS = 180` (px) — the influence radius, linear
  falloff. Exported so the pull-range field (§5) sizes itself to the exact same
  number the physics uses.
- Apply the cursor steer **inside `steerFor`** (not between the two loops in
  `step()`). `steerFor` already has `index`, `boid`, `maxSpeed`, and `maxForce`
  in scope and already accumulates into `forceX/forceY[index]` via `addSteer`;
  the standalone-loop version would reference `i`/`boid` that don't exist
  between the steer and integration loops. Add at the end of `steerFor`, gated
  on `this.pointer` set **and** `this.params.cursor !== 0`:

```ts
// steerFor(index, …): boid, maxSpeed, maxForce already in scope
if (this.pointer && this.params.cursor !== 0) {
  const dx = this.pointer.x - boid.x
  const dy = this.pointer.y - boid.y
  const dist = Math.hypot(dx, dy)
  if (dist > 0 && dist < CURSOR_RADIUS) {
    const falloff = 1 - dist / CURSOR_RADIUS          // 1 at cursor → 0 at edge
    const sign = Math.sign(this.params.cursor)         // +1 attract, −1 repel
    this.addSteer(index, dx * sign, dy * sign,
                  Math.abs(this.params.cursor) * falloff, maxSpeed, maxForce)
  }
}
```

`steerFor` is called from the steer loop while every boid still holds its
snapshot position/velocity, so cursor force blends with flocking under the same
snapshot-then-integrate discipline. Cursor force depends only on the pointer and
the boid's own position — no neighbour reads — so there's no snapshot hazard.

Notes:
- Use **direct** (non-wrapped) delta — the cursor is a screen-anchored point in
  a viewport-sized world, so wrapping distance would be unintuitive.
- `addSteer` normalises direction and clamps to `maxForce`; weight on the same
  0–3 scale as cohesion, so it blends naturally and never breaks integration
  (velocity is clamped to `maxSpeed` regardless).
- Add `getPointer()` for the test seam (optional — see §6).

## 4. Settings + persistence

### `features/sim/settings.ts`

```ts
export type CursorIcon = 'off' | 'ring' | 'creatures'

interface Settings { theme; shape; cursorIcon: CursorIcon; params }
DEFAULT_SETTINGS.cursorIcon = 'ring'
```

- Add `CURSOR_ICONS` list + `isCursorIcon` guard (copy the `isShape` pattern).
- In `loadSettings`, add `cursorIcon: isCursorIcon(record.cursorIcon) ? … : default`.
- **Keep `STORAGE_KEY = 'boids:settings:v1'`** — the change is additive; a v1
  blob with no `cursorIcon` falls back to the default, and `cursor` rides in on
  `clampParams(record.params)` at `0`. No migration needed.

## 5. UI

### `features/controls/ControlPanel.tsx`

- Add a `cursor` entry to `SLIDER_SPECS`. Bipolar format, e.g.
  `format: (v) => (v === 0 ? 'off' : (v > 0 ? '+' : '') + v.toFixed(2))`.
  Place it after `vision`/`trail` (or wherever reads best).
- Add props `cursorIcon` + `onCursorIconChange`; render a new
  `CursorIconPicker` under a `cursor` group label (next to shape).

### `features/controls/CursorIconPicker.tsx` + `.module.scss` (new)

Segmented control, a near-copy of `ShapePicker`: three buttons
(`off` / `ring` / `creatures`) with small inline SVG icons, `aria-pressed`,
`aria-label`. Reuse `ShapePicker.module.scss` styling conventions.

### `features/controls/CursorGlyph.tsx` (new)

Presentational SVG. Props: `variant: 'ring' | 'berry' | 'cat'` plus
pass-through `data-*` attrs (spread onto the root `<svg>` so the parent's
`data-testid`/`data-variant` reach the DOM for tests). Returns the matching
inline SVG, `fill`/`stroke: currentColor` so CSS tokens theme it. `ring` is a
stroked circle; `berry` and `cat` are simple single-path glyphs. (`off` renders
nothing — handled by the parent.)

### `pages/BoidsPage.tsx`

- `const overlayRef = useRef<HTMLDivElement>(null)` — one node that carries
  both the pull-range field and the glyph, moved as a unit.
- Derive two things from settings each render (cheap, changes rarely):
  - **glyph variant** — return `null` when the icon is off **or** when
    `params.cursor === 0` (so `creatures` mode doesn't leave a stray ring with
    no active force — see §9):
    `cursorIcon === 'off' || params.cursor === 0 ? null : cursorIcon === 'ring' ? 'ring' : params.cursor > 0 ? 'berry' : 'cat'`.
  - **field sign**: `Math.sign(params.cursor)` → drives a `data-sign` attr
    (`attract` / `repel`) so CSS picks the warm/cool tint; the field is
    absent when `params.cursor === 0` (so `Math.sign` only ever sees ±1).
- Render the overlay, `aria-hidden`, hidden until the pointer enters the canvas.
  Give every asserted node a `data-testid` (the overlay is `aria-hidden` and the
  children use hashed CSS-module classes, so role/label/class locators can't
  reach them — the §7 iwft tests need these hooks):

```tsx
<div ref={overlayRef} className={styles.cursorOverlay} data-testid="cursor-overlay" aria-hidden>
  {params.cursor !== 0 && (
    <div
      className={styles.cursorField}
      data-testid="cursor-field"
      data-sign={sign > 0 ? 'attract' : 'repel'}
    />
  )}
  {variant && <CursorGlyph variant={variant} data-testid="cursor-glyph" data-variant={variant} />}
</div>
```

- Add `handleCursorIconChange` (mirrors `handleShapeChange`) and pass the new
  props to `ControlPanel`.
- Pass `overlayRef` into `useSimulationLoop`.

### `pages/BoidsPage.module.scss`

- **Structure to avoid a transform clash:** the JS sets `.style.transform` on
  the overlay to position it, and inline `transform` *replaces* (not composes
  with) any CSS `transform` on the same element. So do **not** also put the
  `translate(-50%,-50%)` centering on the overlay. Two clean options:
  - **(recommended)** outer `.cursorOverlay` node is positioned by JS; its
    children (`.cursorField`, glyph) each centre themselves relative to it
    (`position: absolute; left/top: 0; transform: translate(-50%,-50%)`).
  - or compose in the JS string:
    `transform: translate(${x}px, ${y}px) translate(-50%, -50%)`.
  Either way the JS transform **must use `px` units** —
  `translate(${x}px, ${y}px)`; unitless `translate(x, y)` is an invalid
  declaration and gets dropped.
- `.cursorOverlay` — `position: fixed; top: 0; left: 0; pointer-events: none;`
  (critical: must not steal pointer events from the canvas),
  `will-change: transform`, hidden until active.
- `.cursorField` — a circle of diameter `calc(var(--cursor-radius) * 2)`
  centred on the overlay, `border-radius: 50%`, background a **gentle**
  `radial-gradient(circle, <tint> 0%, transparent ~70%)` so it fades to nothing
  before the hard edge (mirrors the physics linear falloff). Low opacity
  (~0.12–0.18); `[data-sign="attract"]` warm tint, `[data-sign="repel"]` cool
  tint, both pulling from theme accent tokens. `--cursor-radius` is set once
  from the exported `CURSOR_RADIUS` (inline style on the overlay, or a `:root`
  token) so the visual never drifts from the physics.

## 6. Wiring the pointer — `features/sim/useSimulationLoop.ts`

- Extend `UseSimulationLoopOptions` with `overlayRef`
  (the physics `cursor` value already arrives inside `params`).
- Inside the canvas effect:
  - `const pointerRef = useRef<{x,y} | null>(null)`.
  - `pointermove` on the canvas: compute world coords from
    `event.clientX/Y − canvas.getBoundingClientRect()`, write `pointerRef`,
    and imperatively set `overlayRef.current.style.transform =
    `translate(${x}px, ${y}px)`` (note **`px` units**) + reveal it (moves field
    + glyph together). World coords equal `clientX/Y` here only because the
    canvas is pinned at the viewport origin (`position: fixed; inset: 0`); if it
    ever gains an offset, the physics delta (`−rect.left`) and the overlay
    transform (raw `clientX`) would diverge — keep them consistent.
  - `pointerleave`: `pointerRef.current = null`, hide the overlay.
  - In `frame()` (and the reduced-motion single step), call
    `sim.setPointer(pointerRef.current)` before `sim.step(dt)`.
  - Remove listeners in the cleanup.
- Extend `BoidsTestSeam` with `getPointer()` for assertions.

Reduced motion: the sim is frozen so the force does nothing (acceptable — no
stepping), but the overlay (field + glyph) still follows because its transform
updates on `pointermove`, independent of rAF.

## 7. Tests (TDD — red first)

### `engine/simulation.test.ts` (vitest, seeded — use `isolate`)

| Case | Assert |
|---|---|
| `cursor > 0`, pointer set, one boid offset | distance to pointer **decreases** over N steps vs baseline |
| `cursor < 0` | distance **increases** (repelled) |
| `cursor === 0` with pointer set | positions identical to no-pointer run |
| pointer `null`, `cursor` set | no effect |
| boid **well** beyond `CURSOR_RADIUS` | unaffected. Pin it far enough (or use N=1) — boids move ≥ `minSpeed`/step, so a boid parked just outside the radius can drift in and pick up force, giving a false failure. |

### `settings.test.ts`

- `cursorIcon` round-trips; missing → default `ring`; garbage → default.
- A v1 blob without `cursor` in params loads with `cursor: 0`.

### `boids.iwft.tsx` + `BoidsPagePom.ts`

- Drag the `cursor` slider → readout updates **and** `verifyEngineParam('cursor', …)`.
- Cursor-icon picker selects + persists (`verifyPersistedCursorIcon`).
- `pointermove` over the canvas → overlay becomes visible and is positioned;
  `pointerleave` → hidden. (New POM helpers: `movePointer(x,y)`,
  `verifyGlyphShown(variant)`.)
- Pull-range field: with `cursor !== 0` and the pointer over the canvas, the
  field is present with the right `data-sign` (`attract` for `>0`, `repel` for
  `<0`); with `cursor === 0` it's absent. (POM: `verifyFieldSign(sign|none)`,
  keyed on `data-testid="cursor-field"`.)
- POM plumbing: add `cursorIcon?: string` to the POM's `PersistedSettings`
  interface (it currently lists only `theme`/`shape`/`params`) so
  `verifyPersistedCursorIcon` can read it.

## 8. Files touched

**New:** `CursorIconPicker.tsx` (+scss), `CursorGlyph.tsx`.
**Edited:** `params.ts`, `simulation.ts` (export `CURSOR_RADIUS`),
`settings.ts`, `ControlPanel.tsx`, `useSimulationLoop.ts`, `BoidsPage.tsx`
(+scss, the `.cursorOverlay`/`.cursorField` styles), + the three test files, POM.

## 9. Open questions / recommendation

- **ADR?** Per the repo norm ("any decision you made is recorded in an ADR"),
  a short **ADR 0009** is worth adding: cursor force as a signed `SimParam`,
  pointer fed to the engine imperatively, glyph + pull-range field as a
  `pointer-events: none` DOM overlay driven off the exported `CURSOR_RADIUS`.
  Light MADR-lite — recommended, not blocking.
- **Radius vs global pull** — spec assumes a radius-limited field
  (`CURSOR_RADIUS = 180`). If you'd rather the cursor pull/push the *whole*
  flock, drop the radius gate and the falloff — but then the pull-range field
  loses its meaning (there'd be no edge to show). I'd keep the radius.
- **Field vs glyph independence** — the field shows whenever `cursor !== 0`,
  even if `cursorIcon === 'off'`. Alternative: gate the field on the icon
  picker too. I'd keep them independent — the field represents physics, the
  glyph is decoration.
- **Pointer over the control panel** — the panel is a DOM sibling rendered on
  top of the canvas, so listening on the canvas means moving onto the panel
  fires `pointerleave`: the overlay hides and the force stops while you drag a
  slider. That's a defensible default (no force where you can't see the flock),
  and it's what the spec assumes. If you'd rather the force persist while
  tuning, attach the listeners to a full-viewport wrapper (or `window`) instead
  and let the last canvas-space point stand. **Recommendation: keep the
  canvas-only default** — simplest, and hiding under the panel reads as
  intentional.
- **Touch** — `pointer*` events cover touch, but a finger both scrolls and
  forces. Left out of scope; flag if mobile matters.

## 10. Verify loop

```bash
pnpm lint
pnpm typecheck
pnpm test --filter=boids
```

All green; POM/iwft cover the whole-page behaviour, engine tests cover the
physics.
