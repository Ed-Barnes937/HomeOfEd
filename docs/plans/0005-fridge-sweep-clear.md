# 0005 — Fridge: "Sweep it off" empty-the-fridge animation

- **Status:** Done
- **Date:** 2026-07-06
- **Related:** [ADR 0003](../adr/0003-spa-default-tanstack-start-opt-in.md),
  [0003 fridge plan](0003-fridge-implementation-plan.md),
  handoff: [`reference/fridge-sweep/`](../../reference/fridge-sweep/)
  (option 1e; open `Empty the Fridge - Options.dc.html` to feel the motion)

## 1. Summary

Replace the fridge board's instant **Empty the fridge** action with a staggered
left-to-right sweep: on press, every magnet slides across the door and tumbles
off the bottom edge, then the board empties. The end state is identical to
today's `clear()` (empty board, persisted) — this is an animation layer *in
front of* the existing `clear()`, not a rework of it.

This is option **1e "Sweep it off"** from the handoff. The other four ideas in
the prototype are out of scope.

**The handoff wins on motion values.** Direction, stagger, distance, spin,
duration and easing are final; port them closely. Exact numbers are in §4.

## 2. What already exists (no change needed)

- `.surface { inset:7px; overflow:hidden }` (`FridgeDoor.module.scss:53`) — the
  clip that makes magnets vanish as they cross the bottom edge. **Keep it.**
- `useFridgeBoard` already measures `surfW`/`surfH` into board state and already
  exposes `clear()` (empties `magnets`, resets `selId`/`dragId`, persists via the
  existing effect). The sweep wraps `clear()`; `clear()` stays usable on its own
  (New board still uses it).
