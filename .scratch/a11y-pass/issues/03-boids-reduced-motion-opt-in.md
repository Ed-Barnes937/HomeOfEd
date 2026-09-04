# 03 - Boids: reduced motion means default-paused, not frozen forever

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 02
**Spec:** [../spec.md](../spec.md) §3

Today `prefers-reduced-motion: reduce` permanently disables the flock
(`apps/boids/src/features/sim/useSimulationLoop.ts:148-178` never starts the
rAF loop): a child whose OS has reduce set gets a frozen screen with no
explanation and no way to start it. That protects them from motion they never
consented to, but it also locks them out of the app entirely - and reduce is
exactly the OS setting a neurodiverse household is most likely to have on.

With ticket 02's pause control in place, reduce-motion should set the
*initial state* of that control to paused rather than hard-disabling
animation. Pressing play is explicit consent to motion.

## Design

- Under reduce: `running` initialises to `false`, one static frame renders
  (current behaviour, kept), and the pause/play control shows "play".
  Pressing play runs the normal loop; pausing returns to the static state.
- Without reduce: `running` initialises to `true` - no behaviour change.
- The control needs a hint of *why* it is paused: a short, literal line near
  the button when (and only when) the app started paused because of the OS
  setting - e.g. "paused because your device asks for less motion". Plain
  language for kids; no jargon like "prefers-reduced-motion".
- Respect a mid-session OS toggle if cheap (a `matchMedia` change listener
  that pauses when reduce turns on); do not fight the user - if they pressed
  play under reduce, a re-render must not silently re-pause them. If this
  gets fiddly, read-once-at-mount is acceptable; note the choice in the ADR.

## Tests

Update `apps/boids/src/boids.iwft.tsx` (the existing reduce tests at :194 and
:254 assert "never animates" - that assertion is now wrong *by design*;
rewrite them to the new story, do not loosen them):

- Under reduce: static on load, control reads play, hint visible.
- Under reduce + press play: canvas samples differ (it animates).
- Under reduce + play + pause: static again.
- Without reduce: animates on load, no hint shown.

## ADR

Write `docs/adr/NNNN-boids-reduced-motion-opt-in.md` (MADR-lite): the
default-paused-with-opt-in model versus the hard gate (protection vs lockout),
the plain-language hint, and the mid-session-toggle choice. This is the
precedent other animated apps will follow, so record the reasoning.

## Constraints

- `apps/boids` only.
- The hint copy is part of the app's own UI voice - match the existing
  control panel style, don't invent a banner system.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter boids run test` green
  (use `pnpm --filter`, not `turbo run --filter`).
