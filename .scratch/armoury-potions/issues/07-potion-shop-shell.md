# 07 - The potion shop on the shell: kind, route, saves, links, shelf, fakes

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 03, 05
**Parallel with:** 06 (if still running), 01, 02 (waiting on Ed)
**Model:** opus
**Gate:** code review only
**ADR:** 0108 (write it; ticket 08 adds a section)

## Goal

Make the potion shop work end to end with fake stages: register `potion` as the third kind,
give it its save key and link field, a `/potions` route with a plain functional scene on the
shared shell, its groups, the generic close look without a flourish on arrival, a Potions
section on the shelf, and the fakes, page objects and iwft suite that pin it down. The street
door stays shut (ticket 17). **Integration point: the full verify loop runs at the end.**

## Read first

- `spec.md`: "The item" (groups), "Save and share", "The shelf", "Shop copy", "The close look"
  (the hold: no flourish on arrival), "Accessibility and reduced motion", "Rules for the team",
  "Build order and ownership" (why this one ticket widens every union).
- `apps/armoury/CLAUDE.md` ("Adding a shop", "Behind the estate gate", the rules on saves,
  `/shared`, the root redirect).
- ADRs 0093 (decision 6, the shared view), 0094, 0096, 0097.
- Source: `src/items/item.ts`, `src/items/registry.ts` (+ test), `src/landing.ts` (+ test),
  `src/persistence/storage.ts`, `src/persistence/profileKeys.ts`, `src/persistence/lastShop.ts`,
  `src/share/shareLink.ts` (+ test), `src/views.tsx`, `src/router.tsx`,
  `src/workbench/WorkbenchProvider.tsx`, `src/shop/shopView.ts`, `src/shop/ShopPage.tsx`,
  `src/shop/CloseUp.tsx`, `src/shop/wandShop.ts`, `src/shop/Tag.tsx`, `src/shop/useDisplay.ts`,
  `src/smithy/*` (the worked example: `smithy.ts`, `Anvil.tsx`, `swordGroups.ts`,
  `SwordOutline.tsx`), `src/shelf/ShelfPage.tsx`, `src/street/shops.ts` (`DOOR_LABELS`),
  `src/styles/tokens.scss`, `src/share/smithyCard.ts`, `src/testing/*`, `src/smithy.iwft.tsx`,
  `src/shelf.iwft.tsx`, `src/sharedView.iwft.tsx` for the suite style,
  `packages/test-kit/README.md`; tickets 03 and 05's `src/potion/*`.

Paths are relative to `apps/armoury/`.

## Files you own

- Widening, all in one commit: `src/items/item.ts` (`ITEM_KINDS`), `src/items/registry.ts`
  (+ test), `src/landing.ts` (+ test), `src/persistence/storage.ts` (`POTION_SAVE_KEY`),
  `src/persistence/profileKeys.ts`, `src/views.tsx` (`SHOPS`), `src/router.tsx` (one route),
  `src/workbench/WorkbenchProvider.tsx` (the potion bench), `src/shop/shopView.ts` (`path`,
  `shop`, `closeUp.flourishOnArrival`), `src/shop/CloseUp.tsx` (arrival), `src/shop/wandShop.ts`
  and `src/smithy/smithy.ts` (`flourishOnArrival: true` only), `src/street/shops.ts`
  (`DOOR_LABELS['/potions']` only, no `to`), `src/potion/item.ts` (type it `ItemDef`, use
  `POTION_SAVE_KEY`).
- New `src/apothecary/`: `apothecary.ts`, `BrewingTable.tsx` (+ `.module.scss`),
  `potionGroups.ts` (+ test), `PotionOutline.tsx`.
- `src/shelf/*`, `src/share/apothecaryCard.ts` (new, a stand-in), `src/styles/tokens.scss` (a
  plain `[data-shop='apothecary']` block), `src/testing/*` (new `FakePotionStage.tsx`,
  `ApothecaryPom.ts`; edits to `FakeStage.tsx`, `iwftTest.tsx`, `ShelfPom.ts`, `address.ts`),
  `src/apothecary.iwft.tsx` (new), additions to `src/shelf.iwft.tsx` and
  `src/sharedView.iwft.tsx`.
