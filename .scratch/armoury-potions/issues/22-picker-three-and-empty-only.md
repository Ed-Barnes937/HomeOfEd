# 22 - The picker: three ingredients, and "Empty the bottle" only

**Status:** done (merged into `armoury-potions` as da8ed967; review 22-r1, test-code fix read by the orchestrator)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 20
**Parallel with:** 21, 10, 13
**Model:** sonnet (UI rework of a built widget; iwft is the proof)
**Gate:** code review only
**ADR:** none new; rewrite the "The pour picker" section of 0108 in place
**Dev port:** none (CT only, through the orchestrator)

## Goal

Rework ticket 08's pour picker for the new mechanic (E17): three slots, the same ingredient as
often as you like, no per-row "Take out", "Empty the bottle" as the only removal, and jars that
say why they are shut when the bottle is full or mixed. The swatch stays as the picture until
ticket 16.

## Read first

- `spec.md`: "The experience, on a phone" (steps 3 and 6), "The item" (pours), "Accessibility and
  reduced motion" (the picker bullets), "Shop copy" (jar messages).
- `decisions.md` (absolute path): E17.
- ADR 0108 ("The pour picker") and ticket 08's reviews in `reviews/08-r*.md` (absolute path):
  focus, phone scroll and the 375x667 note still hold.
- Source: `src/apothecary/pourPicker.tsx` (+ scss), `potionWidgets.tsx`, `potionGroups.ts` (+
  test); ticket 20's `src/potion/potionSchema.ts`, `pours.ts`; `src/testing/ApothecaryPom.ts`,
  `src/pours.iwft.tsx`.

Paths are relative to `apps/armoury/`.

## Files you own

`src/apothecary/pourPicker.tsx` (+ `pourPicker.module.scss`), `src/apothecary/potionWidgets.tsx`,
`src/apothecary/potionGroups.ts` (+ `potionGroups.test.ts`), `src/pours.iwft.tsx`,
`src/testing/ApothecaryPom.ts`, `docs/adr/0108-armoury-potion-shop-on-the-shell.md` (the
existing "The pour picker" section only; ticket 21 appends its own section at the end).

## Scope

1. **Jars**: tapping one pours into the lowest empty slot. Full and not mixed: jars
   `aria-disabled`, visible "The bottle is full. Tap it to mix it, or empty it to start again."
   Mixed: jars `aria-disabled`, visible "This potion is mixed. Empty the bottle to make a new
   one." Tapping a shut jar pours nothing and re-announces the message.
2. **"In the bottle"**: three rows, top first, each the swatch and the label, empty rows "Empty";
   no buttons on the rows. When mixed, the heading reads "Mixed in the bottle".
3. **"Empty the bottle"**: shown while anything is in; sets the slots to `none` from the top
   down (which unmixes); focus to the first jar; announces "The bottle is empty."
4. **Announcements**: "{Label} poured in. One of three." / "Two of three." / "Three of three. Tap
   the bottle to mix it."
5. **Widgets** (`potionWidgets.tsx`): `mixed` renders nothing (as `pour2` and `pour3` do).
6. **Group summary** (`potionGroups.ts`): "Empty", "One", "Two", "Three", or "Mixed".
7. **Tidy-ups moved here from ticket 18's Comments** (they sit in your files): run `prettier
   --write` on every file you touch; `isKeyboardClick` means no pointer was involved (it also
   covers a screen reader's click), so rename it (for example `isPointerlessClick`) and reword
   its comment and the ADR sentence; `emptyButton` in `ApothecaryPom.ts` is either used by
   `emptyBottle()` and `emptyBottleWithKeyboard()` or removed.
8. **`ApothecaryPom.ts`**: ticket 21 edits `src/apothecary.iwft.tsx` in parallel, so keep every
   method that file calls with its name and meaning; remove the take-out methods, and if
   `apothecary.iwft.tsx` calls one, tell the orchestrator rather than editing it.
9. **ADR 0108 "The pour picker"**: rewrite for three slots, empty only, the two shut messages, and
   why there is no take-out (E17).

## Acceptance

Each an iwft in `src/pours.iwft.tsx` unless noted:

- First visit: the bottle is full; the jars are shut with the full message; "In the bottle" lists
  Starpetal, Rosehip syrup, Moonmilk.
- Empty the bottle, then pour Frogfizz, Frogfizz, Bluebell dew: the fake stage reads
  `frogfizz,frogfizz,bluebell`, unmixed; the last announcement asks for a tap on the bottle.
- A mixed potion (load a preset or a link with `mixed: yes`) shows the mixed message and heading;
  emptying it gives an empty, unmixed bottle.
- No "Take out" button exists anywhere in the picker.
- Keyboard: Empty the bottle and pour with Enter and Space; focus lands on the first jar.
- Locking Pours keeps the three and the mixed state through Try another (existing test, updated).
- Unit, `potionGroups.test.ts`: the summary words.
- On a 390x844 phone all nine jars still fit without scrolling (shot with the CT harness or
  checked by the existing phone test).

## Tests to write first

The iwft cases above, adapted from ticket 08's suite, before the picker change.

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/apothecary
pnpm --filter armoury exec playwright test -c playwright-ct.config.ts src/pours.iwft.tsx src/phone.iwft.tsx   # ask the orchestrator first
```

## Out of scope

- Pictures on the jars (16). The close look and the reveal (21).

## Comments
