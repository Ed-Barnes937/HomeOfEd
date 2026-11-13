# 13 - The shop's scene (A), recipe card and picture (P2)

**Status:** ready-for-agent (Ed's picks are in: scene A, picture P2)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 09; the gate shots need 10
**Parallel with:** 10, 20, 21, 22, 11, 14
**Model:** opus
**Gate:** whole shop (the scene round: the composite scene, the card and the picture)
**ADR:** 0110 (write it)
**Dev port:** 3036

## Goal

Paint the potion shop: scene A, the brewing table, as Ed picked it from ticket 02's contact sheet
(plain A, without B's window), built in CSS and SVG like the smithy, around the real bottle; the
recipe card on string; the shop's palette at AA contrast; and the share picture's painter (P2:
the capture over the card's own ground). Moody and candlelit, never hard to read.

## What Ed's pick fills in

E7 (scene A, plain), E12 (picture P2), E11 (light M1: the candle on the left matches the
stage's key). From O17: the mock's `[data-shop='apothecary']` palette in `mock/mock.css` is the
starting token set, and the bottle's foot sits at about 0.70 of the scene on desk and 0.62 on
the phone (settle both here in `BASE_LINE`). Ed's open note on bottle size (for-ed section 7) is
yours to judge with the art in: grow it 10-15 percent if the reviewer agrees, and say so.

## Read first

- `spec.md`: "The look and the scene, in words" (scene, framing, picture), "Accessibility and
  reduced motion" (contrast, flicker), "Shop copy", "The shelf", "Rules for the team".
- `decisions.md` (absolute path); `shots/02/contact-sheet.png` and `.md` (absolute path); the
  mock's HTML in `.scratch/armoury-potions/mock/`.
- ADR 0101 (the smithy's scene, ticket and picture) and its source as the pattern:
  `src/smithy/Anvil.tsx`, `ForgeWall.tsx`, `forgeArt.ts`, `anvilArt.ts`, `grain.ts`,
  `sceneArt.test.ts`, `src/share/smithyCard.ts`, the `[data-shop='smithy']` block in
  `src/styles/tokens.scss`, `src/shop/Tag.tsx` and `Tag.module.scss`.
- Ticket 07's `src/apothecary/BrewingTable.tsx`, `src/share/apothecaryCard.ts`,
  `src/shelf/ShelfPage.tsx`; ticket 10's stage lights (to match the scene's light directions)
  and `capture()`; `src/potion/framing.ts` (`BASE_LINE`), `describe.ts` (`isGold`, after 20).

Paths are relative to `apps/armoury/`.

## Files you own

`src/apothecary/BrewingTable.tsx` (+ `.module.scss`), new `src/apothecary/tableArt.ts` (+
`tableArt.test.ts`), new `src/apothecary/RoomWall.tsx` (+ `.module.scss`) or the picked
composition's equivalent (wired in through `BrewingTable.tsx`; `apothecary.ts` is ticket 21's and
already points at `BrewingTable` and `paintApothecaryCard`), `src/share/apothecaryCard.ts`, `src/styles/tokens.scss` (the `[data-shop='apothecary']` block),
new `src/apothecary/palette.test.ts`, `src/shelf/ShelfPage.module.scss` and `ShelfPage.tsx` (the
potion box's look only), `src/potion/framing.ts` (`BASE_LINE`, coordinated with ticket 10's
builder through the orchestrator), `docs/adr/0110-armoury-potion-shop-scene-card-and-picture.md`.

## Scope

1. **The scene**, built as the smithy's: seeded SVG art made once on the shop's first visit (not
   at module load), the bottle's stage slot on the base line, the table drawn to meet the bottle's
   foot, a soft contact shadow under the bottle from its outline (`potionOutline`) offset away
   from the key light, the candle and its light in the scene matching the stage's key, the bottle's
   glow tinting the table near it (CSS, from `glow`). Live elements: a candle flicker of a few
   percent and nothing else; off under reduced motion.
2. **The recipe card:** the shared `Tag` styled as a recipe card on string beside the bottle:
   number, name (renameable), tag line; gold edge and ink for a mixed secret blend (`isGold`).
   It must hold the longest names and tag lines the generator makes (an unmixed "Double
   Thundercloud and Snailshine", a mixed "Mixed from Thundercloud, Snailshine and Moonmilk in a
   square-shouldered bottle.") on a phone without clipping.
3. **Palette** under `[data-shop='apothecary']`: dark, candle-warm, with text, card and controls
   at WCAG AA. **`palette.test.ts`** reads that block from `tokens.scss` and checks each text and
   ground pair the shop uses (panel text, lore, card ink on paper, hint on the scene, focus ring)
   is at least 4.5:1 (3:1 for large text and focus).
4. **The picture (P2):** `paintApothecaryCard` draws the scene's ground, table and candle, the
   bottle's capture (ticket 10's, over the card's ground) on the base line, its shadow, the card with name, number,
   tag line and lore. The wand's and the sword's pictures stay pixel-identical.
5. **Shelf:** the potion's shelf box restyled to sit with the scene (wood and glass rather than
   card), the silhouette unchanged; wand and sword boxes unchanged.
6. **ADR 0110**: scene A as Ed picked it, the scene's build (CSS, SVG, no 3D, no images), light
   directions shared with the stage, the base line, the recipe card, the palette and contrast test,
   the picture.

## Acceptance

- The whole-shop scene round passes, desk and phone, beside the wand shop and the smithy.
- Text everywhere in the shop at AA (the test); the scene moody, the bottle the brightest thing.
- The scene's art is built once on the first visit; a wand-only visit builds none of it.
- Reduced motion: no flicker.
- The wand's and the sword's pictures are pixel-identical to `shots/04/baseline/`.

## Tests to write first

- Unit: `palette.test.ts`; `tableArt.test.ts` (the art is seeded and deterministic, builds once).
- iwft: none new (`src/apothecary.iwft.tsx` already downloads the picture); re-run it and
  `src/shelf.iwft.tsx` (ask the orchestrator first).

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/apothecary src/share
pnpm --filter armoury exec playwright test -c playwright-ct.config.ts src/apothecary.iwft.tsx src/shelf.iwft.tsx   # ask the orchestrator first
```

## Gate (whole shop, the scene round)

Protocol: spec rule 15. You may build the art before ticket 10 lands; shoot the gate only on top
of ticket 10's passing materials. Shots into `shots/13/r<N>/`, `--picture --freeze=1.2`: every
preset, the first-visit potion, a mixed secret blend (gold card), the longest names, the tallest
and the shortest bottle (mixed potions draw layered until ticket 23; the scene round judges the
scene, card and picture, not the liquid); desk and
phone; scene, box and picture frames; the shelf with one of each kind; a `--reduced-motion` pass.

The reviewer judges beside the wand shop and smithy scenes in `shots/04/baseline/` and mock A: the composition matches the pick; the bottle stands on the table (shadow, foot,
light); the light in the art agrees with the light on the glass; moody but every word readable;
the card reads as paper on string; the picture is a card a child would want to send.

## Out of scope

- The stage's look (10-12, 23), the close look (14, 23, 15), ingredient pictures (16, 25), the
  street (17).

## Comments
- 2026-11-13 planner (re-plan, E7, E12, E13-E17): build scene A, plain; picture P2. The card's name is the layers' list until the mix, then the revealed name; gold comes with a mixed blend. `apothecary.ts` moved to ticket 21's ownership; you do not need it.
- 2026-11-13 orchestrator: round 1 built (553ea8a9 on `potions/13-scene`, Opus), shots in `shots/13/r1/` (start with `contact-sheet.png`), bottle still in clay. Its gate and review wait until tickets 10, 20, 21 and 22 are merged; whoever merges those into this branch swaps `secretBlend(p) !== null` for `isGold` and adds `mixed: 'yes'` to `recipeCard.test.ts`. The builder's own doubts for the gate: the back wall is dim and generic beside the smithy's forge and window; the picture's room is flatter and brighter than the scene's; on a phone the card covers the table's front and a three-line tag line would clip the hint. It made the bottle about 11 percent bigger in the scene (Ed's taste call from the form gate). `BASE_LINE` stays 0.84 inside the stage; the scene places the foot at 0.70 (desk) and 0.62 (phone) by CSS. Two small edits outside its list (`CardContent.params`, an optional `TagColours.edge`): the gate re-runs the wand and sword picture pixel diff against `shots/04/baseline/`.
