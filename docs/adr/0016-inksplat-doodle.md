# 0016 — Inksplat doodle: divergences from the design guide

- **Status:** Accepted
- **Date:** 2026-07-09
- **Related:** [ADR 0008](0008-apps-without-a-database.md) (stateless
  baseline), [ADR 0003](0003-spa-default-tanstack-start-opt-in.md) (SPA
  default), the epic's
  [`spec.md`](../../.claude/tasks/inksplat-doodle/spec.md) and
  [`decisions.md`](../../.claude/tasks/inksplat-doodle/decisions.md).

## Context

`apps/inksplat` (`inksplat.homeofed.com`) is a calm, client-side canvas
doodling toy: procedurally-generated ink blots that the user turns into little
creatures by drawing freehand lines and stamping eyes. It follows the
stateless baseline (ADR 0008) and SPA default (ADR 0003) without change — this
ADR is not about those. It builds from a `reference/inksplat/` design-guide
bundle that the epic explicitly treats as **a design guide, not a spec**:
"match its look/feel, treat its internals as non-binding." During the
`/grill-me` alignment session and implementation, six points were deliberately
settled differently from what that guide assumes or implies. This ADR records
them so the reasoning isn't lost once the guide itself is forgotten.

## Decision

1. **Command-replay undo, unlimited depth** — not raster snapshots capped at a
   fixed count. The drawing is an ordered list of immutable ops (`field` /
   `stroke` / `eye`, `engine/types.ts`); `engine/history.ts` push/undo over
   that list, and `render/surface.ts` replays it. This is lighter (no bitmap
   buffer), trivially testable via the seam (`counts()`, `historyDepth()`),
   and unlimited depth better serves the "forgiving, never punish the user"
   goal than an arbitrary cap.

2. **Single fixed sketchbook direction** — no theme/mode/ink-engine or
   switcher UI. `theme.ts` exports one `SKETCHBOOK` literal; `styles/tokens.scss`
   has one token set. The guide's internals hint at a more general theming
   engine; v1 ships exactly one look, deliberately, to keep the surface small
   and the first-touch experience unambiguous. A switcher is a future, not a
   v1, concern.

3. **Blot variety enhancement — rotation + anisotropy.** `engine/blot.ts`
   generation adds a random angular rotation offset (`theta0`) and independent
   x/y scale factors (`0.82–1.18`) on top of the guide's jittered-radius
   outline, so consecutive shuffles read as visibly different shapes. This was
   necessary to clear the "divergent thinking" quality bar the product vision
   demands and is asserted directly in `blot.test.ts` (point-count spread,
   satellite-count spread, anisotropy ratio spread across a sample).

4. **Session restore of the current drawing** — the one softening of
   "ephemeral." `session.ts` mirrors the live `Op[]` to a single `localStorage`
   slot (`inksplat:doodle:v1`), overwritten as you draw; `useDoodle.ts` restores
   it on mount if valid, otherwise generates a fresh field. There is still no
   gallery and no history of past drawings — only the one *current* piece
   survives a reload, so an accidental refresh doesn't erase someone's
   in-progress creature. Malformed/missing/garbage storage always falls back
   to `null` (never throws), per `session.ts`'s shape validation.

5. **Fluid-responsive and capability-detected, not device-breakpointed.**
   Blob count/size (`engine/layout.ts`) scale continuously with canvas area
   (`[1, 9]`, inverse size coupling) rather than switching at phone/tablet/
   desktop breakpoints; the header subtitle drops via a **container query**
   keyed to the header's own width (`DoodlePage.module.scss`), not an
   `is-mobile` media query; and `useDoodle.save()` branches on
   `navigator.canShare?.(...)` (Web Share if available, else an anchor
   download) rather than on user-agent/device type. One continuous rule per
   concern, not two discrete modes.

6. **Sensory-safe as a first-class principle**, not an afterthought pass. The
   one-shot bloom-in ramp (`useDoodle.ts`, `useDoodle.helpers.ts`) checks
   `prefers-reduced-motion` up front and renders the final frame once instead
   of animating; nothing else moves, sounds, or interrupts; New page and any
   drawing action are always fully undoable (no confirmation dialogs); touch
   targets are ≥44px. This threads through the whole feature rather than
   living in one component.

## Consequences

- The engine (`features/doodle/engine/*`) carries slightly more surface than
  the guide's minimal outline generator (rotation, anisotropy, the `History`
  class, coordinate-fit helpers) — all pure, unit-tested, and justified by
  (1) and (3) above.
- `localStorage` is now a real (if narrow) dependency of the app — the only
  place state crosses a session boundary. If a future iteration wants a
  gallery or multi-slot history, it is additive on top of this seam, not a
  rework of it.
- The container-query subtitle and capability-detected save are a small extra
  design cost (one more CSS mechanism, one more runtime capability check) in
  exchange for not hard-coding device assumptions that will eventually be
  wrong on some form factor.
- Divergence 2 (single fixed direction) means adding a second visual theme
  later is a new feature, not a flag flip — there is no theme engine to plug
  into yet.
