# 04 - Feel pass: tune the burn story end to end

**Status:** done
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

## Answer

**Status: done.** One `p` changed out of the eleven tunables the ticket lists;
everything else was measured and left alone. The pass was driven by scripted
scenes built programmatically on the real `Sim` (throwaway harness, not
committed - the ticket's dev-app eyeball is adapted, and what is genuinely a
visual judgement is listed under REMAINING FOR ED rather than tuned blind).
Tick counts are converted at 60 tps. Unless stated, every figure is the range
over PRNG seeds 1-5.

### The scenes, measured

**A hollow wood cabin (60x51, walls 2 thick, 428 cells) torched at one bottom
corner.** This is the ticket's headline scene, and it now reads as the spec
describes - char, glow, creep, then section by section:

| | ticks | seconds |
| --- | --- | --- |
| first char (ember) | 1-2 | 0.0 |
| first eruption into open flame | 142-156 | 2.4-2.6 |
| left wall consumed | 190-367 | 3.2-6.1 |
| near floor consumed | 235-411 | 3.9-6.9 |
| half the structure gone | 470-599 | 7.8-10.0 |
| mid floor consumed | 610-772 | 10.2-12.9 |
| roof consumed | 896-1224 | 14.9-20.4 |
| far floor consumed | 924-1243 | 15.4-20.7 |
| last wood gone | 1109-1498 | 18.5-25.0 |
| last ember gone | 1273-1657 | 21.2-27.6 |

Peak 84-107 cells glowing and 33-39 open flames at once. The sections fall in
order, each starting only after the one before it has begun losing cells - the
burn walks. Nothing detonates (nothing is instant) and nothing sulks (every
seed finishes, and the spread across seeds is now 1.35x rather than the 2.5x it
was before the retune).

**An oil pool banked against a wood wall** (60 cells of oil, dammed at the far
end, match dropped into it). Half the pool alight at tick 5, the whole pool at
tick 10 (**0.17 s**) - it still flashes. Peak 60 simultaneous flames, and the
flash then acts as the sustained heat the spec asks for: the wall first chars at
tick 10-11 and holds 17-22 glowing cells once the oil is spent. No change
needed. (Worth knowing for anyone re-running this: an *undammed* pool on open
stone spreads to a one-cell film, the gas rises off it, and the burn stalls
half-consumed. That is the liquid archetype, not the ignition row.)

**A grown vine lit at the foot** (59 cells up a stone wall, 10 seeds). Reached
the top on **10 of 10**, in 38-47 ticks - **0.6-0.8 s, about 1.4 cells a tick**.
The fuse works and it is reliable, which was ticket 01's deferred question.
Consumption ranks correctly against the other rungs on the same 3x40 mat: vine
gone in 0.5 s, seed 1.0 s, moss 1.5 s.

**A settled sulphur heap, one touch** (121 cells, poured and left to rest, then
one fire cell at the tip). Half gone at tick 7-8, the whole heap at tick 10-11 -
**0.2 s**. Chains on one touch, as specified.

**Rain on a half-smoldering cabin.** Water dropped over the cabin from tick 150
(2.5 s) and 300 (5.0 s), kept up until nothing glowed. **Saves 157-204 of 428
cells (37-48%) against an unrained control that ends at zero wood on every
seed** - and the saved count is *higher* than the wood standing when the rain
started, because the douse quenches embers back to wood. The verb works and it
is unambiguous. One legible limit: a fully roofed box shelters its interior, so
a stubborn ember inside can outlast surface rain - a player has to paint water
in rather than rain on top.

**The whole loop.** A 40x21 copse (840 cells) torched in the middle: burnt out
by tick 525-589 (**8.8-9.8 s**), leaving 102-125 cells of ash - **12-15% of the
copse, piled 4 cells deep where 21 cells of wood stood**. Rain then makes mud at
tick 54 and a dropped seed sprouts moss at tick 535. Burn -> ash -> mud -> moss
closes end to end.

### The one value changed

`fire + ember -> fire + ash`: **p 0.05 -> 0.003**.

Ticket 03's finding is confirmed and was worse than it read. The draw is per
tick over a 120-180-tick glow, so the chance an exposed ember ends as residue is
roughly `1 - (1 - p)^150`, not `p`. Measured over 40 sealed obsidian pockets
each holding one ember against one flame for the ember's whole life (the harshest
case the row ever sees), plus the aggregate yield on two structures and the
resulting pile depth:

