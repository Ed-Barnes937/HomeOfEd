# 17 - Open the door on the street

**Status:** ready-for-agent (the last build ticket)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 10, 11, 12, 13, 14, 15, 16, 20, 21, 22, 23 (not 24 and 25, which wait on Ed's art;
the branch is never deployed before Ed merges it)
**Parallel with:** none
**Model:** sonnet
**Gate:** code review only (the street is shot at ticket 18's whole-shop gate)
**ADR:** none new; amend 0097 (a third open door)
**Dev port:** 3040

## Goal

Open Bubble & Brew: give its street entry a door so the potion shop lights up under the pointer,
gets a signpost on the phone and an Enter button on touch, like the wand shop and the smithy. Not
before every other build ticket has landed, so the epic branch never shows a half-built shop as
open. **Integration point: the full verify loop runs at the end.**

## Read first

- `spec.md`: "The experience, on a phone" (step 1), "Shop copy" (the door label), "Rules for the
  team".
- ADR 0097 (the street, its painting, lights and signposts).
- Source: `src/street/shops.ts` (+ `shops.test.ts`), `src/street/StreetPage.tsx`,
  `src/testing/StreetPom.ts`, `src/street.iwft.tsx`, `apps/armoury/public/street/street.webp` and
  `street-dark.webp` (the potions front: roughly x 1190-1433, y 322-960 of 2752x1536).

Paths are relative to `apps/armoury/`.

## Files you own

`src/street/shops.ts` (+ `shops.test.ts`), `src/testing/StreetPom.ts`, `src/street.iwft.tsx`,
`docs/adr/0097-armoury-street-and-last-shop.md` (an amend note).

## Scope

1. **`shops.ts`**: the `potions` entry gets `to: '/potions'` (its door label is already in
   `DOOR_LABELS`, from ticket 07). Add `spill` only if the lit painting shows the shop's light
   reaching past its outline (lamp glow on the lane or the wall); trace it as closed absolute
   paths like the smithy's, checked by overlaying it on the lit painting (write the overlay to
   `shots/17/spill-overlay.png`, absolute path). If the light stays inside the front, no spill.
2. **Tests that used the potion shop as the shut example** (`tapShutShop('potions')` in
   `street.iwft.tsx`, the `potions` cases in `shops.test.ts`) move to another shut shop
   (`bows`), so they still test a shut shop.
3. **`StreetPom`**: three doors in the street's DOM order (`Go into the wand shop`, `Go into the
   smithy`, `Go into the potion shop`); signposts in street order (wand shop, potion shop,
   smithy); a `enterPotionShop()` that returns an `ApothecaryPom`.
4. **ADR 0097 amend note**: the third door, the spill decision.

## Acceptance

Each an iwft in `src/street.iwft.tsx` unless noted:

- The street shows three open doors; the potion shop's opens `/potions`.
- On a phone there are three signposts in street order, and the potion shop's slides the street to
  it; on touch, a tap picks it and "Enter Bubble & Brew" goes in.
- A visitor last in the potion shop who goes back to the street finds it scrolled to Bubble & Brew.
- A first visit still lands on the street; a potion link still lands in the potion shop.
- Unit: `signposts()` lists wands, potions, smithy; `lightShapes` of the open potion shop is its
  outline (and spill).
- Every other street, shop and shelf test passes.

## Tests to write first

The iwft and unit cases above, before the data change.

## Verify (integration point: run all of it)

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run
pnpm --filter armoury exec playwright test -c playwright-ct.config.ts   # ask the orchestrator first (port 3111)
pnpm --filter armoury run build
```

## Out of scope

- Repainting the street, renaming the shop, the street's look (judged at ticket 18).

## Comments
- 2026-11-13 planner (re-plan): blockers updated for tickets 20-23; nothing else in this ticket changes with the new mechanic.
