# 03 - Potion schema, ingredients, pours and compile

**Status:** done (merged into `armoury-potions` as b6834ab9; reviews 03-r1, 03-r2)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** none
**Parallel with:** 01, 02, 04
**Model:** sonnet
**Gate:** code review only
**ADR:** 0104 (write it)

## Goal

The pure, three-free foundation of the potion: its params and coupling, the ingredient table,
the bottle data rows, the pour helpers that keep pours in order with no gaps, the framing
numbers, and `compilePotion`, which turns params into the `PotionSpec` every later ticket reads.
No UI, no meshes, no registration.

## Read first

- `spec.md`: "The item" (all of "Params by group", "The ingredients", the murky rule), "Save and
  share" (ids are persisted), "Testing" (the unit bullets), "Rules for the team".
- `apps/armoury/CLAUDE.md` (the sword's rules are the pattern: pure generator, curated ranges,
  every allowed list's first entry is the fallback).
- Source: `src/engine/schema.ts` (how `normalise` and `randomise` treat `allowed` and `weight`:
  the second pass runs in schema order and mutates as it goes), `src/engine/schema.test.ts`,
  `src/sword/swordSchema.ts` and `src/sword/families.ts` (data rows and helpers),
  `src/sword/framing.ts` (`drawnFraction`), `src/items/colour.ts`.

Paths are relative to `apps/armoury/`.

## Files you own

New, under `src/potion/`, each with a `*.test.ts`: `ingredients.ts`, `bottles.ts`,
`potionSchema.ts`, `pours.ts`, `framing.ts`, `compile.ts`. New
`docs/adr/0104-armoury-potion-item.md`. After you, `bottles.ts` passes to ticket 06 for tuning,
and `ingredients.ts` to ticket 05 (lore and word columns) and 10/11 (colour column).

## Scope

1. **`ingredients.ts`**: `IngredientId` (the nine ids in the spec's order), `Trait`
   (`'clear' | 'cloud' | 'fizz' | 'glitter' | 'glow' | 'swirl'`), `EffectKind` (`'floating' |
   'sparkling' | 'dreamy' | 'glowing' | 'whirling' | 'whiffy'`), and
   `INGREDIENTS: readonly Ingredient[]` with `{ id, label, word, colour, trait, effect, lore }`
   exactly as the spec's table (colour as `#rrggbb`). `ingredient(id)` looks one up.
   `MURK: IngredientId = 'bogmurk'`.
2. **`bottles.ts`**: `ShapeId` and `BOTTLES: Record<ShapeId, BottleRow>` with, per shape: `label`
   (the spec's option label), `noun` (the tag line's shape noun), `nameNoun` (Brew, Tonic, Drops,
   Mixture, Potion), `bodyHeightMm`, `neckMm: [min, max]` (the `neck` slider maps into it),
   `neckRadiusMm`, `lipMm`, and `body`: radius control points `[heightFraction, radiusMm][]` from
   the foot to the shoulder. Starting numbers (ticket 06 tunes them, the form gate judges them):
   round 95 mm body, widest 42 mm radius at 0.4; teardrop 120 mm, widest 36 mm at 0.3; tall
   150 mm, 24 mm straight sides; shoulder 120 mm, 30 mm sides with a flat shoulder; gourd 130 mm,
   two bulbs (36 mm at 0.25, 24 mm at 0.72) with a waist of 18 mm at 0.5. Necks 10-45 mm long,
   radius 7-9 mm. `neckLengthMm(p)` and `drawnHeightMm(p)` (foot to stopper top; stopper
   allowance 18 mm).
3. **`potionSchema.ts`**: `potionSchema: ItemSchema` (`itemType: 'potion'`), groups `pours` "What
   goes in", `bottle` "The bottle", `finish` "Stopper and label", and the params of the spec's
   three tables, with labels, weights, ends and defaults exactly as there. `pour2..4` carry the
   no-gap `allowed`, with `none` first in every pour's options. Export `POUR_KEYS` (`['pour1',
   'pour2', 'pour3', 'pour4'] as const`), `PourKey`, `MAX_POURS = 4`, `potionSwatchFor(key,
   value)` (ingredient colours for pours, a glass tint per `glass` value) for the picker.
4. **`pours.ts`**, pure helpers the item and the picker share:
   - `pourList(p): IngredientId[]`, bottom first, without `none`.
   - `withPours(list): Pick<Params, PourKey>`, filling `none` above.
   - `nextPourKey(p): PourKey | null`, the lowest empty slot, null when full.
   - `followPours(before, key, value): Params | undefined`, the item's `follows` for pours: when
     `key` is a pour key, returns `withPours(...)` of the pour list after the change, compacted
     (taking one out shifts the rest down; pouring into a slot above a gap lands in the lowest
     empty slot); `undefined` for any other key or when nothing needs shifting.
5. **`framing.ts`**, three-free and main-chunk safe: `TALLEST_MM` (the tallest
   `drawnHeightMm` over every shape at neck 1), `drawnHeightFraction(p)`, and `BASE_LINE`, the
   foot's height in the box stage as a fraction of the stage from the top (start at 0.84; tickets
   09 and 13 settle it with Ed's picked composition).
6. **`compile.ts`**: `compilePotion(p): PotionSpec` with `shape`, `bodyHeightMm`, `neckMm`,
   `heightMm` (drawn), `glass`, `stopper`, `label`, `layers: { ingredient, colour, trait }[]`
   bottom first, `fill` (pours over `MAX_POURS`), and `waxColour` (the top pour's colour darkened
   by 35 percent in linear light when the stopper is `wax` and there is a pour, else `#7a2a24`
   for wax on an empty bottle, else null). Every value comes from params and the tables; nothing
   random.
