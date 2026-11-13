# 08 - The pour picker (plain swatches)

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 07
**Parallel with:** 09
**Model:** sonnet
**Gate:** code review only
**ADR:** none of its own; add a "The pour picker" section to 0108

## Goal

The shop's main interaction: tap a jar to pour it in, see the pours in order, take one out (the
rest shift down), empty the bottle. One widget owns the whole Pours group through the existing
per-param widget hook. Jars show plain colour swatches with their names until ticket 16 swaps in
pictures (O6).

## Read first

- `spec.md`: "The experience, on a phone" (steps 3 and 4), "The item" (pours, no gaps,
  compaction), "Accessibility and reduced motion" (the picker bullets), "Testing".
- Source: `src/shop/controls/GroupControls.tsx` (a widget returning `null` renders nothing;
  returning `undefined` falls through to the plain control), `src/shop/controls/Widgets.tsx`
  (`SwatchPicker`, `OnChange`, the field and label styles), `Widgets.module.scss`,
  `src/shop/controls/Panel.tsx` and `Sheet.tsx` (where a group renders, desk and phone),
  `src/smithy/swordWidgets.tsx` (a shop's widget function); `src/potion/pours.ts`,
  `potionSchema.ts` (`POUR_KEYS`, `potionSwatchFor`), `ingredients.ts`; ticket 07's
  `src/apothecary/apothecary.ts`, `src/testing/ApothecaryPom.ts`, `src/apothecary.iwft.tsx`.

Paths are relative to `apps/armoury/`.

## Files you own

New `src/apothecary/pourPicker.tsx` (+ `pourPicker.module.scss`), new
`src/apothecary/potionWidgets.tsx`, `src/apothecary/apothecary.ts` (the `widget` line),
`src/testing/ApothecaryPom.ts` (pour methods), new `src/pours.iwft.tsx`,
`docs/adr/0108-armoury-potion-shop-on-the-shell.md` (one section). After you,
`pourPicker.tsx` passes to ticket 16.

## Scope

1. **`potionWidgets.tsx`**: `potionWidget(def, props)`: for `pour1` return `<PourPicker>`; for
   `pour2`-`pour4` return `null` (the picker draws them); for `glass` a `SwatchPicker` with the
   tints from `potionSwatchFor`; everything else `undefined` (plain controls). Wire it as
   `apothecary.widget`.
2. **`PourPicker`**, in this order inside the group:
   - **The jars:** a grid of nine buttons, three columns at every width, in the table's order.
     Each shows a swatch (a 28 px circle of the ingredient's colour with a fine light rim, so the
     dark ones read on the dark panel) and its label beneath; accessible name "Pour in {Label}".
     A tap calls `onChange(nextPourKey(params), id)`. When the bottle is full every jar has
     `aria-disabled="true"` (still focusable, a tap does nothing) and a line of text above the
     grid says "The bottle is full. Take one out to pour another."
   - **In the bottle:** a list headed "In the bottle", top pour first (it reads like the bottle,
     top to bottom), four rows always: a filled row shows the swatch, the label and a "Take out"
     button named "Take out {Label}" which calls `onChange(thatKey, 'none')` (the item's
     `follows` shifts the rest down); an empty row says "Empty" in a dim style.
   - **Empty the bottle:** a text button shown while there is at least one pour; it calls
     `onChange` for each filled key from the top down in one handler (React batches them, so the
     stage sees one change).
   - **Live region** (`aria-live="polite"`, visually hidden): "{Label} poured in. {Count} of four."
     / "{Label} taken out." / "The bottle is empty."
   - On the phone the picker sits in the Pours tab; the list's rows become a compact row of four
     chips under the grid if the tab would otherwise scroll at 390x844 (decide by measuring;
     keep the same names and buttons).
3. Keyboard: every control reachable in order (jars, then the list, then Empty), visible focus
   rings at 3:1, Enter and Space work.
4. **ADR 0108 section**: one widget owns the group (others return `null`); a pour is a `set` on
   the lowest empty slot; take-out compaction lives in `follows`, not the widget or the reducer;
   empty as batched sets.

## Acceptance

Each an iwft in `src/pours.iwft.tsx` through `ApothecaryPom` (`pour(label)`, `takeOut(label)`,
`emptyBottle()`, `verifyPours(labels bottom first)`, `verifyFull()`):

- Pouring adds a layer on top: the stage's `data-pours` and the list both show it, and the card's
  name and tag line change.
- Four pours fill it: the jars report full and a fifth tap changes nothing.
- Taking out a middle pour shifts the ones above down, in order.
- Empty the bottle leaves `data-pours` empty and the card says it is empty.
- The same jars in another order make a potion with another name.
- With the Pours group locked, Try another keeps the pours; unlocked, it changes them.
- A pour survives a reload; "Put the last one back" after Try another restores the old pours.
- The live region announces a pour and a take-out.
- Keyboard only: Tab to a jar, press Enter, the pour lands.
- Phone (390x844): the Pours tab shows all nine jars and the four pours without the sheet
  covering the bottle beyond what the other shops' sheets do.

## Tests to write first

The iwft list above, before the code. No new unit tests (the helpers are ticket 03's).

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec playwright test -c playwright-ct.config.ts src/pours.iwft.tsx src/apothecary.iwft.tsx   # ask the orchestrator first
```

## Out of scope

- Pictures on the jars (16). The pour's animation in the stage (12).
- Drag and drop. A "stir" control (cut).

## Comments
- 2026-11-13 orchestrator, from the scene mock (ticket 02, decision O17): dark swatches (Thundercloud, Bog murk) are low in contrast against the dark tile; give every swatch a light ring so its edge reads. The name still carries the meaning.
