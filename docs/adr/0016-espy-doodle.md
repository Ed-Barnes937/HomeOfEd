# 0016 — Espy doodle: divergences from the design guide

- **Status:** Accepted
- **Date:** 2026-07-09
- **Related:** [ADR 0008](0008-apps-without-a-database.md) (stateless
  baseline), [ADR 0003](0003-spa-default-tanstack-start-opt-in.md) (SPA
  default), the epic's
  [`spec.md`](../../.claude/tasks/espy-doodle/spec.md) and
  [`decisions.md`](../../.claude/tasks/espy-doodle/decisions.md).

## Context

`apps/espy` (`espy.homeofed.com`) is a calm, client-side canvas
doodling toy: procedurally-generated ink blots that the user turns into little
creatures by drawing freehand lines and stamping eyes. It follows the
stateless baseline (ADR 0008) and SPA default (ADR 0003) without change — this
ADR is not about those. It builds from a `reference/espy/` design-guide
bundle that the epic explicitly treats as **a design guide, not a spec**:
"match its look/feel, treat its internals as non-binding." During the
`/grill-me` alignment session and implementation, seven points were deliberately
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

3. **Blot variety — four archetypes with per-type knobs.** `engine/blot.ts`
   picks one of four shape archetypes per blot — `blob` (organic round),
   `streak` (elongated smear), `splatter` (compact core flinging many
   droplets), `cluster` (core plus large overlapping lobes) — each with its own
   named knob block in the exported `SHAPES` record (point count, radial
   jitter, per-axis anisotropy, satellite/lobe ranges) so a single shape can be
   dialled independently later without touching the others. A random rotation
   offset (`theta0`) orients each shape's anisotropic frame. This supersedes
   the original rotation-plus-mild-anisotropy-only enhancement: post-launch
   feedback was that pages of near-uniform round blobs "look like faces", so the
   generator now produces drastically different shapes on the same page.
   `blot.test.ts` asserts each archetype's contract and cross-sample spread
   (point count, satellite count, elongation). The `Blot` type, `render/surface.ts`,
   and `session.ts` are unchanged — archetypes only change *how* the outline and
   satellites are rolled, not the resolved shape they produce.

4. **Session restore of the current drawing** — the one softening of
   "ephemeral." `session.ts` mirrors the live `Op[]` to a single `localStorage`
   slot (`espy:doodle:v1`), overwritten as you draw; `useDoodle.ts` restores
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
   `is-mobile` media query; and `useDoodle.save()` branches on capability —
   `navigator.maxTouchPoints > 0 && navigator.canShare?.(...)` for the native
   share sheet, else an anchor download. The `maxTouchPoints` gate was added
   after launch: on desktop (Mac/Windows) the share sheet offers no download
   option, so touch-primary devices (phones, tablets) get Share and desktop
   gets a direct download. One continuous capability rule per concern, not a
   user-agent/device-type switch.

6. **Sensory-safe as a first-class principle**, not an afterthought pass. The
   one-shot ink-in-water entrance — the field blooms from seeded ink and settles
   (the WebGL fluid sim of divergence 7, `render/fluid.ts`, driven by
   `useDoodle.ts`) — checks `prefers-reduced-motion` up front and bakes the
   settled frame once instead of animating; the bloom is a calm ~1.8s settle
   with no fast motion. The watercolour tone is baked into the field raster (its
   wash carried in the pixel colours, never `globalAlpha`), so it is present at
   rest and unaffected by the reduced-motion skip. Nothing else moves, sounds,
   or interrupts; New page and any drawing action are always fully undoable (no
   confirmation dialogs); touch targets are ≥44px. This threads through the
   whole feature rather than living in one component.

7. **The procedural ink field is a baked WebGL fluid sim, not 2D-canvas
   diffusion.** Post-launch the earlier procedural/watercolour blots still read
   as artificial, so `render/fluid.ts` now runs a compact WebGL2 stable-fluids
   solver (Stam-style: advect → curl → vorticity → pressure-project → advect
   dye) as a transient overlay: the blots seed dye + velocity splats, the sim
   blooms for ~1.8s (`FLUID_MS`), then the settled frame is **baked** to a plain
   2D canvas the app keeps as the field art. Nothing simulates after the bake —
   undo/resize/reload just blit the baked bitmap — so the emergent shape is
   fixed the moment it settles, and `render/surface.ts` stays the only 2D-canvas
   module (it blits the raster; a plain filled outline is the fallback until the
   raster exists). The pure blot→splat mapping lives in `render/fluid.helpers.ts`
   (unit-tested in node), the palette conversion in `render/fluid.color.ts`, and
   the watercolour display shader thresholds the diffused dye into a crisp
   silhouette with a pooled edge-darkening rim and granulation — monochrome per
   divergence 2. Crucially the silhouette comes from **geometry, not advection**:
   each puddle is a small set of gaussian lobes of different sizes placed so
   their union is a distinct mark, chosen from six weighted brush archetypes —
   `dot / peanut / bean / clump / spike / arch` — where the rounded marks
   dominate and the "hard" marks (a pointed star, a concave arch) are accents.
   `fluid.helpers.test.ts` asserts each archetype's lobe contract (peanut waist,
   bean taper, spike arms/directions, arch notch). This supersedes the deleted
   `render/diffusion.ts` and the old 2D watercolour tone referenced in
   divergence 6. **Tech debt:** a dev-only `?tune` panel
   (`features/doodle/FluidTuner.tsx` + `render/fluid.tuning.ts`) that live-edits
   the look and forces a one-of-each debug grid is deliberately left in — inert
   unless `?tune` is in the URL; the signed-off numbers live in `DEFAULT_TUNING`.

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
- The render layer (divergence 7) now carries a WebGL2 fluid solver alongside
  the 2D projection — a second GPU-touching module (`render/fluid.ts`) and a
  hard capability gate (`fluidSupported()`), with a plain-outline fallback when
  WebGL2 float targets are absent. The engine stays pure; only the blot→splat
  mapping moved into a (still pure, tested) `render/fluid.helpers.ts`.
