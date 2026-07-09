# 0019 — karesansui: architectural redesign (dark room, minimal console) + single dark theme

- **Status:** Accepted
- **Date:** 2026-07-09
- **Related:** [0007-karesansui-architectural-redesign.md](../plans/0007-karesansui-architectural-redesign.md)
  (the implementation plan); supersedes in part
  [0006-karesansui-implementation-plan.md](../plans/0006-karesansui-implementation-plan.md)
  §1 D11 (single warm-light theme → single **dark** theme); amends
  [0018-karesansui-geometry-fidelity.md](0018-karesansui-geometry-fidelity.md)
  (Level-2 pen-fidelity); [0008-apps-without-a-database.md](0008-apps-without-a-database.md)

## Context

karesansui shipped as a light, three-column "device" faithful to its AI-generated
mock. A design re-audit (judging the app on absolute merits, treating the mock as
a suspect artifact) found the canvas work strong but the surrounding UI
"competent generic-tasteful" and un-zen: a symmetric `312 / 1fr / 320` mirror,
warm-wellness palette, every control on show at once. Three layout directions
were spiked; the **architectural framing** direction — a dark, quiet room with the
warm sand bowl spotlit as the hero, a smaller lit mechanism companion, and the
controls dissolved into a dim console that brightens on reach — was chosen for its
calm and its minimal resting surface.

## Decision

- **Single dark theme, no toggle.** The direction *is* the dark room; a light
  variant would be a different design. Supersedes 0006 D11 (single warm-light).
  Still single-theme — just dark. The warm sand bowl and its groove shading are
  unchanged; only the room around it goes dark.
- **Composition = room → centred wordmark → asymmetric stage → dim console.** The
  sand hero is the largest, most-lit element; the mechanism companion is a smaller
  lit bowl beside it; the console rests dimmed and brightens on hover **and**
  keyboard focus (`:focus-within`). Below ~760px the stage stacks sand-hero-first.
- **Hybrid controls.** Ring, gears, and rake operate inline in the console;
  offset / speed / rotations live behind a single `tune ▾` disclosure popover;
  saved gardens live in a slide-up bottom tray present only when presets exist.
- **A11y is not sacrificed for calm.** Resting-dim text must itself pass AA
  contrast (opacity is emphasis, never a way to hide low-contrast text); every
  hover-reveal also fires on focus; focus rings are amber (an ink outline is
  invisible on dark); the popover and tray are full keyboard disclosures.
- **Mechanism upgraded to Level-2 pen-fidelity** — see the amendment to
  [ADR 0018](0018-karesansui-geometry-fidelity.md).

## Consequences

- A visual + interaction refactor, not a rewrite: the engine (`geom`/`gears`/
  `rake`/`state`), `sand.ts`/`SandRenderer`, `settings.ts`, and `useRakeLoop`'s
  state machine are reused unchanged. Churn is concentrated in tokens, the page
  layout, the control components (compact strip forms), two new pieces
  (`TunePopover`, `SavedTray`), and `MechRenderer` (coupling).
- `data-testid`s were preserved on every control, so `.iwft` churn is limited to
  the *navigation* to a control (open the popover, expand the tray) plus the new
  stage/console reflow assertions — not the selectors.
- The console's "dim until reached" is the likeliest a11y regression; it is
  guarded by keeping resting token colours above AA on the room bg and treating
  opacity as emphasis only.
- Infra is untouched: subdomain, ports, `fly.toml`, Dockerfile, CI, compose are
  unchanged (the app's shape and route don't change). Still stateless (ADR 0008).
