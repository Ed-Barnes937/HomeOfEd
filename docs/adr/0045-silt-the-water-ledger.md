# 0045 - silt: the water ledger - every rule transmutes, none deletes

- **Status:** Accepted
- **Date:** 2026-09-03
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

### 1. Every rule that touches water **transmutes**; none deletes

Water is in exactly one of three places and rules move it between them:

| where          | species                                     |
| -------------- | ------------------------------------------- |
| free           | `water`                                     |
| aloft          | `steam` (which condenses back to `water`)   |
| in the soil    | `mud`, and the `buried` seed made out of it |

The ledger is the sum of those, and no rule in the table may change it.

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

The ledger is the water cycle's own rules - rain, soil, evaporation, the quench
and the burning of wet biomass. It is **not** a law over the whole table, and
saying so is the difference between a useful invariant and a false one. Four
places outside it spend water, all of them older than this ticket and none of
them a regression:

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

## Consequences

- **Measured, on a scene with no life in it**: free water + steam + mud, sampled
  every tick for 3000 ticks through a pour, a burn and the rain that followed -
  drift zero, two seeds. This is the ticket's conservation acceptance.
- **Measured, on a meadow**: a dragged torch clears the standing plants in 10-12
  ticks, the plume peaks at 36-38 cells of steam, the bed is wet again by 369-379
  ticks and the first new crown is up between 370 and 2088 - all of it from the
  bed's own water, with none painted. The bank survives underneath, because it is
  not flammable and it lives below the surface.
- **A burn is now a water-neutral event on a meadow** rather than a drying one:
  every flower and seedling it takes hands back the cell its plant drank.
- **`mud + fire` no longer makes smoke at all.** Anything reading that row for
  smoke - a scene, a screenshot, a habit - sees steam now.
- **Every future row inside the cycle is bound by this.** A rain, soil,
  evaporation, quench or wet-biomass row whose product is `null` or `smoke` on
  the water side is deleting water, and needs to say in this ADR why that is
  right. §4 is the standing list of what is deliberately outside it.
