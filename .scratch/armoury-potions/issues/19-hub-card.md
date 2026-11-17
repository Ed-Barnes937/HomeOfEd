# 19 - Hub card: a potion beside the wand and sword

**Status:** built and reviewed, local only; waits for Ed to push it and merge it after the epic PR
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** none to build; Ed merges it after the epic's PR (the card must not show a potion
before the potion shop is live)
**Parallel with:** everything (another app, another branch)
**Model:** sonnet
**Gate:** code review only (and a look at the card in both themes and with reduced motion)
**ADR:** none

## Goal

The hub's Armoury card shows a wand and a sword crossed. Once the potion shop is live it should
show a potion too. Hub-card and announcement changes go to main on their own, outside the epic
branch (Ed's rule from the boop and silt epics), so this is its own small PR.

## Branch and PR

Branch `hub-armoury-potion-card` from `main` (not from `armoury-potions`), in its own worktree.
Commit message `hub: the Armoury card shows a potion beside the wand and sword`, no co-author or
agent attribution lines. The orchestrator pushes it and opens a PR to main titled the same, with
a body saying "Merge after the armoury-potions PR"; Ed merges it. Do not push yourself.

## Read first

- `apps/hub/CLAUDE.md`.
- `spec.md`: "The ingredients" (colours), "Secret blends" (not needed here), the copy.
- Source: `apps/hub/src/pages/HomePage.tsx`: the `Armoury` entry in `APPS` (`kind: 'armoury'`),
  `drawArmoury` (the crossed wand and sword, the wand's tip glow and the sword's glint, the
  reduced-motion path through `drivePreview`), one neighbouring preview;
  `apps/hub/src/testing/HomePagePom.ts` (`verifyArmouryLink`), `apps/hub/src/home.iwft.tsx`.

## Files you own

`apps/hub/src/pages/HomePage.tsx` (the `drawArmoury` function and its lead comment only).

## Scope

1. In `drawArmoury`, add a small stoppered flask standing in front of the crossing (or to one
   side, decided by eye): a teardrop flask outline with a faint glass rim, three flat bands in
   Moonmilk, Rosehip and Starpetal colours, a cork, in tones that work in the dark and light
   themes (`darkRef`).
2. One quiet motion: a small bubble rises in the flask every few seconds, subtle beside the
   wand's glow and the sword's glint.
3. Reduced motion, through `drivePreview` as every card: the first frame shows the wand, the
   sword and the flask whole, without depending on the bubble.
4. Update the function's lead comment (one or two lines).

## Acceptance

- The Armoury card shows a wand, a sword and a potion in both themes, and still links to
  `https://armoury.homeofed.com` under the name `Armoury`.
- With reduced motion the card is a still picture of all three.
- No other card changes.

## Tests to write first

None new: the preview is a canvas drawing and `verifyArmouryLink` already pins the card's name
and link. Run the hub suite before and after.

## Verify

```bash
pnpm --filter hub run lint && pnpm --filter hub run typecheck && pnpm --filter hub run test
```

The hub's Playwright CT uses its own port (3100); still tell the orchestrator before running it.
Look at the card with `pnpm --filter hub run dev` in both themes and with reduced motion.

## Out of scope

- The card's name, link, status or dates. Any armoury code.

## Comments
- 2026-11-16 orchestrator: built (Fable) on branch `hub-armoury-potion-card` from main, one commit 53e8406e, not pushed. Review (`reviews/19-r1.md`, Fable): PASS, no must-fix. Checks: hub lint, typecheck, 89 unit and 79 CT. Shots: `shots/19/r1/sheet.png`. Left as they are, both optional: the constant `POURS` is in paint order and `BANDS` would say it better; the lead comment's two lines run past 90 columns. Taste calls for Ed are in `for-ed.md`. The push and the PR wait for Ed's word; it merges only after the epic's PR.
