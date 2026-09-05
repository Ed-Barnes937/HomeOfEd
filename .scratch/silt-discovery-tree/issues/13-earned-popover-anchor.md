# 13 - The EARNED popover opens at the viewport corner, not at the control

**Status:** done (built on worktree-agent-a94db92460afe9744, 2026-09-04)
**Type:** task
**Source:** PR #128 review feedback (Ed, 2026-09-04) - "the element picker
appears in the bottom left - unintuitive. Make it a dropdown pinned either to
the picker or the user's mouse (as long as it doesn't go off screen) - whatever
we think is best". Latitude delegated; the decision below is recorded here.
**Spec:** [../spec.md](../spec.md) §6 "The unlock", decision 8.

`EarnedElements.module.scss:87-91` pins the popover `position: fixed;
bottom: 0.75rem; left: rail-width + 8px` - the viewport's bottom-left corner,
however far that is from the control the user just clicked. The comment there
explains why it is `fixed` at all (the rail is a scroll container; anything
absolutely positioned inside it is clipped and turns the rail into a sideways
scroller) - that constraint is real and stays; the *static* offsets are the
bug.

## Decision

Anchor to the **control**, not the mouse: the control is the thing the user
clicked and the thing that stays on screen after a select (its `aria-pressed`
is the only remaining "brush is loaded" signal), and a mouse-anchored panel has
no stable home for keyboard users at all.

## Design

- Keep `position: fixed`, compute the offsets at open time from the control's
  `getBoundingClientRect()`: open beside the rail, top-aligned with the
  control, flipped/clamped so the popover stays fully inside the viewport
  (the control lives at the rail's foot, so in practice it clamps upward).
- Recompute on window resize while open; the rail scrolling under an open
  popover is fine to ignore (selecting closes it, and it was fixed before).
- The phone bottom-sheet behaviour (`inset: auto 0 0 0`) is right as it is -
  a sheet replacing the bar is the mobile idiom - and does not change.
- Extract nothing shared: this is one component's positioning, not a popover
  framework (the scenes popover has its own anchoring and is not broken).

## Tests

- iwft: unlock mud (seed the store), open EARNED, assert the popover's box
  intersects the control's vertical neighbourhood and lies fully inside the
  viewport; resize narrow, still on screen. Phone project: still the sheet.