| p | exposed ember erupts | ash, 20x13 wall | ash, 40x21 copse | pile depth (of 21) | cabin last wood |
| --- | --- | --- | --- | --- | --- |
| 0.05 (shipped by 03) | 2/40 (5%) | 45-54% | 54-57% | 13 cells | 1301-3285 |
| 0.01 | 18/40 (45%) | 27-33% | 30-32% | 9 cells | 1154-1384 |
| 0.005 | 24/40 (60%) | 20-24% | 17-22% | 5-6 cells | 1080-1461 |
| **0.003 (shipped)** | **26/40 (65%)** | **11-15%** | **12-15%** | **4 cells** | **1109-1498** |
| 0.002 | 29/40 (73%) | 9-12% | 8-12% | 3-4 cells | 1134-1355 |
| 0.001 | 34/40 (85%) | 4-7% | 5-6% | 2 cells | 1224-1292 |

0.003 is the value where **both** of the spec's stated intents hold at once.
Spec §3 says "most embers flame, some become ash": at 0.05 an exposed ember
erupted on 2 seeds in 40, which inverts the sentence; 0.005 only just clears a
majority; 0.003 gives a clean 65%. And this ticket says ash should be
"noticeable-but-not-blanketing": 12-15% of a burnt copse, four cells deep under
what was twenty-one cells of forest, is a distinct pale bed you cannot miss and
plainly not a blanket - against 0.05's half-buried 13 cells, and against 0.001's
2-cell scattering. Ticket 03 suggested "nearer 0.001"; the measurement puts the
best fit a little above that, because 0.001 buys 20 points of eruption rate at
the cost of two thirds of the residue.

**Two effects that were not predicted, both improvements.**

1. **It also fixed the cabin's pace and its variance.** Embers that erupt do
   more work than embers consumed, because an eruption makes a flame that chars
   its own neighbours. The cabin went from 1301-3285 ticks (mean 34.3 s, 2.5x
   spread) to 1109-1498 (mean 21.7 s, 1.35x spread). This is why the creep did
   not need touching - see below.
2. **Ticket 03's "the wall stretched to ~340 ticks" was a comparison of two
   different quantities.** 03 read 340 as *last ember* against ticket 02's 232,
   which was *last wood*. Measured across the whole `p` sweep, the wall's last
   wood is 170-257 ticks and its last ember 322-422 at **every** `p` from 0.05
   down to 0.0005 - the branch does not stretch the finish. Nothing to fix.

### Every value left alone, and why

- **The five ladder rungs (sulphur 1.0, oil 0.9, vine 0.6, seed 0.3, moss 0.2)
  and the 0.4 tag fallback.** Each tells its story on measurement: heap chains
  in 0.2 s, pool flashes in 0.17 s, fuse 10/10 in 0.6-0.8 s, and consumption
  times rank vine < seed < moss on the same mat. Nothing to move.
- **`fire + wood` 0.2.** Swept 0.4 / 0.2 / 0.1: the cabin's first char lands at
  tick 1-3 at all three, so the value is invisible in the only thing it governs
  (how fast a torch takes hold). 0.2 is also what makes wood the slowest rung
  below the tag row, which is the ladder's point.
- **`lava + wood` 0.1.** Swept 0.2 / 0.1 / 0.05: first char at 0.1 s / 0.2 s /
  0.2 s. Indistinguishable in play, and 0.1 keeps lava chars *below* lava's own
  0.15 tag row, which is the "more slowly than it lights anything else" the
  spec asks for.
