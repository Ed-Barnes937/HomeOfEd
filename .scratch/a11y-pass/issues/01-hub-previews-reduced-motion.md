# 01 - Hub previews respect prefers-reduced-motion

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §1

The eight app-card canvas previews on the hub landing page run perpetual rAF
loops from mount and ignore `prefers-reduced-motion`. Under reduce, each
preview should render exactly one static frame and never enter its loop.

## Design

All the loops live in `usePreviews`
(`apps/hub/src/pages/HomePage.tsx:295-326`), which dispatches to the eight
draw functions (`drawBoids` :343, `drawMagnets` :417, `drawWord` :458,
`drawInk` :508, `drawGarden` :572, `drawBoop` :653, `drawSilt` :692,
`drawIdle` :754). Every one ends with `raf = requestAnimationFrame(step)` and
an initial `step()` call.

- Read the preference once where `usePreviews` starts the loops - the same
  idiom the file already uses at `HomePage.tsx:171` for the wordmark hop.
  Gate at the dispatch level, not inside each draw function: under reduce,
  call the draw body once (or a `drawStatic` variant) and skip scheduling
  rAF entirely. The boids app is the proven reference for this shape
  (`apps/boids/src/features/sim/useSimulationLoop.ts:148-178` renders one
  frame and never starts the loop).
- The static frame should be a representative mid-state, not a blank canvas -
  most of the draw functions already produce something sensible on their
  first invocation; where the first frame is empty (e.g. the typewriter in
  `drawWord`, the silt pile), draw a filled state instead so the card still
  advertises the app.
- Theme changes must still repaint the static frame (`usePreviews` re-runs on
  `theme` - verify the effect's cleanup/re-run keeps working under reduce).
- Do not touch the wordmark hop or the LIVE-dot CSS - they are already
  gated (`HomePage.tsx:171`, `HomePage.module.scss:352-360`).

## Tests

An iwft in `apps/hub` mirroring `apps/boids/src/boids.iwft.tsx:194`:

- With `page.emulateMedia({ reducedMotion: 'reduce' })`: each preview canvas
  is non-blank (has painted pixels) and identical across two samples taken a
  few hundred ms apart - i.e. drawn once, not animating.
- Without reduce: at least one canvas differs across the same two samples
  (the loops still run).

## Constraints

- `apps/hub` only; no shared-package changes.
- No new dependencies.
- Follows the existing house convention, so no ADR needed - unless the
  implementation deviates from the boids pattern, in which case record why.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter hub run test` green
  (note: use `pnpm --filter`, not `turbo run --filter` - the latter errors on
  a cyclic-dep bug).
