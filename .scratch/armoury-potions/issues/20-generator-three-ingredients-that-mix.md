# 20 - The generator for three ingredients that mix

**Status:** done (merged into `armoury-potions` as da8ed967; reviews 20-r1, 20-r2, last test-only fix read by the orchestrator)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 09 (merged into `armoury-potions`)
**Parallel with:** 10, 13
**Model:** sonnet (mechanical: every rule and table is in the spec; unit tests are the proof)
**Gate:** code review only
**ADR:** 0113 (write it); a "Superseded in part by 0113" note at the top of 0104 and 0106
**Dev port:** none (no dev server)

## Goal

Move the pure potion generator from four layered pours to three ingredients that mix (E13-E17):
three ordered slots plus a `mixed` flag, Puffcap in place of Bog murk, the wheel rule that turns
any three ingredients into one of six effects or murky with a designed colour, and names, tag
lines, lore, blends and presets for a potion that is revealed by its mix. Everything stays pure,
three-free and unit-tested.

## Read first

- `spec.md`: "The item", "The ingredients", "The mixing rule", "The effect", "Names, tag lines,
  lore", "Secret blends", "Presets", "DO_NOT_USE requirement", "Save and share", "Testing",
  "Rules for the team".
- `decisions.md` (absolute path): E13-E17, O16, O19.
- ADRs 0104, 0106 (what tickets 03 and 05 built and why).
- Source: `src/engine/schema.ts` (`normalise`, `randomise`, `allowed`, weights);
  `src/potion/potionSchema.ts`, `pours.ts`, `ingredients.ts`, `effects.ts`, `compile.ts`,
  `describe.ts`, `blends.ts`, `presets.ts`, `doNotUse.ts`, `item.ts` and their tests;
  `src/potion/profile.ts` (`MAX_POURS` sets the fill levels), `profile.test.ts`,
  `geometry.test.ts`, `outline.test.ts` (pour-count expectations); `src/items/colour.ts`
  (sRGB/linear helpers); `src/testing/FakePotionStage.tsx`.

Paths are relative to `apps/armoury/`.

## Files you own

`src/potion/potionSchema.ts`, `pours.ts`, `ingredients.ts`, `effects.ts`, `compile.ts`,
`describe.ts`, `blends.ts`, `presets.ts`, `doNotUse.ts`, `item.ts` (each with its test), new
`src/potion/mix.ts` (+ `mix.test.ts`), new `src/potion/mixColour.ts` (+ test; OKLab and OKLCH
conversions and the two colour recipes), `src/potion/profile.test.ts`, `geometry.test.ts`,
`outline.test.ts` and `tipped.test.ts` (pour counts only), `src/testing/FakePotionStage.tsx`,
`docs/adr/0113-armoury-three-ingredients-that-mix.md` (new), `docs/adr/0104-*.md` and
`docs/adr/0106-*.md` (a one-line note each).

Do not touch the picker, the shell or the stage; tickets 21 and 22 follow you. Expect
`src/pours.iwft.tsx` and `src/apothecary.iwft.tsx` to fail against your branch (they still pour
four); the orchestrator merges 20, 21 and 22 together and runs CT once after 22.

## Scope

1. **Schema** (`potionSchema.ts`): `POUR_KEYS = ['pour1', 'pour2', 'pour3']`, labels "First
   ingredient" and so on, `none` weight 0 in every slot, defaults moonmilk, rosehip, starpetal;
   the `mixed` choice param in group `pours` (spec table), `allowed` `['no']` while `pour3` is
   `none`. Export `isMixed(p)`.
2. **Ingredients** (`ingredients.ts`): the spec's table in wheel order with a `wheel` column
   (0-8), Puffcap in place of Bog murk, the three changed own effects and nudged lore lines, the
   new colours for Emberroot and Puffcap. Add `murk` to `Trait`. Remove `MURK`.
3. **The rule** (`mix.ts`): `mixPotion(ids)`, `potionMix(p)`, `PotionMix`, the constants
   (`WHEEL_STEP_DEGREES = 40`, `SECTOR_START_DEGREES = -3.25`, `SECTOR_ORDER`, `MURK_REACH =
   0.78`), `main`, `strength`, `trait`, exactly as the spec says. `mixColour.ts` holds the colour
   recipes; `mix.ts` calls them.
4. **Effects** (`effects.ts`): `EffectKind` stays six; `PotionEffect.kind` is `EffectKind |
   'murky'`; `EFFECTS` gains the murky row's word and sentence (keep the six as they are);
   `potionEffect(p)` from `potionMix` and only when mixed; `strength` 1-3; `colours` as the spec
   says. Drop `commonestFromTop` if nothing needs it.
