# 23 — Keyboard + accessibility

**What to build:** The grid becomes fully drivable by keyboard, and the
accessible contract is self-describing. Arrow keys move around the grid,
Enter/Backspace toggle and remove, spacebar toggles play from anywhere on the
page, and keyboard users see focus rings.

**Blocked by:** 15 — Grid feel.

**Status:** ready-for-agent

- [ ] Grid container has `role="application"` and a self-describing
      `aria-label` stating the keyboard contract
- [ ] Arrow keys move the grid cursor; Enter toggles; Backspace removes
- [ ] Spacebar toggles play globally, with `preventDefault` so it never
      scrolls or re-triggers a focused button
- [ ] Focus rings visible on keyboard use
- [ ] No flashing imagery anywhere in the app
- [ ] Keyboard path covered by a whole-frontend test
