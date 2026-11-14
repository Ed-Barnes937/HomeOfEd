# 21 - The tap that mixes: the shell, the reveal and the copy

**Status:** done (merged into `armoury-potions` as da8ed967; review 21-r1, test-only fix read by the orchestrator; its clock helper is paused a second ahead on ticket 13's branch)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 20
**Parallel with:** 22, 10, 13
**Model:** sonnet (shell plumbing; iwft through the fake stage is the proof)
**Gate:** code review only
**ADR:** none new; add a "The tap that mixes" section to 0108
**Dev port:** none (CT only, through the orchestrator)

## Goal

Make the tap on the bottle the mix (E14, E15): the potion flourishes on arrival in the close
look, the shell sets `mixed` to `yes` at the pop so the name, the gold and the save change at the
right moment, the close look announces the reveal, "Put the last one back" is not offered in the
potion shop (E17), the copy talks about mixing, and the shelf's outline draws a mixed potion as
one colour. The stage's swirl and effects come later (23, 15); here the fake stage stands in.

## Read first

- `spec.md`: "The experience, on a phone" (steps 4-6, 8), "The close look: lift, swirl, uncork"
  (the reveal, fewer than three), "Shop copy", "The shelf", "Accessibility and reduced motion"
  (the reveal's announcement and timing).
- `decisions.md` (absolute path): E13-E17.
- ADR 0108 (the potion shop on the shell, `flourishOnArrival`), ADR 0113 (ticket 20).
- Source: `src/shop/shopView.ts` (`ShopView.closeUp`), `src/shop/CloseUp.tsx` (`flourish`,
  `arrive`, `putBack`), `src/shop/ShopPage.tsx` (the "Put the last one back" button, `dispatch`),
  `src/workbench/workbench.ts` (`set`), `src/apothecary/apothecary.ts`,
  `src/apothecary/PotionOutline.tsx`; ticket 20's `src/potion/mix.ts`, `compile.ts`;
  `src/testing/FakePotionStage.tsx`, `ShopPom.ts`, `ApothecaryPom.ts`; `src/apothecary.iwft.tsx`,
  `src/shop.iwft.tsx` (or wherever the wand's and the sword's put-back is tested).

Paths are relative to `apps/armoury/`.

## Files you own

`src/shop/shopView.ts`, `src/shop/CloseUp.tsx`, `src/shop/ShopPage.tsx`,
`src/apothecary/apothecary.ts`, `src/apothecary/PotionOutline.tsx`, new
`src/potion/mixBeats.ts`, `src/apothecary.iwft.tsx`, `src/testing/ShopPom.ts` (generic close-look
helpers only), `docs/adr/0108-armoury-potion-shop-on-the-shell.md` (one section, appended).
`src/testing/ApothecaryPom.ts` is ticket 22's: put any potion-only helper you need in the iwft
file itself.

## Scope

1. **`mixBeats.ts`**: `MIX_REVEAL_SECONDS = 1.9` and `MIX_REVEAL_SECONDS_REDUCED = 0.3`, pure
   constants (ticket 23 builds the clock to them and may retune them at its gate).
2. **`ShopView`**, two optional generic fields, so the wand and the sword change nothing:
   - `offersPutBack?: boolean` (default true): `ShopPage` hides "Put the last one back" when
     false. The workbench still records `previous`; only the button goes.
   - `closeUp.reveal?: { seconds: number; reducedMotionSeconds: number; change: (p: Params) =>
     { key: string; value: ParamValue } | null }`: on every flourish (arrival or tap) `CloseUp`
     starts a timer for the right number of seconds; when it fires it hands the change to a new
     `onChange(key, value)` prop that `ShopPage` dispatches as a `set`. A second flourish before
     it fires restarts it; closing the close look (put back, Escape) before it fires makes the
     change at once; a `null` change does nothing.
3. **`CloseUp`**: a visually hidden polite live region that announces "{name}. {lore}" (the
   name as shown, a rename if there is one) when the derived name changes while the close look
   is open, so only a reveal speaks; the wand and the sword never change name there.
4. **The potion** (`apothecary.ts`): `flourishOnArrival: true`; `offersPutBack: false`;
   `reveal` with the two constants and `change: (p) => (three in and not mixed ? { key: 'mixed',
   value: 'yes' } : null)`; the copy from the spec's table (motto, scene hint, close look action
   and hint).
5. **`PotionOutline.tsx`**: a mixed potion's liquid is one flat fill in `spec.mix.colour` to the
   full level; unmixed stays bands.
6. **ADR 0108 section "The tap that mixes"**: why the tap that lifts is the tap that mixes, the
   reveal timer in the shell rather than a stage callback (the stage interface stays the wand's
   and the sword's), closing early, `offersPutBack` and E17, the announcement.

## Acceptance

Each an iwft in `src/apothecary.iwft.tsx` (the fake stage; use `page.clock` or reduced motion so
no test waits on real time) unless noted:

- First visit: the card reads "Moonmilk, Rosehip and Starpetal"; picking the bottle up and
  waiting past the reveal turns it to "Dreamy Rosehip Potion", the fake stage says
  `data-mixed="yes"`, and a reload keeps it mixed.
- Before the reveal the card still shows the unmixed name; putting the bottle back before the
  reveal still mixes it.
- A mixed potion picked up again stays mixed and keeps its name (the replay sets nothing).
- A bottle with fewer than three ingredients picked up and tapped stays unmixed.
- A mixed secret blend shows its name and the gold flag the fake stage exposes.
- The live region announces the reveal once.
- After Try another in the potion shop there is no "Put the last one back"; in the wand shop and
  the smithy there still is (their existing tests pass untouched).
- Unit, if `PotionOutline` has a test home: a mixed potion draws one liquid path in the mixed
  colour.

## Tests to write first

The iwft cases above, against the fake stage, before the shell change.

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/shop src/apothecary src/potion
pnpm --filter armoury exec playwright test -c playwright-ct.config.ts src/apothecary.iwft.tsx src/shop.iwft.tsx src/smithy.iwft.tsx src/shelf.iwft.tsx   # ask the orchestrator first
```

Name the wand and sword suites you ran in Comments.

## Out of scope

- The picker (22). The swirl, the uncorking and their timing on screen (23, 15). The scene and
  the card's look (13).

## Comments
