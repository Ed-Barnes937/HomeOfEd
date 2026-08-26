# Tech spec — beacon drop (pinned cursor force)

## 1. What we're building

Clicking the canvas drops a **beacon**: the cursor attraction/repulsion force,
frozen at whatever `params.cursor` was at the moment of placement. Clicking a
beacon again removes it. Multiple beacons can coexist, each with its own frozen
strength. A click with the slider at `off` (0) does nothing — except removing an
existing beacon, which always works.

Beacons are **ephemeral engine state**: they live only in the running
`Simulation` and are never persisted. Reload, or resize weirdness aside, the
world starts clean.

## 2. Design decisions

| Decision | Choice | Why |
|---|---|---|
| Click policy lives in the engine | `sim.toggleBeaconAt(x, y, strength): 'added' \| 'removed' \| 'noop'` | Pure and vitest-testable; `useSimulationLoop` stays a thin event adapter (same split as `setPointer`) |
| Hit radius | `BEACON_HIT_RADIUS = 24` CSS px, exported from `simulation.ts` | ~48px effective touch target; nearest-hit within radius so overlapping beacons peel off one per click. Also means two beacons can never be placed closer than 24px — the second click removes instead |
| Tap vs drag | `TAP_SLOP_PX = 8` on pointerdown→pointerup client distance | Touch-drag steers the flock (`touch-action: none`); 8px is the standard touch slop; raw pointer events are what the POM can dispatch |
| Force shape | Identical to the pointer force with `beacon.strength` in place of `params.cursor` | Direct (non-wrapped) delta, linear falloff over `CURSOR_RADIUS`, accumulated via `addSteer` — shares the `maxForce`/`maxSpeed` clamps, so N beacons + live pointer stay bounded |
| Draw order | Beacons right after `paintBackground`, under the flock | Environment markers; boids stay the visual subject |
| Colours | Literals in `renderer.ts` (`255,120,90` attract / `90,170,255` repel), not `Theme` fields | They encode sign semantics, not theme aesthetics — the DOM cursor field hardcodes the same rgba across all themes in `BoidsPage.module.scss` |
| Ring opacity | `beaconRingAlpha(s) = 0.05 + 0.15·min(1, |s|/3)` | Faint floor so a weak beacon is findable, subtle ceiling so rings never dominate |
| Persistence | None | Product choice: beacons are world-position-dependent and the world resizes; nothing else persists world-space data |
| Per-frame allocation | Zero | Indexed `for` over `beaconList` in `steerFor`; two cached glyph gradients (one per sign) on the renderer |

## 3. Engine — `features/sim/engine/simulation.ts`

- `export interface Beacon { x; y; strength }`, `export const BEACON_HIT_RADIUS = 24`.
- `private readonly beaconList: Beacon[]`, exposed as `get beacons(): ReadonlyArray<Beacon>`.
- `toggleBeaconAt(x, y, strength)`: nearest-hit scan within `BEACON_HIT_RADIUS`
  → splice + `'removed'`; else `strength === 0` → `'noop'`; else push → `'added'`.
  Hit-test runs **before** the strength gate so cursor-off clicks still remove.
- Beacon force loop at the end of `steerFor`, immediately after the cursor
  block — same formula, per beacon.
- `setBounds`/`setParams` untouched: a beacon outside shrunk bounds still nudges
  edge boids (same as an edge pointer) and paints partly off-canvas. Harmless.

## 4. Renderer — `features/sim/render/renderer.ts`

`drawBeacons(sim)` between `paintBackground` and the boid loop. Per beacon:
a 1px ring at `CURSOR_RADIUS` (value-imported from the engine, so physics and
visuals can't drift) with `beaconRingAlpha` opacity, and a radius-10 glyph
filled with a per-sign cached radial gradient. Colour literals carry a
keep-in-sync comment pointing at `BoidsPage.module.scss`.

## 5. Wiring — `features/sim/useSimulationLoop.ts`

`pointerdown` records `pendingTap`; `pointerup` within `TAP_SLOP_PX` calls
`sim.toggleBeaconAt(canvas-relative coords, paramsRef.current.cursor)`.
`pointerleave` and `pointercancel` clear `pendingTap` (an aborted touch gesture
must not mis-fire the next pointerup). A non-noop toggle calls
`redrawIfStaticRef.current?.()` so the reduced-motion static frame repaints
without starting the animation. Test seam gains `getBeacons()`.

## 6. UI

No panel changes. The `cursor attraction` tooltip gains one sentence explaining
click-to-pin (`ControlPanel.tsx`, `CURSOR_SLIDER_SPEC`).

## 7. Tests

- `engine/simulation.test.ts` — `describe('beacons')`, 10 cases: toggle
  add/remove/noop/nearest, attract/repel steering, frozen strength survives a
  `setParams` cursor change, out-of-radius no-op, multiple beacons, beacon +
  live pointer stacking.
- `render/renderer.test.ts` — `beaconRingAlpha` floor/cap/sign-independence.
- `boids.iwft.tsx` — 5 tests via new POM helpers (`clickCanvas`,
  `dragAcrossCanvas`, `verifyBeaconCount`, `verifyBeaconStrengths`, all through
  the seam with `expect.poll`, no pixel reads): drop+remove round trip,
  cursor-off no-op, drag doesn't drop, frozen strengths `[1.5, -2]`,
  reduced-motion repaint stays static.

## 8. Files touched

`engine/simulation.ts`, `engine/simulation.test.ts`, `useSimulationLoop.ts`,
`render/renderer.ts`, `render/renderer.test.ts`, `testing/BoidsPagePom.ts`,
`boids.iwft.tsx`, `controls/ControlPanel.tsx` (tooltip only), this spec.

## 9. Open questions / notes

- Perf is O(beacons × boids) per step — fine for hand-placed counts. If it ever
  needs a bound, cap `beaconList` at ~32 in `toggleBeaconAt`.
- On the light `autumnal` theme the translucent tints have less contrast — same
  property as the DOM cursor field today; acceptable, revisit as polish.
- No ADR: no new architectural seam (same call as cursor-force — the reusable
  decisions live in this spec's §2 table).

## 10. Verify loop

```bash
pnpm lint
pnpm typecheck
pnpm --filter boids run test
```
