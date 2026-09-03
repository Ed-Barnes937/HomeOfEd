# 0044 - boids: reduced motion means default-paused, not frozen

- **Status:** Accepted (2026-09-03, landed with
  `.scratch/a11y-pass/issues/03-boids-reduced-motion-opt-in.md`)
- **Date:** 2026-09-03
- **Related:** `.scratch/a11y-pass/spec.md` §3. Builds on
  [ADR 0043](0043-boids-one-static-frame-mechanism.md). Implemented in
  `apps/boids/src/pages/BoidsPage.tsx`,
  `apps/boids/src/features/sim/reducedMotion.ts` and
  `apps/boids/src/features/controls/ControlPanel.tsx`.

## Context

`prefers-reduced-motion: reduce` used to veto the flock outright: the hook read
the media query at mount and never started the rAF loop. A child whose device
asks for less motion got a single static frame, no explanation, and no way in -
so the protection also removed the app. Reduce is exactly the OS setting this
audience (home-educated, often neurodiverse households) is most likely to have
switched on, which makes the lockout the common case rather than the edge.

The audience needs both halves: nothing moves until someone asks for it, and
someone *can* ask for it. Once ticket 02 gave the app a play/pause control, the
media query had somewhere to express itself other than a veto.

## Decision

Reduce sets the **initial value** of the run control; it no longer gates
animation.

- `BoidsPage` seeds `running` with `!prefersReducedMotion()`. Under reduce the
  app opens static with the control reading "play"; without it, nothing about
  the app changes.
- Pressing play is explicit consent and really animates. `useSimulationLoop`'s
  switch is now `animating = running` - ADR 0043's single static-frame
  mechanism carries the whole behaviour, and the hook no longer reads the media
  query at all. `(prefers-reduced-motion: reduce)` is named once, in
  `features/sim/reducedMotion.ts`.
- A device-driven pause explains itself: a short line under the button reading
  "paused because your device asks for less motion. press play when you want
  the flock to move." It is a sentence in the panel's own mono voice, wired to
  the button with `aria-describedby` so it is not sighted-only. No jargon, no
  banner system, no dismiss affordance to learn.
- The hint tracks `pausedByDevice`, not `!running`: it appears only while the
  pause is the device's doing, and clears the moment the user touches the
  control. A pause the user chose needs no apology, and a stale explanation
  beside a running flock would be a lie.

### Mid-session OS toggle

Honoured, in one direction only. A `matchMedia` `change` listener pauses the
flock and shows the hint when reduce switches **on** mid-session; switching it
**off** does nothing.

The listener fires on real OS changes only, never on a re-render, so it cannot
re-pause someone who pressed play under reduce - the failure mode the ticket
warned about. Turning the setting off is deliberately inert: it is permission
to move, not a request to start moving, and auto-starting motion under a
control that reads "play" would be the same lockout inverted.

## Consequences

- Reduce is now a *default*, and defaults can be overridden - which is the
  point. A user under reduce who presses play gets full-speed animation; the
  app takes them at their word rather than second-guessing the OS setting.
- This is the precedent for the other animated apps (hub previews, espy,
  karesansui, boop): under reduce, open still, say why, and offer a way in.
  Ticket 01's hub previews stop at "open still" - they have no per-preview
  control to seed - so the pattern generalises as "reduce chooses the initial
  state of whatever control exists", not as "every app must gain a play button".
- `running` still lives outside persisted `Settings`, so a reduce user starts
  paused every session however often they press play. That is intended: consent
  to motion is per sitting, and storage must not out-vote the device.
- The panel's collapsed (FAB) state hides the hint along with every other
  control. Not worth a second surface: collapsing is a deliberate act, and the
  flock is static either way until play is pressed.
- The four iwft scenarios in `apps/boids/src/boids.iwft.tsx` now assert the
  opt-in story (static + "play" + hint on load, play animates, pause returns to
  static, no hint without the setting), plus the mid-session switch-on. The old
  "reduce never animates" assertions were removed because they contradict this
  decision, not because they were flaky.