5. **Compile** (`compile.ts`): `PotionSpec` gains `mixed: boolean` and `mix: PotionMix | null`
   (the mix whenever three are in, so the stage can play a first swirl); `fill` is layers over
   three; the wax colour from the mixed colour when mixed. `layers` stays (the stage draws them
   unmixed and streaks them through a replay's swirl).
6. **Pours** (`pours.ts`): three slots; keep `pourList`, `withPours`, `nextPourKey` and the
   adding half of `followPours` (a pour goes to the lowest empty slot). An empty sequence of
   `set none` from the top down must still empty the bottle and unmix it.
7. **Names** (`describe.ts`): every rule in "Names, tag lines, lore" (empty, unmixed with
   folding, blend, murky with `MURKY_NAMES`, pure, the effect name with the new nouns and the
   fallback chain), tag lines, lore, shelf line, glow and `isGold`. The shape nouns in
   `bottles.ts` (`nameNoun`) belong to ticket 09's file: define the new nouns in `describe.ts`
   as a `Record<ShapeId, string>` and stop reading `nameNoun`; leave `bottles.ts` alone and say
   so in the ADR (ticket 18 removes the dead column).
8. **Blends** (`blends.ts`): the spec's twelve, as unordered recipes (`recipe: [IngredientId,
   IngredientId, IngredientId]`), matched as multisets, and `secretBlend(p)` null unless mixed.
9. **Presets** (`presets.ts`): the spec's eight; `recipe()` helper takes the three and `mixed`.
10. **DO_NOT_USE** (`doNotUse.ts`): no list change unless a new name trips it; the sweep in
    `describe.test.ts` covers the murky names, the blends, the presets and every reachable name.
11. **Item** (`item.ts`): `follows` still `followPours`; nothing else should change.
12. **Fake stage** (`FakePotionStage.tsx`): add `data-mixed` ("yes"/"no"), `data-outcome` (the
    mix's outcome, or empty when fewer than three) and `data-gold` beside `data-pours`, so
    tickets 21 and 22 can assert through it.
13. **Counts in ticket 09's tests**: where `profile.test.ts`, `geometry.test.ts`,
    `outline.test.ts` or `tipped.test.ts` assume four pours (equal quarter volumes, "0 to 4
    pours" catalogues), change the expectation to three; change no maths. If a test cannot be
    fixed without editing `profile.ts` or `geometry.ts`, stop and ask the orchestrator.
14. **ADR 0113** (Status Accepted): the slots and the `mixed` flag and why the shell sets it;
    the wheel, its sectors and the murk reach, with the computed odds (24 x 6, 21; 100/101 x 6,
    126 under Try another) and the margin; why a vector rule (order-free, a shape a child can
    learn, paint-like clashes) and not a lookup table; the colour recipes and their bounds;
    Puffcap; the name scheme, nouns, murky names and blends; no migration because nothing
    shipped. Notes at the top of 0104 and 0106: "Superseded in part by ADR 0113 (three
    ingredients that mix)."

## Acceptance

- Over all 165 multisets: glowing, floating, sparkling, whirling, dreamy and whiffy 24 each,
  murky 21; over all 729 ordered fills: murky 126, each effect 100 or 101.
- Every permutation of every recipe gives the same `PotionMix`.
- Three of an ingredient gives its own effect (the `effect` column) and is never murky; murky
  exactly when three differ with wheel gaps 3,3,3 or 2,3,4; every effect sum at least 1 degree
  from a sector edge.
- Effect colours: OKLCH chroma at least 0.12, lightness 0.58-0.78; murky: chroma at most 0.05,
  lightness at most 0.5; deterministic.
- `normalise`: no gaps; `mixed` is `no` unless three are in; a `pour4` key and a `bogmurk` value
  are dropped or fall back; Try another (seeded, a fixed list of seeds) always gives three and
  `mixed: no`.
- Every name in the sweep passes `isForbiddenName` and the drinking sweep; the spec's five
  example names come out exactly: "Moonmilk, Rosehip and Starpetal" (first visit), "Dreamy
  Rosehip Potion" (it mixed), "Pure Bluebell Dew" (round), "A Marvellous Muddle" (frogfizz,
  bluebell, puffcap), "Whiffy Puffcap Swirl" (emberroot, emberroot, puffcap in a gourd).
- Blends unique as multisets, each reachable, only when mixed, each with the outcome the spec's
  table gives; presets normalise to themselves and cover all seven outcomes, every ingredient,
  shape, stopper and label, and one blend.
- `pnpm --filter armoury run typecheck` is clean across the app (the picker still compiles; its
  CT suites fail until 22).

## Tests to write first

- `mix.test.ts`: the counts (both), order-freedom, pure recipes, the murky gap rule, the margin,
  `main` and `strength` on a few named recipes (including a surprise: starpetal, snailshine,
  bluebell is floating with main Snailshine), the colour bounds.
- `potionSchema.test.ts`, `pours.test.ts`: three slots, `mixed` coupling, adding to the lowest
  empty slot, emptying unmixes, Try another.
- `describe.test.ts`, `blends.test.ts`, `presets.test.ts`, `effects.test.ts`,
  `compile.test.ts`, `ingredients.test.ts`: as the acceptance list says. Keep the suite fast:
  165 and 729 are cheap; do not loop shapes over all 729.

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/potion src/apothecary src/items src/workbench
```

`src/apothecary/potionGroups.ts` (ticket 22's) imports `countInWords` from `describe.ts`: keep
that export and its words ("One pour" ... "Three pours") until 22 replaces the summary.

## Out of scope

- The picker (22), the shell, the reveal and the copy (21), anything under `src/stage/` (10, 11,
  23), colour retuning under the picked light (10).

## Comments