7. **ADR 0104** (`docs/adr/0104-armoury-potion-item.md`, MADR-lite like
   `0092-armoury-branch-stepper.md`): pours as four ordered choice slots rather than a list
   param (the schema has no lists; save, share, undo and the shop number work unchanged); no gaps
   via `allowed`, compaction via `follows`, so the reducer is unchanged; the ingredient table and
   that ids are permanent; traits and effects as columns; the murky rule (O5) and how the tests
   pin it; Try another keeps nothing but locks; the cut "Stir it" mode and why. Status Accepted.

## Acceptance

- `normalise(potionSchema, {})` is the first-visit potion's params (three pours: moonmilk,
  rosehip, starpetal).
- A gap anywhere normalises to the pours below it; `followPours` shifts pours down on a take-out
  and moves a pour into the lowest empty slot.
- Under `randomise`, pour1 and pour2 are never `none`; every ingredient has the same weight in
  every slot.
- `compilePotion` gives layers in pour order with the ingredients' own colours and traits.
- The folder imports nothing from three, R3F, `stage/`, `wand/` or `sword/`.

## Tests to write first

Unit only, fast:

- `ingredients.test.ts`: nine rows, unique ids in the spec's order, hex colours, every trait and
  effect from its union, every lore line one sentence ending in a full stop, no word from
  `POTION_DO_NOT_USE` once ticket 05 adds it (leave that one test to 05).
- `potionSchema.test.ts`: defaults; the no-gap chain (`{pour1: 'none', pour2: 'frogfizz'}`
  normalises to an empty bottle; `{pour2: 'none', pour3: 'starpetal'}` keeps only pour1); option
  order and weights; **the murky rule computed from the weights, not sampled**: in every pour
  slot `bogmurk`'s weight equals every other ingredient's; the probability of four Bog murks
  under Try another equals that of four of any other ingredient; 1000 seeded `randomise` calls
  never give fewer than two pours (seeded, so deterministic).
- `pours.test.ts`: `pourList`, `withPours`, `nextPourKey` (null at four); `followPours` for a
  take-out at each index, a pour into a gap, a non-pour key, a no-op.
- `bottles.test.ts` and `framing.test.ts`: every shape has a row; `drawnHeightMm` grows with
  `neck`; `drawnHeightFraction` is in (0, 1] and 1 only for the tallest.
- `compile.test.ts`: layers match pours for a few catalogue potions; no layer colour that none of
  its pours brought (over a chosen catalogue: every ingredient alone, every pair in both orders,
  the first-visit potion); `waxColour` rules.

## Verify

```bash
pnpm --filter armoury exec vitest run src/potion src/engine
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
```

## Out of scope

- Names, effects, blends, presets, `potionItem` and registering the kind (05, 07).
- Meshes, volumes and outlines (06). The UI (07, 08).

## Comments
- 2026-11-13 orchestrator: built (ea5b56d5), review r1 asked for changes, fixed (0ceb5940), review r2 passed with mutation checks. Merged into the epic branch.