- **`ember + wood` creep 0.02 - the one considered and deliberately refused.**
  Swept 0.1 / 0.06 / 0.04 / 0.02 / 0.01 on three scenes. Raising it does shorten
  the cabin (0.04 -> 12-27 s, 0.06 -> 10-19 s against 0.02's 18-25 s), but the
  cabin's duration is creep rate *times path length* and its path is a 120-cell
  perimeter one front wide - so buying a fast cabin means buying a fast crawl,
  and the crawl is the entire thing the smolder phase exists to show. Measured
  on an 11-cell beam over 100 ticks: 0.02 spreads 3-9 cells (a visible crawl at
  3-5 cells/s), 0.1 spreads all 11 (gone before you look). And 0.02 is measured
  *right* on the spec's own named scene: a 20x13 wall chars fully in 3.2 s and
  is spent by 5.8 s. The retune above already took the cabin from 34 s to 22 s
  without touching the crawl, which is the better lever. Numbers for Ed are in
  REMAINING FOR ED in case he wants the cabin faster still.
- **Ember lifetime 120 + 60.** Swept 60+60 / 90+60 / 120+60 / 180+60. The
  measured reading is the first eruption: 1.2-1.9 s / 1.8-2.4 s / **2.4-2.6 s**
  / 3.5-3.9 s. Spec §2 asks for "2-3 s of glow"; the shipped pair is the only
  one that delivers it.
- **Ash density 35.** No measured problem: it sinks into water, rests on mud,
  and sand and seed sink past it - all pinned in `ash.test.ts`, and the loop
  closes end to end on measurement. The density is a ladder position, not a
  feel dial.
- **Ember and ash colour shades.** Genuinely a visual judgement (and one that
  interacts with the mass rule, ADR 0040 §3, not just with the base). Left
  exactly as tickets 02/03 derived them and handed to Ed - see below.

### Tests revisited for meaning, not for passing

Four assertions were pinning the old `p` rather than the behaviour it stood for.
Two of them failed outright on the change, which is the good outcome; two passed
and were rewritten anyway, which is the point of the instruction.

- `ash.test.ts` `registers the residue branch off fire + ember` pinned
  `p: 0.05` outright. **Failed.** The `p` line is gone (products still pinned,
  both ways round), and the rate it stood for is now a separate behavioural
  case, **`lets an ember held against open flame usually still erupt`** - 40
  sealed pockets, asserting a majority erupt and that some still ash. It is a
  real discriminator: 0.05 gives 2/40 and 0.01 gives 18/40, and both fail it.
- `fire.test.ts` `creeps along a wood beam through orthogonal contacts only`
  asserted every cell of a *floating* beam consumed, on all 40 seeds. **Failed**
  (seed 22 keeps its last two cells). Investigated rather than loosened: a beam
  in mid-air is the one arrangement where the burn can strand itself - the
  front's last ember can erupt before its 0.02 draw on the next cell lands, and
  the flame that eruption makes is a *gas* with nothing under the beam to hold
  it, so it rises away and nothing is left in the world that can light the rest.
  A stub on a floating beam is a legible ending, and structures do not do it
  (the cabin ends at zero wood on every seed). The test now allows at most a
  two-cell stub per seed and pins the *frequency* instead - over 90% of the 40
  seeds clear it outright - which is the behaviour rather than the number.
- `fire.test.ts` `smolders through a wall of wood rather than detonating it`
  asserted `count(FIRE) === 1` at tick 70. **Passed on seed 1 at the new p, and
  was still wrong.** At 0.05 "still exactly the one flame" was an invariant; at
  0.003 whether that walled-in cell is *alight* at tick 70 is a coin the draws
  decide (measured: alight on seeds 1-5 of this wall, out by tick 70 on some
  seeds of other arrangements). Loosened to `<= 1`, which pins the half that is
  a fact - the fire never *spread*, because char carries no `flammable` tag and
  a wall of char cannot carry a wave of ignitions. Its measured comments were
  refreshed (92 glowing / 166 wood at tick 70; peak 100 flames).
- `ash.test.ts` `leaves residue behind when a block of wood is burned down`
  asserted only "some ash, and less than the whole block" - which the old `p`
  satisfied at 48%, so the bound said nothing. **Passed, rewritten anyway.** It
  now brackets the yield the way this ticket words it: noticeable (more than ten
  cells) and not blanketing (under a quarter of the block), against a measured
  11-15%. Ticket 03's `p` fails the upper bound.

`pnpm lint`, `pnpm typecheck` and `pnpm --filter silt run test` all green: 27
vitest files / 256 tests, 50 Playwright CT tests passed + 1 skipped. No
determinism, layout or scene test needed an edit.

### Costs

**A burn scenario was added to the bench** - the ticket's invitation, and it
covers the exact gap ticket 02's Answer and ADR 0042 both flagged as untested
("a whole-screen wood world set alight is the case the bench does not cover").
`reaction churn` does exercise wood + fire, but its front stays local and only
~2.2k cells are ever awake; a smoldering mass is awake *by construction*, so
what needed measuring was the top of that. **`wood world ablaze`**: 53,000 cells
of wood lit along the entire top edge, which holds a steady ~4.3k embers and
~1.3k flames across the measured window (checked by sampling - the wood drains
roughly linearly, so no part of the window is paid for by drifting smoke).

`pnpm --filter silt run bench`, three runs each, ms/tick beside
`scannedLastTick`:

| scenario | branch base 77e1278 (pre-burnables) | this branch (01-04) |
| --- | --- | --- |
| spawners + mixed world | 0.565-0.571, scanned 7093 | 0.568-0.573, scanned 7093 |
| reaction churn | 0.634-0.638, scanned 1747 | 0.692-0.696, scanned 2168 |
| **wood world ablaze** | **1.135-1.145, scanned 0** | **1.908-1.943, scanned 16454** |
| plant growth | 0.730-0.732, scanned 6226 | 0.781-0.819, scanned 6226 |
| settled world | 0.002, scanned 0 | 0.002, scanned 0 |

The headline: **a whole-screen burn costs about 1.9 ms of a 16.7 ms frame at
~16k cells awake** - a ninth of the budget for the largest burn the grid can
hold. The `scanned=0` on the *before* side is not a broken row, it is the old
behaviour measured honestly: pre-ember a screen of wood flashed and was over
long before the window ended, so there was nothing left awake to count. That
contrast is the whole point of printing `scanned` beside the timing.

`reaction churn` is +24% cells scanned for +9% of a tick, and note it came
*down* from ticket 03's scanned=3399 to 2168 - the retune leaves far fewer ash
grains sitting in notches keeping chunks awake (ADR 0039). Mixed world, plant
growth and settled world scan *exactly* the same cells as before, which is what
says their timing deltas are in-suite noise rather than signal (ticket 02
established the same for plant growth by running it alone).

**Also measured against `main` (2099cb2), as the ticket words it** - but the
base above is the honest comparison: main has since taken #119 "silt: oil oozes"
(75558cf), which changes the mixed world's oil and drops that row's scanned from
7093 to 5859, so a main-vs-branch delta on that row is measuring oil viscosity,
not burnables. Main's three runs: mixed 0.504-0.505 scanned 5859, churn
0.633-0.639 scanned 1747, ablaze 1.134-1.143 scanned 0, growth 0.777-0.804
scanned 6226, settled 0.002 scanned 0. Every burnables-relevant row agrees with
the base.

### Doc sweep

- `apps/silt/CLAUDE.md` - the roster line and the `elements.ts` summary were
  **verified current** (tickets 02/03 did name ember and ash, and the
  wood-chars-to-ember sentence is there). One stale line found and fixed: the
  `bench` entry under Commands said "four named scenarios", now five.
- `paletteGroups.ts` products comment - **verified**, covers both species
  ("So are ember and ash - a cell of wood that something set smoldering, and
  what the fire left of it, never something you place"). Untouched.
- `docs/adr/0040` §3's shade count - **verified current** ("sixteen of nineteen
  once the burnables effort landed"); ticket 03 already fixed it.
- **ADR 0042** - no decision changed, and no mechanism change was needed, so no
  escalation. But it carried measurements that the retune made factually wrong
  (48% ash, "the flame lives to tick 133", and an explicit unactioned
  recommendation to try "a `p` nearer 0.001"), and leaving those in an accepted
  ADR is worse than editing it. Updated: §6's code block carries 0.003 with a
  one-line note on who changed it and why it is a rate rather than a decision;
  the consequences carry the sweep table, the unpredicted pace/variance effect,
  the corrected wall timeline, the new bench row and the retune's effect on the
  churn scan count; the moved-tests list grew from three to five entries; and
  the Related header now names ticket 04.
- **Spec** - §3's row updated to 0.003 with the arithmetic that justifies it
  (§1's table needed no value changes, so it gained a short note recording that
  every rung shipped as written *and what was measured to say so*), and §2
  gained the same for the ember rows and the lifetime, including why the creep
  was considered and refused.

### REMAINING FOR ED

Everything below is a human judgement this pass deliberately did not make.

1. **The real-speed eyeball itself** - `pnpm dev --filter=silt`, port 3009.
   Every number above is a measurement, and a measurement cannot tell you
   whether a burn *feels* right. Build the ticket's scene (hollow wood cabin
   torched at a corner, oil pooled at its foot, a vine up one wall, a sulphur
   heap nearby) and watch it at 60 tps.
2. **Ember and ash colour shades - not tuned, on purpose.** Ember's base is
   `#b3401d` and ash's `#9b948b`, each with three shades derived by the mass
   rule (ADR 0040 §3, x0.90 / x1.08 / x0.96). No harness can judge these. Two
   specific questions: does glowing char read as *hot* against wood's brown at
   the 300x200 on-screen scale, and does a bed of ash read as spent residue
   rather than as pale sand? Change the base and the other three re-derive.
3. **The creep shimmer.** `ember + wood` re-rolls `rb` on every spread, so a
   smoldering mass shimmers - but the mass rule's spread is only +-10% of
   luminance, so ticket 02 flagged that the effect may be too subtle to see.
   Worth a look at a wall mid-burn. If it wants to be visible, that is a
   conversation about the rule (ADR 0040), not about ember.
4. **Is 22 s the right length for a cabin?** Measured, a hollow 60x51 cabin is
   fully consumed in 18.5-25.0 s and the last glow is out by 21-28 s, with the
   floor going last (fire rises, so the roof gets help the floor does not). This
   pass judged that calm and correct for silt's register and refused to speed it
   up, because the only lever is the creep and speeding the creep kills the
   crawl. If you disagree after watching it, the measured options are creep
   0.04 (cabin 12-27 s, beam crawl roughly doubles) or 0.06 (10-19 s) - one
   number in `elements.ts`.
5. **Does a doused wall look wrong?** ADR 0042 §4 left this open: a structure
   that survives a downpour comes back as *wood*, so it looks untouched rather
   than scarred. Measured, rain saves 37-48% of a burning cabin. If "untouched"
   reads wrong, a damp-char species is a roster conversation, not a tuning one.
6. **A roofed box shelters its own smolder from rain.** Legible, arguably
   correct, and worth confirming it does not read as the douse being broken -
   surface rain cannot reach an ember inside a closed cabin; the player has to
   paint water in.

### Code review

`/code-review` against `f3dbfc1` (ticket 03's commit, so the diff is this
ticket's alone), both axes. **No scope creep on either axis** and no standards
breach in the sim code - the change is one `p`, no archetype, hook, engine or
row. Both reviewers reproduced the bench numbers and the sealed-pocket
experiment independently. Six findings acted on:

- The `## Answer` was missing when they read the tree, and three shipped
  comments cited it. Written (this section's parent).
- `elements.ts` quoted the pocket experiment as "60 pockets, 70% / 3%" where
  the ADR and the test say 40 pockets, 65% / 5% - the 40-seed run is the right
  one. The comment is now a short summary pointing at ADR 0042 §6 for the
  sweep, which also removes the fourth copy of the same arithmetic.
- **The beam test was still pinning a number**: `left <= 2` is the measured
  maximum stub with no slack beside it. Now bounded as a share of the beam
  (`< BEAM / 3`), so it says "the burn crossed the beam" rather than "exactly
  the stub I measured"; the aggregate `>90% of seeds clear it` is unchanged.
- `ash.test.ts` reused species ids as outcome tokens (`return FIRE` for
  "erupted"). Now a `'erupted' | 'ashed' | 'still glowing'` union, which is
  what the values actually mean.
- A comment claimed first ash on the wall at tick 8-14; that figure was the
  *cabin's*. Re-measured on the wall at the test's own 600-tick horizon:
  tick 25-59 (and ash 28-40, which was right).
- Two of the ticket's six scenes (the rain rescue and the loop) were measured
  but unrecorded; both are now in the scene table above at the shipped `p`.

Two findings noted and not acted on: `RNG_SEEDS` is now duplicated in
`fire.test.ts` and `ash.test.ts` (two lines, and `count`/`run` are already
duplicated between them - extracting one of the three and not the others would
be worse), and the `1 - (1 - p)^150` reading appears in three places after the
trim (the ADR as authority, the spec because its own stated number changed, and
the test because it explains why the test does not pin a number) - different
readers, not surplus.
