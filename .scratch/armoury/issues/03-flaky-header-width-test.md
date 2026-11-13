# 03 - Flaky test: the header's width at 1350px

**Status:** needs-triage
**Type:** bug
**Raised:** 2026-11-13, seen during the second review of armoury-potions ticket
04 (`.scratch/armoury-potions/reviews/04-r2.md`)

## What happens

`apps/armoury/src/profiles.iwft.tsx:177` (the shop header's width test at
1350px) failed once in a full Playwright CT run, with port 3111 free, on a
branch that does not touch the header. The suite alone then passed three times
(10 of 10 each), and a second full run passed.

## To find out

- Whether the header is measured before its fonts or the player chip have
  settled (the test re-measures the header's steps with a 22-character name).
- Whether it only fails when the whole CT suite runs, which points at load or
  ordering, not at the header.

## Comments
- 2026-11-13: seen again in the second review of armoury-potions ticket 06, a branch that does not touch the header: one failure in a full CT run ("at 1350px", expected at least 490.6, got 460.75), then 10 of 10 alone. A full CT run on the epic branch at 1bc0e777 passed 108 of 108.
