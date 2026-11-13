# 05 - Names, effects, secret blends, presets and the item

**Status:** done (merged into `armoury-potions`; reviews 05-r1, 05-r2)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 03
**Parallel with:** 06 (and 01, 02, 04 if still running)
**Model:** sonnet
**Gate:** code review only (a reviewer checks the vocabulary against the DO_NOT_USE list)
**ADR:** 0106 (write it)

## Goal

Give a potion everything derived: what it does (its effect), its name, tag line, lore, shelf line
and glow; the curated secret blends; the potion DO_NOT_USE list and its guard; the hand-picked
presets; and `potionItem`, the `ItemDef` the workbench, saves and links will use. Registering the
kind is ticket 07's (it must widen every `ItemKind` record in one commit), so here the item is
built and tested on its own.

## Read first

- `spec.md`: "The effect: what it does", "Names, tag lines, lore", "Secret blends", "Presets",
  "DO_NOT_USE requirement", "Testing", "Rules for the team" (7).
- `research/experience-options.md` (absolute path): "Notes for whoever plans it" (the
  DO_NOT_USE note).
- `apps/armoury/CLAUDE.md` ("Names, numbers and tag lines are derived", "No franchise
  vocabulary").
- Source: ticket 03's `src/potion/*`; `src/items/item.ts` (`ItemDef`), `src/items/shopNumber.ts`,
  `src/workbench/workbench.ts` (`createWorkbench`); `src/sword/describe.ts`,
  `src/sword/presets.ts`, `src/sword/item.ts` and their tests as the pattern (the sword's
  `DO_NOT_USE` guard and its every-pair test).

Paths are relative to `apps/armoury/`.

## Files you own

New, under `src/potion/`, each with a test: `effects.ts`, `blends.ts`, `doNotUse.ts`,
`describe.ts`, `presets.ts`, `item.ts`. `src/potion/ingredients.ts`: the `word` and `lore`
columns only, if a reviewer finds a word that needs changing. New
`docs/adr/0106-armoury-potion-names-effects-and-blends.md`. After you, `presets.ts` passes to
ticket 10 for retuning.

## Scope

1. **`effects.ts`**: `potionEffect(p): PotionEffect | null`, `PotionEffect = { kind: EffectKind;
   strength: 1 | 2 | 3 | 4; colours: string[] }`, by the spec's rule (most common effect among
   the pours, ties to the highest pour, strength the count, colours of the pours carrying it, top
   first; null when empty). `EFFECTS: Record<EffectKind, { word: string; sentence: string }>` from
   the spec's table.
2. **`blends.ts`**: `SECRET_BLENDS: readonly { id: string; pours: IngredientId[]; name: string;
   lore: string }[]` from the spec's table (you may change names and add up to two; at most 12;
   each lore two sentences, no drinking or tasting), and `secretBlend(p)`: the blend whose pours
   equal `pourList(p)` exactly, or null.
3. **`doNotUse.ts`**: `POTION_DO_NOT_USE` and `isForbiddenName(name)` per the spec's "DO_NOT_USE
   requirement", including the patterns.
4. **`describe.ts`**: `potionName(p)`, `potionNumber(p)` (`shopNumber`), `potionTagLine(p)`,
   `potionLore(p)`, `potionShelfLine(p)`, `potionGlowColour(p)`, all per the spec, with the
   name's fallbacks when `isForbiddenName` matches. `countInWords(n)` for 1-4 ("One pour",
   "Two pours"; "pour" singular for one).
5. **`presets.ts`**: `potionPresets: { name: string; params: Params }[]`, eight, per the spec's
   "Presets" (every shape, stopper, label and ingredient at least once, at least one secret
   blend); `[0]` the first-visit potion.
6. **`item.ts`**: `potionItem`, typed `Omit<ItemDef, 'kind'> & { kind: 'potion' }` until ticket
   07 widens `ItemKind` and types it `ItemDef` (in `item.test.ts`, hand `createWorkbench`
   `{ ...potionItem, kind: 'wand' }` until then: the reducer never reads `kind`), with
   `schema: potionSchema`,
   `storageKey: 'armoury:save:potion'` (07 moves it to `POTION_SAVE_KEY` in
   `persistence/storage.ts`), `firstVisit` = preset 0 normalised, `keeps: []`,
   `follows: followPours`, describers from `describe.ts`, `glow`, and
   `lengthFraction: drawnHeightFraction`.
7. **ADR 0106**: effects as one parameterised system of six kinds chosen from the pours (O4) and
   why ties go to the top pour; the name rule and its fallbacks; secret blends as exact sequences
   with no book and no persistence (and the gold flag); the DO_NOT_USE list and patterns; why
   names never mention drinking. Status Accepted.

## Acceptance

- Every potion in the catalogue (every ingredient alone, every ordered pair, every blend, every
  preset, the empty bottle, four of each ingredient) has a non-empty name, number, tag line, lore
  and shelf line; none is forbidden.
- Every secret blend is reachable (its pours normalise unchanged), unique, and found by
  `secretBlend`; four Bog murks is "Bottom of the Pond", not "Pure Bogmurk".
- `createWorkbench(potionItem)`: Try another keeps nothing but locked groups; a take-out shifts
  the pours down; the first visit is preset 0.

## Tests to write first

Unit only:

- `effects.test.ts`: a single pour; a clear winner; a tie broken by the top pour; strength
  counts; colours top first; empty is null; whiffy only with a Bog murk pour.
- `blends.test.ts`: every blend reachable and unique; `secretBlend` exact (a prefix or an extra
  pour is not a match); at most 12; no blend name or lore forbidden.
- `doNotUse.test.ts`: every list entry and pattern caught in mixed case and spacing
  ("Thunder Brew", "potion of swiftness", "Hi-Potion"); ordinary names pass.
- `describe.test.ts`: names for the four rules; **every reachable generated name** (each effect
  word x each ingredient word x each noun) passes `isForbiddenName` or falls back to one that
  does; tag lines with merged repeats ("Fizzy, then sparkly" for frogfizz, starpetal, starpetal);
  singular "One pour"; empty wording; lore two sentences; glow is seven-character hex; number is
  four digits and stable.
- `presets.test.ts`: normalise to themselves, names unique and not forbidden, coverage as the
  spec says.
- `item.test.ts`: `firstVisit`, `keeps`, `follows` through `createWorkbench` (take out the middle
  pour, pour into a gap), `lengthFraction` in (0, 1].
- Add to `ingredients.test.ts`: no ingredient label or lore line is forbidden.

## Verify

```bash
pnpm --filter armoury exec vitest run src/potion
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
```

## Out of scope

- Registering the kind, the shop, the shelf, links (07). The look of the effects (15). Any
  persistence of discovered blends.

## Comments
- 2026-11-13 orchestrator: built (28d44ca3), review r1 asked for changes (the forbidden-name rule, blend precedence tests), fixed (7ebe7af8), review r2 passed with mutation checks. Merged into the epic branch.
