# 04 - Feel pass: tune the burn story end to end

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 03
**Spec:** [../spec.md](../spec.md)

Tickets 01-03 land the mechanisms with starting-point probabilities. This
ticket is the eyeball-and-tune pass over the whole burn story in the dev app,
plus the cost accounting and the doc sweep.

## What to exercise (dev app, `pnpm dev --filter=silt`, port 3009)

Build a scene that hits every path and watch it at real speed:

- A wood cabin (hollow wood box) torched at one corner: it should char, glow,
  creep, then go up section by section over seconds - not detonate, and not
  sulk unburnt either.
- Oil pooled against the cabin: the pool should still flash and act as the
  sustained heat that gets wood going.
- A vine grown up a wall, lit at the bottom: fire should race it to the top
  reliably - the fuse.
- A sulphur heap: one touch, whole heap chains.
- Rain (water) on a half-smoldering cabin: the douse should visibly save it.
- Let a burn finish: ash should be present in a noticeable-but-not-blanketing
  amount, and rain over it should make mud a dropped seed sprouts in.

## Tunables (change data only, one at a time)

- The ladder ps (01), `fire + wood` / `lava + wood` / creep ps (02),
  `fire + ember -> ash` p and ash density (03), ember lifetime ticks/jitter,
  ember and ash colour shades.
- Anything retuned needs its pinned test revisited *for meaning*, not just for
  passing - a test that only passes at the old p was pinning a number, and
  should be loosened to pin the behaviour instead.

## Costs

- `pnpm --filter silt run bench` against main, all four scenarios; report
  ms/tick beside `scannedLastTick` (a smoldering front is all-awake by design
  - the number to watch is what a *large* burn does to the budget).
- If a burn scenario is not represented in the bench's named scenarios,
  consider adding one - a tool change, not a gate change.

## Doc sweep

- `apps/silt/CLAUDE.md`: the roster line in the Layout section and the
  `elements.ts` summary now say 17 elements / name the list - update for ember
  and ash.
- `paletteGroups.ts` products comment covers both new species (done in 02/03;
  verify).
- The ADR from 02/03 reflects any tuning decisions that changed the model's
  story (a p change does not; a mechanism change does - the latter should not
  happen in this ticket).
- Spec table (§1) updated to the shipped ps.

## Constraints

- Data and docs only. If the feel cannot be fixed by tuning data, stop and
  write up what mechanism is missing rather than bolting one on here.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green.
