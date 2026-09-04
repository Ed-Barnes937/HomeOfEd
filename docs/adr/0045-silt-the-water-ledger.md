# 0045 - silt: the water ledger - rules transmute, and the exceptions are named

- **Status:** Accepted
- **Date:** 2026-09-03 (**amended** the same day: thin-film evaporation now
  deletes rather than transmuting - [ADR 0044](0044-silt-thin-film-evaporation.md)
  §6 - so it moves out of §1's invariant and into §4's named exceptions, as the
  fifth and by far the largest of them. This ADR was titled *every rule
  transmutes, none deletes*; that claim did not survive a feel ruling and the
  title went with it. §1's table, §2 and §3 are otherwise unchanged.)
- **Related:** `.scratch/silt-life-followup/spec.md` §4.5 and §7.3, ticket 05
  (`.scratch/silt-life-followup/issues/05-water-cycle.md`);
  [ADR 0044](0044-silt-thin-film-evaporation.md) for the drain that makes the
  ledger move at all; [ADR 0042](0042-silt-wood-smolders-as-ember.md) §6 for
  `ash + water -> mud`, the last link of the burn-to-regrowth loop;
  [ADR 0043](0043-silt-growers-and-products-split-the-byte.md) for the
  grower/product split that decides where a plant's water is held. The table is
  `apps/silt/src/sim/elements.ts`; the soak tests are in
  `apps/silt/src/sim/life.test.ts` under `the water cycle`.

**Why this is its own ADR rather than a section of 0044.** ADR 0044 is a
mechanism with tuning and two rejected alternatives, and it will be re-read by
someone changing evaporation. This is an **invariant every future reaction row
has to obey**, and it will be re-read by someone adding a row that has nothing to
do with evaporation. They have different readers and different lifetimes.

## Context

The epic's headline is a cycle: rain -> mud -> biomass -> steam -> rain. A cycle
is only a cycle if nothing leaks, and until ticket 05 the table leaked in one
place and could not close in another.

- **`mud + fire -> dirt + smoke`.** Fire drying a bed left *smoke*, and smoke
  fades to nothing (`becomes: null`). So the one rule in the whole table that
  destroyed water outright was the one a wildfire fires most - and it destroyed
  it exactly where the design needed it back. A burnt meadow could never rain on
  its own ashes because the rain had been deleted on the way up.
- **Nothing else in the table has ever leaked.** `water + lava`, `water + fire`,
  `water + ember` all hand the water to steam, and steam's own lifetime hands it
  back as water. `water + dirt` and `water + ash` are two cells in and one out,
  but the cell that goes is the *water* and the cell that stays is *wet*: the
  water moved into the soil rather than out of the world.

The prototype carried a live ledger the whole time for exactly this reason, and
measured drift zero at every sample of every run of all three evaporation rules.

## Decision

### 1. A rule that touches water **transmutes** unless §4 names it

The default is transmutation and the burden is on the exception: a rule whose
product is `null` or `smoke` on the water side is deleting water, and it does not
get to do that quietly. It has to be argued into §4 by name.

**This section read "none deletes" until the same day it was written.** Thin-film
evaporation now does (ADR 0044 §6, a feel ruling), and it is §4's fifth entry.
That is the mechanism this ADR was built for working as intended - the invariant
was never the point, the *naming* was.

Water is in exactly one of three places and rules move it between them:

| where          | species                                     |
| -------------- | ------------------------------------------- |
| free           | `water`                                     |
| aloft          | `steam` (which condenses back to `water`)   |
| in the soil    | `mud`, and the `buried` seed made out of it |

The ledger is the sum of those, and no rule in the table may change it except the
ones §4 names.

### 2. The quench leaves **steam**, not smoke

`mud + fire -> dirt + steam`. The soil's water is lofted rather than deleted, and
the fire cell is what it turns into - so a flame that reaches wet ground dries one
cell and is gone. Two things fall out of it for free and neither is a rule: fire
spreads through the plants standing on a bed but never along the bed itself, and
**a wildfire makes its own weather**.

Measured on a sealed box - a dirt bed, a pour, a torch at tick 800, and the rain
that follows - over 3000 ticks with the ledger read **every tick**: drift zero on
every tick of every seed.

### 3. Biomass is a water store, and burning empties it back to the sky

A land plant drinks one cell of soil when it germinates: the bank cell it grew
out of is refunded as *dirt*, never mud (spec ruling 2). That cell of water is
then held in the plant, whatever the plant does next - a sprout, a climbing tip,
a stem and a flower are all the same one cell of water wearing different species.

So the ledger extends to the living meadow as **water + steam + mud + bank +
crowns**, where a crown is the plant's single growing or terminal end - a sprout,
then a tip, then a flower - exactly the count `seedBank.ts`'s own ledger case
uses. Every step of the loop conserves it:

| step                                | ledger                        |
| ----------------------------------- | ----------------------------- |
| `water + dirt -> mud`               | water -1, mud +1              |
| `seed + mud -> buried`              | mud -1, bank +1               |
| germination: `buried -> dirt` + crown | bank -1, crown +1           |
| sprout -> stem + tip, tip -> flower | crown 1 -> 1                  |
| `mud + fire -> dirt + steam`        | mud -1, steam +1              |
| `fire + flower -> fire + steam`     | crown -1, steam +1            |
| `fire + sprout -> fire + steam`     | crown -1, steam +1            |
| steam's lifetime                    | steam -1, water +1            |
| `water + ash -> mud`                | water -1, mud +1              |
| `petal + mud -> seed + mud`         | unchanged - the soil is kept  |

**This is what "dry parts burn, wet parts steam" is for.** The engine cannot
split one row by probability (spec §2.4), so the prototype's weighted
steam/ash/fire outcome becomes a per-species choice: the stem and the travelling
tip are the plant's dry tissue and stay on the ignition ladder, which is what
carries a fire up a meadow at all; the sprout and the flower are mostly water, so
what leaves them is the water. A burnt plant hands back exactly the cell its
germination drank.

### 4. What the ledger does **not** cover, named rather than glossed

The ledger is the water cycle's own rules - rain, soil, the quench and the
burning of wet biomass. It is **not** a law over the whole table, and saying so is
the difference between a useful invariant and a false one. **Five** places spend
water. Four are older than this ticket and none of them a regression; the fifth
is thin-film evaporation, added the same day this ADR was, and it is the one that
took evaporation *out* of the list above:

- **Thin-film evaporation deletes, and it is the deliberate leak**
  ([ADR 0044](0044-silt-thin-film-evaporation.md) §6). A drying film becomes
  `empty`, not `steam`, so the water is gone: the world's only unbounded drain,
  and much the largest of these five. It transmuted until Ed watched it running
  and ruled against it on feel - *"1 layer water disappearing instead of constant
  steam everywhere"* - because a rule that lofts every drying film puts a
  permanent ambient haze over every wet bed, and the haze read as noise. ADR 0044
  §6 carries the ruling and the trade; what belongs here is the **shape** of the
  leak, because that is what a future row has to be checked against:

  - it is **one-directional** - nothing in the table makes water, so the ledger
    is monotonically non-increasing;
  - it leaks **at most one cell per film per tick**, and only from a cell with
    open air above and solid ground below;
  - it is **small in a closed world**: measured on the sealed box that used to
    hold drift zero - a pour, a burn at tick 800 and the rain that followed -
    drift 2, 5, 7 and 4 cells of an opening 20 over 3000 ticks, four seeds, with
    zero rises, no fall larger than one cell on any tick, and no fall anywhere
    that outran the films standing at the top of that tick.

  That last sweep is the acceptance now, and it is a stronger statement than
  "drift zero" was: it pins that evaporation is the **only** leak. A quench that
  regressed to smoke, a condensation that went missing or a wet-biomass row that
  deleted would each show up as a fall with no film under it.
- **A flower that withers unburnt takes its cell of water out of the world.** The
  stem crumbles to nothing and the flower becomes a seed, and neither is a water
  store, so the ledger falls by one for every plant that dies of old age. This is
  the one that matters, and it is unpacked below.
- **Aquatic biomass is a water store with no return at all.** Growth converts a
  cell of water into moss or vine one for one (ADR 0035), and both are on the
  ignition ladder as *dry* fuel - `fire + vine` and `fire + moss` make fire, not
  steam. Splitting them by wetness the way the land plant is split would be a
  change to the burnables ladder, and the aquatic side has no equivalent of the
  crown to hang the store on: every cell of a vine is a cell of water.
- **Lava is still a dry heat source.** `lava + [flammable]` makes fire, so lava
  reaching a flower burns it rather than steaming it. Deliberately left on the
  ticket's own line - it named the burnables ladder - and it is one row's worth
  of change if a scene ever makes it read wrong.
- **Acid erases, and that is its character.** `acid + [solid]` takes a flower and
  its water with it. Acid is the one reagent in the roster whose whole job is
  removal; it is not a hole in a cycle it was never part of.

#### The one that matters: a plant dying of old age

The withering leak is not a bug introduced here. It is ADR 0043's grower/product
split meeting ruling 2's reinstated plant drinking, and ticket 04 measured its
consequence before this ticket existed: a closed 261-cell bed carries a meadow
past 12,000 ticks and then thins as the last of its soil dries, gone by
20,000-30,000. Ticket 05 was measured against that number and does not beat it on
an unburnt bed - a bed given a one-deep sheet of water to cycle still thinned to
nothing by 25,000-30,000 over two seeds at 40,000 ticks, because evaporation
*moves* water and never makes any.

**The deletion ruling closed that last gap the wrong way round** (ADR 0044 §6),
and this is the honest amendment: evaporation no longer moves water either, so
**watering a meadow now buys it nothing at all**. A one-deep sheet is film along
its whole length, so it dries out of the world rather than cycling - measured,
the 261-cell sheet was gone in 696-702 ticks - and the watered bed then thinned to
nothing at **19,393-19,409** ticks over two seeds, against the 25,000-30,000 above
and statistically indistinguishable from the *unwatered* 20,000-21,600.

The number the epic's acceptance rests on did not move: an unattended, unwatered
meadow still establishes 20 crowns by 1531-1688 ticks, peaks at 49, and dries on
the same ~20,000-tick horizon ticket 04 pinned. What went is a player affordance
nobody had asked for out loud - that pouring water on a meadow prolonged it.
Whether it should come back is the same open feel question this section already
leaves to a person watching one, and it is now a slightly larger one.

Ticket 05 does not close it, and closing it is deliberately **not** a water-cycle
change:

- The obvious fix - a stem crumbling to steam rather than to nothing - hands back
  a cell of water for every cell of *stem*, and a plant is eight to eleven of
  them. That does not conserve the ledger, it inflates it eightfold.
- Handing it back once, from the flower, means the flower's `lifetime.becomes`
  leaving steam instead of a seed - which is the meadow loop's only reproduction
  step (ADR 0043 §4). The two cannot both come out of one byte.

So the honest statement is the one the measurements support: **the cycle is
closed under fire and open under old age.** Burn a meadow and its water comes
back; leave it alone and the bed dries on the timescale ticket 04 pinned. Whether
a meadow should be perpetual without a match at all is a roster question for
ticket 06's tuning pass, not a rule in this table.

**After the deletion ruling, closed under fire means closed for one turn.** The
quench and the wet-biomass rows still hand every cell back, so a burn is still
water-positive at the moment it happens; but what it hands back is free water,
free water lands as film, and film now dries. A meadow burnt over and over does
not hold its bed for ever the way this paragraph implied.

**Ticket 06 answered it with a measurement rather than a rule**
([ADR 0046](0046-silt-a-meadow-s-density-is-its-flower-s-lifetime.md)). It left
the hole open - a question about how an unattended meadow should *feel* wants a
person watching one - and what it owed this ADR was the number. The number is
that the density pass did not move it: doubling the standing population by
doubling the flower's life left the 261-cell bed drying at 20,000-21,600 ticks
against 20,600-22,400 before, because a crown that lasts longer spends the bed
more slowly per crown. Buying the same density out of the germination rate
instead would have cut the horizon to 11,400-13,200 - which is the argument for
where that knob lives, and it is in 0046.

## Consequences

- **Measured, on a scene with no life in it**: free water + steam + mud, sampled
  every tick for 3000 ticks through a pour, a burn and the rain that followed -
  drift zero, two seeds. ~~This is the ticket's conservation acceptance.~~
  **Superseded by the deletion ruling**: the drift-zero figure is the transmuting
  variant's, kept as the record. The acceptance is now §4's sweep - never a rise,
  never a fall bigger than one cell, never a fall that outran the films standing
  at the top of the tick, and a total drift of 2-7 cells of 20 over four seeds.
  It is a stronger claim than drift zero was, because it pins *which* rule leaks.
- **Measured, on a meadow**: a dragged torch clears the standing plants in 10-12
  ticks, the plume peaks at 36-38 cells of steam, the bed is wet again by 369-379
  ticks and the first new crown is up between 370 and 2088 - all of it from the
  bed's own water, with none painted. The bank survives underneath, because it is
  not flammable and it lives below the surface. **Re-measured after the ruling
  and unchanged where the quench does the work**: clearing 6-17 ticks, plume
  36-39, bed wet again by 368-382, first new crown 118-334. Only the slow tail of
  full recovery stretched, 342-884 to 342-2577, because a raindrop that lands now
  dries where it fell instead of getting a second pass.
- **A burn is still the water-*positive* event on a meadow, and the ruling did not
  touch that.** Every flower and seedling it takes hands back the cell its plant
  drank, and the quench lofts the bed's own water rather than deleting it - both
  rows are unchanged. What the ruling changed is what happens to that rain
  **after** it lands: it gets one pass at the ground. So a burn still rains on its
  own ashes and still re-wets the bed it dried, but it washes a neighbouring ash
  drift in less reliably - the drift lost 0-2 cells over six seeds, against a cell
  or two on every seed before. `life.test.ts` pins that across a seed sweep now
  rather than per seed, which is the honest shape of it.
- **A burn is no longer water-*neutral* over a whole run, though.** Neutrality was
  always a statement about the rows, and the rows still balance; what breaks it is
  that the water a burn hands back is free water, free water lands as film, and
  film now dries. The cycle is closed under fire for one turn of it, not for ever.
- **`mud + fire` no longer makes smoke at all.** Anything reading that row for
  smoke - a scene, a screenshot, a habit - sees steam now.
- **Every future row inside the cycle is bound by this.** A rain, soil,
  evaporation, quench or wet-biomass row whose product is `null` or `smoke` on
  the water side is deleting water, and needs to say in this ADR why that is
  right. §4 is the standing list of what is deliberately outside it.
  **Evaporation is now the worked example of that process rather than a
  counter-example to it**: it was argued in, by name, with the numbers, on the
  day the rule was written. The bar is unchanged - what a new row may not do is
  delete *quietly*.
