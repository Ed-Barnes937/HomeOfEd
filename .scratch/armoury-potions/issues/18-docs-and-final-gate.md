# 18 - Docs and the final whole-shop gate

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 17
**Parallel with:** none
**Model:** sonnet
**Gate:** whole shop
**ADR:** none new; cross-links 0104-0112 and amends 0096 (a third kind)
**Dev port:** 3041

## Goal

Finish the epic: bring the app's docs up to three shops, cross-link the ADRs, record where the
build departed from this spec, take the whole shop (and the wand shop and smithy beside it)
through the final gate, and list for Ed what only he can judge.

## Read first

- `spec.md` (all), every ticket's Comments (cuts, departures, taste calls, QUESTIONs).
- `decisions.md` (absolute path).
- `apps/armoury/CLAUDE.md`, `CONTEXT.md`, `README.md`, `index.html`; ADRs 0096, 0097, 0104-0112.
- The swords epic's ticket 14 as the pattern:
  `~/Code/HomeOfEd/.scratch/armoury-swords/issues/14-docs-and-final-gate.md`.

## Files you own

`apps/armoury/CLAUDE.md`, `apps/armoury/CONTEXT.md`, `apps/armoury/README.md`,
`apps/armoury/index.html` (title and description), `docs/adr/0096-*.md` (amend note),
`docs/adr/0104-*.md` to `0112-*.md` (cross-links and departures only), `scripts/gpu-shots.mjs`
(header comment only), `.scratch/armoury-potions/spec.md` (a "Departures" section at the end).

## Scope

1. **`apps/armoury/CLAUDE.md`**: three shops in the opening paragraph; the layout gains
   `potion/`, `apothecary/` and the potion stage files with one line each; commands unchanged
   unless a ticket added one (`scripts/ingredient-thumbs.mjs`); "Adding a shop" updated only with
   what this epic proved general (`flourishOnArrival`, the upright hold and front framing, the
   thumbnails script); a short "The potion" rules section in the style of "The sword" (pure
   three-free generator, lathe data rows, ingredient ids are permanent, layers never mix, the
   murky rule, budgets, tone mapping on the potion canvas only). No reminders or future-work
   notes in any CLAUDE.md: those go in a `.scratch` ticket.
2. **`CONTEXT.md`**: the street with three open shops; new terms **Potion**, **Pour**,
   **Ingredient**, **Layer**, **Trait**, **Secret blend**, **Effect**, **Uncorking**, **Brewing
   table**, **Recipe card**, each with `_Avoid_` where useful (avoid "brew" for the item, "spell"
   for the effect, "recipe book"); **Item kind** and **Your shelf** updated for three kinds.
3. **README**: the third shop in a sentence; asset credits from ticket 10 (if any) checked.
4. **`index.html`**: title "Armoury - wands, swords and potions" and the description.
5. **ADRs**: each of 0104-0112 links its neighbours and the tickets' ADRs it depends on; 0096
   gains an amend note (a third kind, nothing in the format changed).
6. **Departures:** a section at the end of `spec.md` listing every place the build differs from
   this spec (cuts, changed numbers, renamed things), with the ticket that decided each.
7. **The final gate** (below).
8. **For Ed:** a list in this ticket's Comments: the real-phone checks (pouring, the sheet, the
   close look's lean and tip, the uncorking on a phone's GPU), every taste call left open by the
   tickets (effect words, secret blend names, Whiffy, label text, glass tints, the candle), and
   every unanswered QUESTION.

## Acceptance

- Docs describe what shipped; no em dash anywhere on the branch (`git diff main --stat` files
  checked with a grep for the character).
- The whole-shop gate passes.

## Tests to write first

None (docs and a gate). The full verify loop below must be green.

## Verify

```bash
pnpm lint
pnpm typecheck
pnpm --filter armoury run test
pnpm --filter armoury run build
pnpm --filter hub run typecheck
```

## Whole-shop gate

Protocol: spec rule 15. Shots into `shots/18/r<N>/`, `--picture --freeze=1.2`: every potion
preset (scene, box, close, an uncork at its effect's peak, picture); the street on desk and phone
with three open shops (lights at rest and under the pointer, the phone's signposts); the shelf
with one of each kind; the shared view of a potion link; and `shots/sets/baseline.json` re-shot,
diffed against `shots/04/baseline/` (the wand and sword must be unchanged except where a ticket
said otherwise). One contact sheet, `shots/18/r<N>/contact-sheet.png`.

The reviewer judges the potion shop as a whole beside the wand shop and the smithy: the same
quality, its own character, moody and readable, every combination pretty, the pour and the
uncorking delightful and bounded, the street right with a third door.

## Out of scope

- New features, retuning beyond a gate's finding, the hub card (19).

## Comments
- 2026-11-13 orchestrator, from the second review of ticket 05: in ADR 0106 the "Names never mention drinking" bullet still says the test covers blend lore only (it now lives in `describe.test.ts` and sweeps every word, name, tag line and lore), and line 58 is not wrapped. Fix both in the docs pass.
- 2026-11-13 orchestrator, from the second review of ticket 07: in `src/items/registry.test.ts` the test named "loses to a wand or a sword in the same link" now only tests the sword (the wand has its own test); rename it "loses to a sword in the same link".
- 2026-11-13 orchestrator, from the third review of ticket 08: three files fail `prettier --check` after its last commit (`src/apothecary/pourPicker.tsx`, `src/pours.iwft.tsx`, `src/testing/ApothecaryPom.ts`); run `prettier --write` over every file this epic added or changed. In `pourPicker.tsx` the comment and ADR 0108 say a click with `detail` 0 means Enter or Space; it means no pointer was involved, which also covers a screen reader's click: reword both, and rename `isKeyboardClick` to match. `emptyButton` in `ApothecaryPom.ts` is not used by `emptyBottle()` or `emptyBottleWithKeyboard()`, which build the same locator themselves: use it or remove it.
