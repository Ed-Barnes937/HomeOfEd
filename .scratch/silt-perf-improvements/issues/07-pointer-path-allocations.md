# 07 — The pointer path: a layout read and an allocation per event

**Status:** done
**Type:** task
**Spec:** [../spec.md](../spec.md)

`apps/silt/src/features/sim/useSimLoop.ts`. Pointer events fire at the mouse's
report rate — 120 Hz or more on a trackpad — and while a user is painting,
that is exactly when the sim is busiest.

## 1. `getBoundingClientRect` on every pointermove

```ts
const cellAt = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect()   // forced layout
  return renderer.canvasPointToGrid(clientX - rect.left, clientY - rect.top)
}
```

`onPointerMove` calls `cellAt` for the cursor readout, and again inside
`paintAt` when painting — so **two** forced layout reads per event while
dragging. A forced layout is the single most expensive thing a pointer handler
can do, and this one is reading a value that only changes on resize or scroll.

**What to change:** cache the rect. It is already invalidated by the two things
the effect watches — the `ResizeObserver` and the DPR media query — so refresh
it there. It must **also** refresh on scroll and on window resize, because
neither changes the canvas's own size but both move it. A capturing `scroll`
listener on `window` (passive) plus the existing observers covers it.

Take care that the cached rect is correct on first use, before any observer has
fired.

## 2. A fresh array of objects per paint

```ts
for (const { dx, dy } of brushOffsets(brushRef.current)) { ... }
```

`brushOffsets` builds a new array of `{dx, dy}` objects every call. At the
widest brush that is 49 objects (7×7) per pointer event — and it is called from
`paintAt`, which fires per event while dragging.

**What to change:** `BRUSH_WIDTHS` is a fixed four-entry list, so precompute the
offsets once per width at module scope, as flat `Int8Array`s walked by index.
The function is pure and already takes only a width, so this is a memo, not a
redesign.

Keep the "odd, so it has a centre" comment and the `Math.floor`/`Math.ceil`
handling — `BRUSH_WIDTHS` is all odd today but the function does not assume it,
and that is deliberate.

## 3. While you are here

`paintAt` calls `sim.paint` per brush cell, and `Sim.paint` does a registry
lookup **and** a `chunks.activate` (a nine-chunk spread) per cell. For a 7×7
brush at 120 Hz that is 49 registry lookups and 49 spreads per event. The
species is the same for every cell of one stroke, so the lookup can be hoisted
out — but `Sim.paint`'s signature is the seam the `.iwft` tests and
`emitSpawners` both use. **Do not change `Sim.paint`.** If you want the
hoisting, add a separate batched entry point and leave `paint` alone; if that
looks like more surface than it is worth, say so in the PR and skip it. Either
answer is acceptable — an explicit decision is not.

## Watch out for

- The cached rect going stale is a *correctness* bug, not a perf one: painting
  lands in the wrong cell and the brush cursor detaches from the pointer. The
  `.iwft` render and mobile tests click at computed coordinates and will catch
  a gross error, but a scroll-induced staleness they will not. Be thorough.
- `mobile.iwft.tsx` exercises touch. Run the full Playwright CT suite.

- [ ] No `getBoundingClientRect` in the pointermove path
- [ ] Cached rect refreshed on resize, DPR change and scroll, and correct on first use
- [ ] Brush offsets precomputed per width, no per-event allocation
- [ ] An explicit decision recorded on the `Sim.paint` batching question
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green (Vitest **and** Playwright CT)

## Answer

Done. `getBoundingClientRect` is out of the pointermove path — the rect is
cached and refreshed on five triggers: eager read at effect setup,
`ResizeObserver`, DPR change via `refit()`, `window` resize, and `window`
scroll with `capture: true` (scroll does not bubble). Brush offsets are
memoised per width as flat `Int8Array`s.

`Sim.paint` batching **declined**, explicitly: a 7×7 brush spans at most 2×2
chunks, so the redundant `activate` calls are a few hundred integer comparisons
— not in the class of the two forced layouts removed. Recorded in the code.

The scroll test was confirmed load-bearing by removing the listener and
watching it time out. **Uncovered:** the DPR-change refresh — Playwright CT
cannot trigger a real `devicePixelRatio` change.
