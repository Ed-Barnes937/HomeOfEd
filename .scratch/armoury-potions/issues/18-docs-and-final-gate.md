# 18 - Docs and the final whole-shop gate

**Status:** done
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 17, 25
**Parallel with:** none
**Model:** sonnet
**Gate:** whole shop
**ADR:** none new; cross-links 0104-0113 and amends 0096 (a third kind)
**Dev port:** 3041

## Goal

Finish the epic: bring the app's docs up to three shops, cross-link the ADRs, record where the
build departed from this spec, take the whole shop (and the wand shop and smithy beside it)
through the final gate, and list for Ed what only he can judge.

## Read first

- `spec.md` (all), every ticket's Comments (cuts, departures, taste calls, QUESTIONs).
- `decisions.md` (absolute path).
- `apps/armoury/CLAUDE.md`, `CONTEXT.md`, `README.md`, `index.html`; ADRs 0096, 0097, 0104-0113.
- The swords epic's ticket 14 as the pattern:
  `~/Code/HomeOfEd/.scratch/armoury-swords/issues/14-docs-and-final-gate.md`.

## Files you own

`apps/armoury/CLAUDE.md`, `apps/armoury/CONTEXT.md`, `apps/armoury/README.md`,
`apps/armoury/index.html` (title and description), `docs/adr/0096-*.md` (amend note),
`docs/adr/0104-*.md` to `0113-*.md` (cross-links and departures only), `src/potion/bottles.ts`
(remove the dead `nameNoun` column, ticket 20's note), `scripts/gpu-shots.mjs`
(header comment only), `.scratch/armoury-potions/spec.md` (a "Departures" section at the end).

## Scope

1. **`apps/armoury/CLAUDE.md`**: three shops in the opening paragraph; the layout gains
   `potion/`, `apothecary/` and the potion stage files with one line each; commands unchanged
   unless a ticket added one (`scripts/ingredient-pictures.ts` and the placeholder sheet); "Adding a shop" updated only with
   what this epic proved general (`flourishOnArrival`, `closeUp.reveal`, `offersPutBack`, the
   upright hold and front framing, the sprite-sheet cutter); a short "The potion" rules section in the style of "The sword" (pure
   three-free generator, lathe data rows, ingredient ids are permanent, three ingredients and the
   `mixed` flag, the wheel rule and its pinned odds, murk is an outcome never an ingredient,
   budgets, tone mapping on the potion canvas only). No reminders or future-work
   notes in any CLAUDE.md: those go in a `.scratch` ticket.
2. **`CONTEXT.md`**: the street with three open shops; new terms **Potion**, **Pour**,
   **Ingredient**, **Layer**, **Mix**, **The wheel**, **Murky**, **Trait**, **Secret blend**,
   **Effect**, **Swirl**, **Uncorking**, **Brewing table**, **Recipe card**, each with `_Avoid_` where useful (avoid "brew" for the item, "spell"
   for the effect, "recipe book"); **Item kind** and **Your shelf** updated for three kinds.
3. **README**: the third shop in a sentence; asset credits from ticket 10 (if any) checked.
4. **`index.html`**: title "Armoury - wands, swords and potions" and the description.
5. **ADRs**: each of 0104-0113 links its neighbours and the tickets' ADRs it depends on; 0096
   gains an amend note (a third kind, nothing in the format changed).
6. **Departures:** a section at the end of `spec.md` listing every place the build differs from
   this spec (cuts, changed numbers, renamed things), with the ticket that decided each.
7. **The final gate** (below).
8. **For Ed:** a list in this ticket's Comments: the real-phone checks (pouring, the sheet, the
   close look's lean and tip, the swirl and the uncorking on a phone's GPU), every taste call
   left open by the tickets (the mixing rule's feel after play, murky names, effect words, secret
   blend names, Whiffy, the blorp, label text, glass tints, the candle, the ingredient art), and
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
preset (scene, box, close, the first visit's mix mid-swirl and at its effect's peak, a replay,
picture); the street on desk and phone
with three open shops (lights at rest and under the pointer, the phone's signposts); the shelf
with one of each kind; the shared view of a potion link; and `shots/sets/baseline.json` re-shot,
diffed against `shots/04/baseline/` (the wand and sword must be unchanged except where a ticket
said otherwise). One contact sheet, `shots/18/r<N>/contact-sheet.png`.

The reviewer judges the potion shop as a whole beside the wand shop and the smithy: the same
quality, its own character, moody and readable, every combination pretty (layered and mixed),
the pour, the swirl and the uncorking delightful and bounded, the ingredient pictures at the
shop's art bar, the street right with a third door.

## Out of scope

- New features, retuning beyond a gate's finding, the hub card (19).

## Comments
- 2026-11-13 orchestrator, from the second review of ticket 05: in ADR 0106 the "Names never mention drinking" bullet still says the test covers blend lore only (it now lives in `describe.test.ts` and sweeps every word, name, tag line and lore), and line 58 is not wrapped. Fix both in the docs pass.
- 2026-11-13 orchestrator, from the second review of ticket 07: in `src/items/registry.test.ts` the test named "loses to a wand or a sword in the same link" now only tests the sword (the wand has its own test); rename it "loses to a sword in the same link".
- 2026-11-13 orchestrator, from the third review of ticket 08: (moved to ticket 22, which rewrites those files: prettier, the `isKeyboardClick` rename and wording, `emptyButton`.) Re-check `prettier --check` over every file the epic touched.
- 2026-11-13 planner (re-plan, E13-E17): docs describe three ingredients that mix (ADR 0113), the reveal in the shell, no Put the last one back in the potion shop, and Ed's ingredient art (25). Waits for 25.
- 2026-11-14 orchestrator, small leftovers from the reviews of tickets 10 and 13 (`reviews/10-r3.md`): ADR 0109 should say the two-pass bug was only in the glass's two light passes (the tint passes were never affected) and that wand materials reflect at 0.45; ADR 0110 should name 1024x900 beside 900 wide for the slot shrink; `geometry.ts` has a `revolve` comment naming a `place` parameter that no longer exists; `FIT_MM` is exported but used only in `profile.ts`; the scratch shot set `shots/sets/forms.json` still has wax entries; add 1024x900 and a round flask to the fit iwft's lists.
- 2026-11-14 orchestrator: the wand and sword pixel baseline is now `shots/baseline-2/a/` (shot from 2d238af4; rule in `shots/baseline-2/README.md`). `scripts/gpu-shots.mjs` gives up on a screenshot after 30 s, which fails runs when other work is using the GPU; consider a longer timeout or one retry there.
- 2026-11-16 orchestrator, from the review of ticket 25 (`reviews/25-r1.md`): (a) ADR 0112 "Ed's art": it names "Nano Banana" as fact from the plan; cite the sheet's own C2PA credentials instead ("Created by Google Generative AI" with two input images, then "Resized by Google Generative AI", 2026-11-14 20:54 UTC), or what Ed says he used. Reword "Ed saw it" about the crescent moon to match E26 ("taken as accepted"). Remove the stale sentence that ticket 25 may loosen the mask. (b) Add `public/ingredients/` and the cutter to `apps/armoury/CLAUDE.md`. (c) `.scratch/armoury-potions/art/` (Ed's sheet, the reference, the layout guide, the prompt) is untracked and lives only in the epic worktree: tell Ed to copy it somewhere before the worktree is removed. (d) For Ed's real-phone check: at full brightness on an OLED screen, the pictures' ground disc (about 6 levels lighter than the tile) and the speck under Thundercloud's bolt should stay invisible; shots cannot prove that.
- 2026-11-16 orchestrator, from the review of ticket 23 (`reviews/23-r1.md`): (a) the `holdOn` wiring gap is not closed: the function is pinned, but no test mounts `HeldRig` or the real stage, so its call sites can be deleted with tests green. (b) Older than ticket 23: the close look's mount holds one frame for about 150 ms (280 to 300 ms at 4x throttle) as the lift starts; measure and decide at the final gate. (c) Left out of the first version: carrying the motes round with the vortex (they hang still while the colours wind; needs the player to end every show on a whole turn). (d) Taste calls for Ed from that review are in `for-ed.md`. (e) Per O27, ticket 17 has no review of its own: this gate covers the door.
- 2026-11-16 orchestrator, from ticket 17: (a) `apps/armoury/CLAUDE.md` still says "a street with two shops". (b) On a phone the potion shop's signpost lines Bubble & Brew up with the left edge of the view (the existing `openingLeft` rule), so the shop sits small in the corner (`shots/17/phone-signpost.png`); judge it at the gate. (c) The armoury has no light theme, so its two desk shots are the same.
- 2026-11-16 orchestrator, the last notes before this ticket starts: (a) **The first version ships without the pour** (ticket 12 is built straight after, E28): docs describe what shipped, a picked ingredient appears as a layer, and the gate has no pour to judge. (b) Two small code fixes from the review of ticket 15 (`reviews/15-r1.md`) are yours to do first, each with its acceptance from that file: whirling at strength 1 is too brief (one constant in `effectKinds.ts`, re-shoot sheet 05 only); one exported constant for the stopper group's name used by `PotionMesh.tsx`, `swingStopper` and its test. (c) A flake to run down, not to shrug at: on the merged epic branch a full CT run failed once at `src/street.iwft.tsx:84` ("on a phone, keyboard focus brings a shop into view"; a swords-epic test, unchanged by this epic, though the street now has a third door) and then passed 3 of 3 with the street suite repeated. Reproduce it under the full suite's load, find the cause and fix the test or the code properly. (d) Read `reviews/15-r1.md`'s notes for this ticket (real-phone checks, the pop timing re-run on a quiet machine). (e) The baseline to diff against is `shots/baseline-2/a/`, not `shots/04/baseline/`. (f) The hub card (ticket 19) is built on its own branch and is not part of this gate.
- 2026-11-17 implementer, round 1 built on `potions/18-docs`: the two fixes from ticket 15's review (whirling's fade, `STOPPER_GROUP`), the small leftovers (the dead `nameNoun` column, a test rename, a stale comment, `FIT_MM` unexported, 1024x900 and a round flask in the fit tests, the shots script's two-minute limit), the docs (scoped CLAUDE.md, CONTEXT.md, README, index.html, ADRs 0096 and 0104 to 0113) and the spec's Departures (23 lines). The street flake did not reproduce in 7 full CT runs, the street suite 25 times over on 12 workers and 210 instrumented runs under load; what was learnt is in `.scratch/armoury/issues/06-flaky-street-focus-test.md`, and nothing was changed on a guess. Gate shots, sheets and `notes.md` are in the session scratchpad under `18/r1/` and `18/rig-diff/`, because the worktree guard refuses writes into the epic worktree; the wand and sword baseline is unchanged. Not done for the same reason: the wax entries in `shots/sets/forms.json`, and `for-ed-phone-checks.md` (in the scratchpad at `18/for-ed-phone-checks.md`). Left as found: ADR 0096 fails `prettier --check` on `main` too, and its fix would turn a sentence into a numbered list.
- 2026-11-17 orchestrator: done, merged. Built by one Fable implementer (cut off twice, by the machine sleeping and by a spend limit, and resumed), 10 commits to 80df65c5. The whole-shop review (`reviews/18-r1.md`, Fable): CHANGES NEEDED with one must-fix (Early Riser to amber glass) and four cheap should-fixes; a fresh Fable fix round did all five (to 3b9a5a81). Per O27 the orchestrator checked the fix round itself (the re-shot Early Riser sheet, the reported acceptance results); no second review. On the merged tree: root lint and typecheck, vitest 2122, CT 189, build, hub typecheck. Shots: `shots/18/r1/`, `shots/18/r2/`, `shots/18/rig-diff/`. Not done here and still open: the `holdOn` wiring gap, the 150 ms mount stall (in the phone checks), ADR 0096 failing prettier (it does on main too; nothing runs prettier on docs), the wax entries in the scratch set `shots/sets/forms.json`. The flaky street test is `.scratch/armoury/issues/06`, open. The first version is complete; ticket 12 (the pour) is next (E28).