- The trigger button exists and is already labelled **"Empty the fridge"**
  (`TopBar.tsx:42`, from #20). Today it calls `board.clear` directly.

## 3. Decisions (settled)

These are the three open questions from the review, with the chosen answers.

| Decision | Choice | Why |
| --- | --- | --- |
| **Completion trigger** | Drive completion off a single `setTimeout(maxDelay + 700 + buffer)` in the hook. **No per-element `transitionend` listeners.** | Fewer moving parts, deterministic in tests, and immune to the missed-`transitionend` edge (a magnet already at `opacity:0`, or unmounted mid-transition) that the handoff itself flags as the reason it wanted a fallback. The fallback *is* the mechanism. |
| **Test depth** | Reducer/hook-level tests are the contract (`useFridgeBoard.test.ts`); one thin `.iwft` asserts the end-to-end (press → `sweeping` → board empties). | Matches the app's existing split (CLAUDE.md: unit-first, `.iwft` thin for whole-page behaviour). The motion values are visual; we test *behaviour and state*, not pixel positions. |
| **Button styling** | Keep the current ghost "Empty the fridge" button. Only change what it *does* + add a `disabled` guard when the board is empty. | The handoff explicitly allows keeping the label and just changing behaviour. The danger restyle is optional and out of scope; a no-op sweep on an empty board looks broken, so the disabled guard is the real gap. |

## 4. Motion spec (from the handoff)

Per magnet `m`, using surface-local `m.x`, the magnet's own tilt `m.rot`, and the
measured `surfW`/`surfH`:

| Property | Value |
| --- | --- |
| `transition` | `transform 700ms cubic-bezier(.45,.05,.6,1), opacity 700ms ease` |
| `transition-delay` | `Math.round((m.x / surfW) * 260)` ms — left-to-right stagger |
| `transform` (departing) | `translate({driftX}px, {surfH + 120}px) rotate({m.rot + 55}deg)` |
| `opacity` (departing) | `0` |

- `driftX = surfW * 0.11 + m.rot` — a rightward push so it sweeps, not drops.
- `surfH + 120` clears the bottom edge (the `overflow:hidden` clips it away).
- `rotate(m.rot + 55deg)` — a modest tumble, not a spin.
- Total duration ≈ max stagger (`~260ms`) + `700ms` ≈ **960ms**. The completion
  timeout uses **1000ms** (matches the handoff's fallback).

## 5. Implementation (TDD: red → green → refactor)

### F1 — hook: `sweeping` state + `startSweep()` (unit-tested first)

`features/board/useFridgeBoard.ts`:

1. Add `sweeping: boolean` to `BoardState`; init `false` in `initialBoardState`.
2. Add action `{ type: 'startSweep' }` and reducer case: if
   `magnets.length === 0 || state.sweeping` → return state unchanged (no-op);
   else `{ ...state, sweeping: true, selId: null }`.
   - `clear` case: also reset `sweeping: false` (so New/clear can't strand the
     flag), otherwise **unchanged**.
3. Add a `startSweep()` callback:
   - Reduced motion: if
     `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, call the
     existing `clear()` immediately and return (today's instant behaviour). The
     `matchMedia` guard mirrors `boids`/`hub` usage.
   - Otherwise dispatch `startSweep`, then `setTimeout(() => { clear();
     dispatch(reset sweeping) }, 1000)`. Guard against double-trigger via the
     reducer no-op (already covered) — a second press while `sweeping` does
     nothing.
   - Clear the timer on unmount (ref + cleanup) so a sweep-in-flight doesn't fire
     after teardown.
4. Export `sweeping` (via `state`) and `startSweep` from the hook interface.

**Tests** (`useFridgeBoard.test.ts`, write first):
- `startSweep` on an empty board is a no-op (no `sweeping`, board stays empty).
- `startSweep` with magnets sets `sweeping: true` and `selId: null`.
- a second `startSweep` while `sweeping` is a no-op.
- after the timeout fires, `clear()` has run (magnets empty) and `sweeping` is
  `false`. (Drive with fake timers.)
- reduced-motion path empties immediately without setting `sweeping`.

### F2 — `MagnetView`: `departing` visual state

`features/board/MagnetView.tsx`:
- New props: `departing?: boolean`, `surfW: number`, `surfH: number`.
- When `departing`, replace the normal inline `left/top`/`transform` with the
  departure values from §4 (compute `driftX`, the translate/rotate transform,
  `opacity:0`, the `transition` and per-magnet `transition-delay`). When not
  departing, behaviour is exactly as today.
- `MagnetView.module.scss`: no structural change expected (departure styles are
  inline because they depend on per-magnet `x`/`rot` and measured dims). Add a
  `@media (prefers-reduced-motion: reduce)` guard only if a stray transition
  needs suppressing — the hook already short-circuits reduced motion, so likely
  none.

### F3 — page wiring

`pages/FridgePage.tsx`:
- Pass `departing={state.sweeping}`, `surfW={state.surfW}`, `surfH={state.surfH}`
  to each `MagnetView`.
- `onClear={board.clear}` → `onClear={board.startSweep}`.
- Selection chrome: `startSweep` clears `selId`, so `SelectionOverlay` drops out
  on its own — no extra guard needed.

### F4 — button disabled guard

`features/toolbar/TopBar.tsx`:
- Add a `canClear` (or reuse a `magnets.length > 0` signal) prop and set
  `disabled` on the "Empty the fridge" button, mirroring
  `ShareButton`'s `disabled={state.magnets.length === 0}`.
- `FridgePage` passes `disabled={state.magnets.length === 0}`.

**Test** (`.iwft`, thin): with a seeded board, pressing "Empty the fridge" leads
to an empty board (assert magnets gone after the animation window); the button is
disabled when the board is empty.

## 6. Out of scope

- The other four prototype ideas (stylised button, pull-the-handle, shake-it-off,
  defrost sweep).
- The optional danger-button restyle (filled `--danger`).
- Any persistence change — the sweep touches only in-memory magnets; `clear()`
  already writes the empty board to `localStorage["fridge:v1"]`.
- New design tokens — the interaction reuses the existing look. The motion values
  live local to the feature (per the handoff, not in `tokens.scss`).

## 7. Verify

```bash
pnpm lint
pnpm typecheck
pnpm test --filter=fridge
```

All three green; the new hook tests and the `.iwft` pass; no cross-app imports,
no shared UI, no data-fetching server functions (this is client-only state).

## 8. Follow-up: lock the board while sweeping

Because magnets stay in state during the ~1s sweep (they animate out before
`clear()` fires), every board-mutating control reads a board that's about to be
emptied. The clearest bug: **Save** mid-sweep snapshots the full board into a
chip, so the chip and the emptied screen disagree. Same window also exposed
Share (publishes the full board), tray tiles (spawns a magnet the pending
`clear()` deletes), and chip-load (loads a board `clear()` then wipes).

Rule: **while `sweeping`, the board is read-only.** Two layers:

- **Data-integrity guards.** Reducer `add`/`loadBoard` no-op when `sweeping`;
  the hook's `save()` (not a reducer action) no-ops too. Covers non-UI callers.
- **UI feedback.** `sweeping` disables Save (`TopBar`), Share (`ShareButton`
  `disabled` extended), tray tiles (`Tray`→`PaletteGrid`), and chips
  (`SavedChips`). `New` stays enabled — it empties the board anyway, so the late
  `clear()` is a harmless no-op.

**Tests:** reducer no-op tests for `add`/`loadBoard` while sweeping; one `.iwft`
asserts Save/Share/tile/chip are all disabled mid-sweep.
