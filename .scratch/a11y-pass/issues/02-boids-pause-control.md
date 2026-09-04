# 02 - Boids gets a pause/play control

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §2

The flock autostarts on mount (`useSimulationLoop.ts:177`) and cannot be
stopped: no pause control exists, and the `speed` slider bottoms out at 0.5
(`apps/boids/src/features/sim/engine/params.ts:26`). WCAG 2.2.2 requires a
way to pause auto-starting animation that runs longer than 5 seconds. Add a
play/pause toggle.

## Design

- A `running` boolean owned alongside the existing sim state, defaulting to
  `true` (autostart behaviour is unchanged for users without reduce-motion -
  ticket 03 changes the default under reduce).
- Pausing must genuinely stop work, not just freeze the picture: when paused,
  do not call `sim.step` and do not schedule the next rAF (or schedule
  nothing and re-enter the loop on resume). The reduced-motion branch in
  `useSimulationLoop.ts:148-178` already proves the "no loop + redraw on
  settings change" shape - a paused state is that branch, entered from UI
  state instead of the media query, so expect to unify them rather than add a
  parallel mechanism.
- While paused, settings changes (theme, count, size...) still repaint a
  static frame - the existing `redrawIfStaticRef` (`useSimulationLoop.ts:54`)
  is exactly this hook.
- Control placement: a clearly visible button in `ControlPanel.tsx`
  (`apps/boids/src/features/controls/ControlPanel.tsx`) at the top, not
  buried under sliders - a photosensitive child's parent should find it in
  under a second. Real `<button>`, accessible name that flips
  (play/pause), keyboard reachable. Space-to-toggle as in silt
  (`apps/silt/src/hooks/useSiltHotkeys.ts:70`) is a nice-to-have; only add it
  if it cannot swallow Space while a slider has focus.
- Resume must not produce a physics jump: on resume, reset the loop's
  last-timestamp so the first `dt` is ~one frame, not the whole paused
  interval (`useSimulationLoop.ts` feeds real elapsed ms into `sim.step`).

## Tests

Extend `apps/boids/src/boids.iwft.tsx`:

- Pause: click the control, sample the canvas twice a few hundred ms apart -
  identical.
- Resume: click again, the two samples differ.
- Pause + change theme: the static frame repaints (canvas changes once, then
  holds).
- Existing reduced-motion tests (`boids.iwft.tsx:194`, `:254`) stay green
  untouched by this ticket.

## Constraints

- `apps/boids` only.
- Do not change the reduced-motion default in this ticket - that is
  ticket 03, which builds on this control.
- No ADR needed unless the loop restructure turns out to be a real decision;
  if the reduce branch and the paused branch merge into one mechanism, a
  short ADR recording that is welcome (ticket 03 will extend it).
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter boids run test` green
  (use `pnpm --filter`, not `turbo run --filter`).
