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

**Status:** claimed

- [ ] Grid container has `role="application"` and a self-describing
      `aria-label` stating the keyboard contract
- [ ] Arrow keys move the grid cursor; Enter toggles; Backspace removes
- [ ] Spacebar toggles play globally, with `preventDefault` so it never
      scrolls or re-triggers a focused button
- [ ] Focus rings visible on keyboard use
- [ ] No flashing imagery anywhere in the app
- [ ] Keyboard path covered by a whole-frontend test
