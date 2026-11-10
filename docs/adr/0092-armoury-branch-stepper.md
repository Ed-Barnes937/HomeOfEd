# 0092 - armoury "Which branch" is stepped, not slid

- **Status:** Accepted
- **Date:** 2026-11-10
- **Related:** [ADR 0084](0084-armoury-branch-wands.md) (the Branch kind and its
  "Which branch" seed).

## Context

"Which branch" picks one of 100 seeded branches. ADR 0084 gave it a 0-99 slider
like the other branch controls. But its values have no order: branch 40 is no
more of anything than branch 39, so a slider's "less to more" track says
something untrue, and dragging it flickers through unrelated branches. Ed asked
for next and previous buttons instead.

## Decision

- **"Which branch" is a stepper**: a previous button, the branch's number and a
  next button. The other number controls stay sliders, because their values do
  run from less to more.
- **It wraps.** Next on the last branch goes to the first, and previous on the
  first goes to the last, so neither button ever goes dead.
- **The number shown counts from 1** (1-100). The saved `branchSeed` is still
  0-99, so saves and shared links are unchanged.
- **The widget is picked by key** in `GroupControls`, the same way the ruler and
  the wood picker are. The schema gains no new param kind.

## Consequences

- Reaching a far-off branch takes many taps. That is fine: the control is for
  browsing, and "Try another" still jumps to a random one.
- A screen reader hears a group named "Which branch" with "Previous branch" and
  "Next branch" buttons, and the number is announced as it changes.
