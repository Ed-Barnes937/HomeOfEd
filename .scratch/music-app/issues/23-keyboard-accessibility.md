# 23 — Keyboard + accessibility

**What to build:** The grid becomes fully drivable by keyboard, and the
accessible contract is self-describing. Arrow keys move around the grid,
Enter/Backspace toggle and remove, spacebar toggles play from anywhere on the
page, and keyboard users see focus rings.

**Design:** focus-ring visuals are explicitly **not yet designed** (called
out in the handoff, `docs/reference/boop-design/README.md`). Use a treatment
consistent with the tokens (`--cyan-solid` is the design's focus border on
paper) and flag it for design review rather than inventing a new idiom.

**Blocked by:** 15 — Grid feel.

**Status:** resolved

- [x] Grid container has `role="application"` and a self-describing
      `aria-label` stating the keyboard contract
- [x] Arrow keys move the grid cursor; Enter toggles; Backspace removes
- [x] Spacebar toggles play globally, with `preventDefault` so it never
      scrolls or re-triggers a focused button
- [x] Focus rings visible on keyboard use
- [x] No flashing imagery anywhere in the app
- [x] Keyboard path covered by a whole-frontend test

## Comments

Resolved 2026-08-06 (agent, Sonnet). Landed in `02b94b5` on `music-app`.
`useGridKeyboardNav` shared by Grid and PhoneGrid: arrows move focus
(clamped at edges, native buttons so rings follow focus — no roving
tabindex needed), Backspace force-removes, Enter rode the existing
click-with-detail-0 path. Global Space listener with preventDefault,
exempting editable targets via pure `isEditableTarget` (rename field still
types spaces — iwft-tested). aria-label now states the full keyboard
contract on both grids. Focus ring corrected from `--cyan` to
`--cyan-solid` (pre-existing token misuse from ticket 15; visual still
placeholder — **flagged for design review** per the handoff's explicit
focus-ring gap). No-flashing audit: every @keyframes in the app checked —
all single-shot transform animations, none loop or strobe, all respect
prefers-reduced-motion. 6 new keyboard iwft tests. Gate re-verified by
orchestrator: lint/typecheck clean, vitest 199/199, playwright CT 50/50.
