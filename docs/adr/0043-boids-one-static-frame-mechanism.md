# 0043 - boids: paused and reduced-motion share one static-frame mechanism

- **Status:** Accepted (2026-09-03, landed with
  `.scratch/a11y-pass/issues/02-boids-pause-control.md`)
- **Date:** 2026-09-03
- **Related:** `.scratch/a11y-pass/spec.md` §2 and §3. Implemented in
  `apps/boids/src/features/sim/useSimulationLoop.ts`.

## Context

The flock autostarted on mount and could not be stopped, which fails WCAG
2.2.2 (auto-animation over 5 s with no pause). Adding a pause needed a second
"do not animate" state alongside the one the hook already had for
`prefers-reduced-motion: reduce`, which rendered a single frame, started no
rAF loop, and repainted that frame on settings changes through
`redrawIfStaticRef`.

Two separate mechanisms - a media-query branch taken once at mount and a
UI-state branch toggled at runtime - would have meant two ways to be still,
two places to remember the on-demand repaint, and an open question about what
pressing play means when reduce is set. Ticket 03 then wants reduce to become
an *initial value* for the pause control rather than a hard disable, which
only makes sense if both are the same state.

## Decision

The loop has exactly two modes, and one function switches between them:

- **animating** - the rAF loop runs and owns every paint;
  `redrawIfStaticRef` is null.
- **static** - nothing is scheduled, and `redrawIfStaticRef` holds `draw` so
  a theme/shape/params change (or a resize, or a dropped beacon) repaints the
  one frame.

`animating = running && !reducedMotion`. `running` reaches the hook as a prop
and is mirrored into a ref, so toggling it never re-runs the loop effect -
that would rebuild the `Simulation` and scatter the flock. Entering animating
mode restarts the frame clock, so the first `dt` after a resume is one frame
rather than the whole paused interval.

`reducedMotion` is still read once at mount and still wins over `running`:
this decision is about there being one mechanism, not about changing what
reduce does. Moving reduce from "wins" to "sets the initial `running`" is
ticket 03, and it is now a one-line change.

## Consequences

- The reduced-motion path is no longer special-cased anywhere: the two
  existing reduce iwft tests pass untouched, and the ResizeObserver's
  `if (reducedMotion) draw()` became `redrawIfStaticRef.current?.()`, which
  also fixes a resize while merely paused.
- Pause does no work at all: no `sim.step`, no rAF scheduled. The pause
  transition deliberately does not step, so the picture the user was looking
  at when they hit pause is the picture that holds.
- `running` is React state on `BoidsPage`, not part of persisted `Settings` -
  a pause is about this sitting, and ticket 03 wants the initial value to come
  from the media query, not from storage.
- The resume clock reset is not covered by a test: the engine clamps `dt` to
  33 ms (`MAX_DT_MS`), so the difference between a reset and an unreset clock
  is one extra frame of motion - real, worth fixing, too small to assert on
  without a flaky pixel-distance threshold.
