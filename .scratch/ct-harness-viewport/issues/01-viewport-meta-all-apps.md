# 01 - Every app's CT harness lacks the viewport meta and doctype

**Status:** ready-for-agent
**Type:** task
**Source:** found during silt ticket 26
(`.scratch/silt-discovery-tree/issues/26-viewport-meta-harness-lie.md`,
2026-09-05), which fixed silt only (surgical scope). This ticket is the
monorepo sweep.
**Spec:** test harness - `apps/*/playwright/index.html`,
`templates/starter/playwright/index.html`.

Silt's Playwright CT harness page had no `<meta name="viewport">` and no
`<!doctype html>`: every "mobile" iwft laid out at Chromium's 980px fallback
in quirks mode, and the harness hid two real document-overflow bugs plus a
picker-sizing bug. The same gap exists in every other app and in the copy
base: `apps/{boop,boids,espy,fridge,hub,karesansui,sprout,wotd}/playwright/index.html`
and `templates/starter/playwright/index.html`.

## Design

- **The starter first**: fixing `templates/starter` stops the gap reaching
  every future app.
- Then each app: add the doctype and the viewport meta, run that app's iwft
  suite, and fix whatever real layout bugs surface at a true phone width -
  in the elements' own CSS, never by weakening assertions (silt's fix,
  `min-width: 0` on the unshrinkable chrome row, is the likely shape
  elsewhere too).
- One app per commit, so a suite that turns red is bisectable to its app.
- Silt is done and is the reference: ADR 0053 and silt ticket 26's Outcome
  section carry the measurement method.

## Tests

- Per app: the mobile iwfts (where they exist) green under the corrected
  harness; a no-horizontal-overflow check at a true 390px where the app has
  a POM helper for it.
