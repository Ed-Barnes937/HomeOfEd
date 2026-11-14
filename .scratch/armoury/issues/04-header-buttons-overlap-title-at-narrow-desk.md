# 04 - The shop header's buttons overlap "Armoury" at 900 to 1024px wide

**Status:** needs-triage
**Type:** bug
**Raised:** 2026-11-14, seen in the first review of armoury-potions ticket 13
(`.scratch/armoury-potions/reviews/13-r1.md`)

## What happens

At desk widths of about 900 to 1024px (an iPad in landscape is 1024x768) the
shop header's buttons overlap the "Armoury" title. It shows in the smithy as
well as the potion shop, so it comes from the shared shell, not from the
potions epic.

## Evidence

Frames taken by the reviewer at 900x700 and 1024x768, potion shop and smithy:
`.scratch/armoury-potions/shots/13/review-r1/` (local, not in git).

## To find out

- Which header layout rule applies between the phone breakpoint and a full
  desk width, and whether the title should shrink, the buttons should lose
  their labels, or the header should wrap there.
- Whether this is the same measurement the flaky header test watches
  (`03-flaky-header-width-test.md`, "at 1350px").

## Comments
- 2026-11-14: seen again by ticket 10's fix builder at 900x900 in the potion shop; there the bottle's right edge is also cut by the scene's edge at that width (that part is the potion scene's, for the potions epic's final gate).