- `docs/adr/0108-armoury-potion-shop-on-the-shell.md`.

## Scope

1. **Register the kind** (one commit, so no `Record<ItemKind, ...>` is ever partial):
   `ITEM_KINDS` `['wand', 'sword', 'potion']`; `ITEMS.potion = potionItem`; `POTION_SAVE_KEY =
   'armoury:save:potion'` beside the others and in `PROFILE_KEYS` and `testing/address.ts`;
   `ShopPath` and `SHOP_PATHS` gain `/potions`; `ShopView.path` gains `'/potions'` and
   `ShopView.shop` gains `'apothecary'`; `SHOPS` in `views.tsx`; a potion bench in
   `WorkbenchProvider`; the shelf's records; `DOOR_LABELS['/potions'] = 'Go into the potion
   shop'` with no `to` on the street entry. Never bump `SAVE_FORMAT_VERSION`.
2. **`closeUp.flourishOnArrival: boolean`** on `ShopView`: `CloseUp` calls `flourish` on arrival
   only when it is true. The wand shop and the smithy set `true` (their behaviour and tests do
   not change); the potion shop `false`.
3. **`apothecary/apothecary.ts`**: `apothecaryCopy` (the spec's "Shop copy" column exactly) and
   `apothecary: ShopView` with `item: potionItem`, `path: '/potions'`, `shop: 'apothecary'`,
   `Scene: BrewingTable`, `groups: visibleGroups`, no `widget` yet (ticket 08), `paintCard:
   paintApothecaryCard`, `closeUp: { flashDelaySeconds: null, flourishOnArrival: false }`.
4. **`apothecary/BrewingTable.tsx`**, functional only: `useDisplay({ stageRef })` (no
   `restsFlat`; a drag turns the bottle about its upright axis). Root `data-testid="counter"`;
   the button carries `aria-haspopup="dialog"` and `copy.sceneButton`; the stage slot placed so
   the stage's foot line lands on `BASE_LINE` (`potion/framing.ts`); the `Tag` as the recipe card
   (name, number, tag line, rename); the hint; `CloseUp` when lifted. A plain dark ground and a
   flat table edge are enough: ticket 13 paints it. No wand or sword imports.
5. **`apothecary/potionGroups.ts`**: `visibleGroups(p)` for `pours` "What goes in" (tab Pours,
   summary "Three pours", "One pour", "Empty"), `bottle` "The bottle" (tab Bottle, summary the
   shape label), `finish` "Stopper and label" (tab Finish, summary the stopper label), numerals
   counted over the groups shown.
6. **`apothecary/PotionOutline.tsx`**: inline SVG from `potionOutline(compilePotion(params))`:
   the glass outline in a faint line, the bands filled with their colours, the stopper; for the
   shelf (and anything else 2D).
7. **Shelf**: a Potions section after Swords, shown only when it has entries; an entry is the
   shelf's box with `PotionOutline`, its name, number, `shelfLine` and a seal in `glow`; Take it
   out loads it on the potion bench and goes to `/potions`; Share, Rename and Remove on its own
   kind; back link "Back to the brewing table" when the potion shop was the last shop; the empty
   and intro words from the spec. Generalise the shelf's two-kind counting into a loop over
   `SHELVES`; a wand-only and a sword-only visitor's shelf must look and test exactly as before.
8. **`share/apothecaryCard.ts`**, a stand-in: `paintApothecaryCard(ctx, content)` fills a dark
   ground, draws the capture and the tag via the shared helpers, so Picture works end to end.
   Ticket 13 replaces it.
9. **`tokens.scss`**: a plain `[data-shop='apothecary']` block (dark ground, paper card, text at
   AA contrast) reusing the default tokens' names. Ticket 13 replaces the values.
10. **Fakes** (`testing/FakePotionStage.tsx`): a box fake with `data-testid="stage"`,
    `data-item="potion"`, `data-shape`, `data-neck`, `data-glass`, `data-stopper`, `data-label`,
    `data-pours` (ingredient ids bottom first, comma-separated, empty string when empty),
    `data-effect` (`potionEffect(params)?.kind ?? 'none'`), `data-blend` (`secretBlend(params)?.id
    ?? 'none'`); a close-look fake with `data-flourishes` and the two stand-in buttons, as the
    sword's. Register under `potion` in `fakeStages` and `failingStages`.
11. **Page objects and fixture**: `ApothecaryPom` extends `BenchPom` with the copy,
    `verifyStage(facts)`, `openCloseLook()`, `verifyFlourishes(n)`; `ShelfPom.verifyItems('potion',
    names)` works; `apothecaryTest` and `failedApothecaryStageTest` in `iwftTest.tsx` (start
    `potion`). Existing fixtures keep their names and roots.
12. **ADR 0108**: the third kind per ADR 0096 (key, field, path, last shop value, no version
    bump); `apothecary` as the shop's name in code; `flourishOnArrival` and why the potion waits
    for a tap; the shelf generalised over kinds; that the street door opens only in ticket 17.
    Status Accepted.

## Acceptance

Behaviours, each an iwft in `src/apothecary.iwft.tsx` unless noted:

- A first visit to `/potions` shows the first-visit potion with its name, number and tag line;
  the fake stage shows its three pours.
- Choosing a bottle shape, glass, stopper or label changes what the stage is asked to draw and
  the card (one test across a few).
- Phone: the sheet's tabs are Pours, Bottle and Finish.
- Try another changes the potion and can be undone; a locked Bottle group survives it; the
  pours are never fewer than two after it.
- Rename shows on the card and survives a reload; a reload keeps the potion.
- Keep puts it on the shelf under Potions; Take it out returns to `/potions` with it on the
  table (in `src/shelf.iwft.tsx`, beside a kept wand and sword).
- A potion link at `/shared` opens the potion shop with that potion; Keep takes it to
  `/potions` (in `src/sharedView.iwft.tsx`).
- The potion bench does not disturb the wand or sword bench (edit one, visit another, come back).
- A tap on the bottle opens "Your potion, up close" with **no** flourish on arrival
  (`data-flourishes` 0), a tap on the bottle asks for one (1), Put it back closes it.
- Picture downloads a png named after the potion.
- The street still shows two open doors (the potion door stays shut).
- Unit: `potionGroups.test.ts`; `registry.test.ts` (three kinds, three keys, link read order);
  `landing.test.ts` (a potion link lands on `/potions`).
- Every existing wand, sword, shelf, street and shared-view test passes untouched (apart from
  the additions above).

## Tests to write first

The iwft list above, through `ApothecaryPom` and `ShelfPom`, before the code; state through the
UI only; stage facts, never pixels. The unit tests above. Nothing for the generator.

## Verify (integration point: run all of it)

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run
pnpm --filter armoury exec playwright test -c playwright-ct.config.ts src/apothecary.iwft.tsx   # ask the orchestrator first (port 3111)
pnpm --filter armoury exec playwright test -c playwright-ct.config.ts                           # then the whole set
pnpm --filter armoury run build
```

Check the build's chunks: the main chunk may hold `potion/compile.ts`, `profile.ts`,
`outline.ts`, `framing.ts` and the tables, never `potion/geometry.ts` or `tipped.ts`.

## Out of scope

- The pour picker (08): until it lands the pours show as the shell's plain pills.
- The real stage (09 onward), the scene art and the real picture (13), the street door (17).

## Comments
- 2026-11-13 orchestrator, from the review of ticket 05: `src/potion/item.test.ts` hands `createWorkbench` `{ ...potionItem, kind: 'wand' }` because `ItemKind` had no `potion` yet. This ticket owns that test file too: drop the override once `ItemKind` is widened (it would still compile, so nothing forces it).
- 2026-11-13 orchestrator, from the scene mock (ticket 02, decision O17): start the `[data-shop='apothecary']` token block from the palette in `/Users/edward.barnes@glean.co/Code/Worktrees/HomeOfEd/armoury-potions/.scratch/armoury-potions/mock/mock.css`; its text and ground pairs were measured at AA (ratios in `shots/02/contact-sheet.md`).
