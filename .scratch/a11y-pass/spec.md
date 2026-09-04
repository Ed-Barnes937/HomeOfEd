# a11y-pass - motion safety for a neurodiverse audience

The apps are aimed at home-education communities, many of whose kids are
neurodiverse and some photosensitive. A code-level audit of all nine
user-facing apps (2026-09-03, branch `a11y-checks`) found no provable WCAG
2.3.1 three-flashes-per-second breach, but three genuine gaps and one design
risk. This effort closes the ones Ed selected.

Agreed with Ed 2026-09-03. Everything here is per-app UI work - no engine
changes, no new packages.

Audit context worth having in mind while implementing:

- `prefers-reduced-motion` is an established house convention: honoured in
  boids, espy, karesansui, fridge, wotd and boop's CSS, and iwft-tested in
  three of those (`apps/boids/src/boids.iwft.tsx:194`,
  `apps/espy/src/doodle.iwft.tsx:107`,
  `apps/karesansui/src/karesansui.iwft.tsx:172`). The hub's canvas previews
  simply escaped it.
- The reference implementation for "static frame under reduce" is
  `apps/boids/src/features/sim/useSimulationLoop.ts:148-178`.
- There is no repo-wide a11y tooling (no axe, no CI step, nothing in
  test-kit); each app that tests reduced motion does its own
  `page.emulateMedia({ reducedMotion: 'reduce' })`.

## 1. Hub: previews respect reduced motion (ticket 01)

`usePreviews` (`apps/hub/src/pages/HomePage.tsx:295+`) starts eight perpetual
rAF canvas loops on mount - one per app card, all above the fold - and none of
them checks `prefers-reduced-motion`. The wordmark hop and the LIVE dot are
already gated (`HomePage.tsx:171`, `HomePage.module.scss:352`); the previews
are the gap, and the hub is the one page every child passes through.

Under reduce: each preview renders exactly one static frame and never enters
its loop. Same shape as boids.

## 2. Boids: a pause control (ticket 02)

The flock autostarts on mount and cannot be stopped: there is no pause
control anywhere in `ControlPanel.tsx`, and `speed` bottoms out at 0.5
(`apps/boids/src/features/sim/engine/params.ts:26`). That is a WCAG 2.2.2
failure (auto-animation > 5 s with no pause). Add a play/pause toggle.

## 3. Boids: reduced motion gets an explanation and a way in (ticket 03)

Today reduce-motion is all-or-nothing: the rAF loop is never started
(`useSimulationLoop.ts:172-178`), so a child whose OS has reduce set - the
likeliest OS setting in this audience - gets a permanently frozen flock with
no explanation and no way to start it. Once ticket 02 exists, reduce-motion
should set the *initial state* of the same pause control to paused instead of
hard-disabling animation; pressing play is explicit consent to motion.

## 4. Karesansui: cap the effective rotation rate (ticket 04)

At `speed: 100` the carve duration floors at 1500 ms
(`apps/karesansui/src/features/garden/useRakeLoop.ts:184`) while the curve
generator uses `fullTurns` (capped at 200,
`apps/karesansui/src/features/garden/engine/gears.ts:52-61`) - `prettyTurns`'
legible cap of 40 is not what drives `tMax`. Worst selectable train
(ring 120 / wheel 63): marble and gear discs orbit at ~14 Hz, gear body spins
at ~27 Hz, near-white on near-black. Floor the duration as a function of the
train's turn count so no orbiting element exceeds ~3 rev/s at any selectable
speed. This removes the risk at source; no warning needed after.

## 5. Fridge: keyboard access spike (ticket 05)

Magnets are plain divs with pointer handlers only
(`apps/fridge/src/features/board/MagnetView.tsx:73-81`) - no tabIndex, no
role, no keys - so the app's entire purpose is unreachable without a mouse
(WCAG 2.1.1). A spike, not a build: prototype what keyboard-driven magnet
interaction should feel like and come back with a recommendation.

## Non-goals (decided 2026-09-03)

- **Silt** (reduced-motion support, fire-tool first-run note): ignored for
  now. Mitigated by its default-paused start.
- **Boop volume/mute**: out - loudness was considered and measured when boop
  was built (`apps/boop/src/engine/audioDriver.ts:9-45`).
- **Sprout** (smooth-scroll gating, stop button, aria-live): out - the app is
  WIP; fold into its build.
- **Hub global pause control**: not taken; the reduced-motion gate (ticket
  01) is the fix for this pass.
- **test-kit axe integration / shared reducedMotion harness option**: not in
  this pass.
- **Hub focus styles, sensory badges on the app rail**: not in this pass.
