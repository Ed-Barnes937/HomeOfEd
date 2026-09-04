# Spec: Silt life above the waterline

Vines today grow only into water (`apps/silt/src/sim/growth.ts`, ADR 0035):
water is both substrate and resource, so nothing lives on land. This epic
grows meadows on the mud - stalks, flowers, petals, a seed bank - and closes
a burn-to-regrowth water cycle: rain -> mud -> biomass -> steam -> rain.

Every mechanic here was validated in two throwaway prototypes (three revisions
of the first, four of the second), with headless measurements. The prototypes
are the primary source for tuning values and for the pure update rules - the
sim module in each is written to lift.

- `.scratch/silt-life-followup/prototype/above-water-life.html` (local file,
  also committed on the throwaway branch `proto/silt-life-followup`)
- `.scratch/silt-life-followup/prototype/evaporation.html` (same)

## 1. Rulings (Ed, 2026-09-03)

1. **Thin-film evaporation**, chosen deliberately over the measured
   "shallow pool" alternative: only depth-1 water films (air above, non-water
   below) evaporate. A level pool two deep or deeper is permanent by design -
   standing water is a thing you can make. Keep the measurements in the ADR
   (§7) so the alternative isn't re-litigated blind.
2. **Plant drinking is reinstated** as the biological water sink: growing a
   plant consumes the soil moisture it stands in (mud -> dirt). Safe again
   because biome commitment (§4.2) killed the vine-flip that made us drop it.
3. **Petal-on-water seed strikes stay garnish** (~1 strike / 20k ticks).
   Ponds gain life mostly from seeds tumbling in; petals are atmosphere.
4. **Fuller meadow**: tune germination so an established bed carries ~20+
   crowns (v3's dormancy tuning halved it to 4-16; that read as scrub).
5. **Dropped / rejected**: fungus (entirely); moisture wicking and
   permeability (breaks conservation via "1 water = >1 mud", and wicking soil
   keeps chunks awake forever for a transport problem 2-4 cell beds don't
   have); critters (need a fifth archetype); canopy trees.
6. **None of the new elements are paintable.** They are discovered through
   play (see the discovery-tree epic). The rail stays at eleven.
7. **Sequencing**: everything except ticket 01 waits for the burnables epic
   to merge (ignition ladder, ember 18, ash 19, ADR 0042) - this epic writes
   to the same reaction surface and depends on ash for the burnt-meadow loop.

## 2. Engine constraints this design is built around

1. **`ra` is owned by `lifetime`.** An element may use `ra` only if it never
   expires. Every living thing here therefore splits into a **grower and a
   product**: the stalk *tip* grows (owns `ra` as an energy budget, never
   dies) and leaves inert *stem* behind (expires, never grows). The same
   split shapes seed vs buried seed. This is the third use of the pattern
   after growth's branch counter and the liquid opinion field - it deserves
   its own ADR (§7).
2. **`set` clears the target's scratch bytes**, so a hook cannot hand state
   to a cell it creates. The travelling tip budget needs ticket 01's engine
   change: `set` may carry an `ra` value. Without it the tip must swap-and-
   backfill, which is movement inside a hook - rejected.
3. **`MAX_LIFETIME_TICKS` is 255** (4.25 s). Flowers live 600-1200 ticks, so
   ticket 01 also adds `lifetime.every` - a coarse countdown that decrements
   every N ticks. The v3 prototype hit this exact wall.
4. **One reaction row per pair; `p` is a rate, never a split.** Two
   consequences: (a) burial *replaces* instant germination - `seed + mud`
   cannot both sprout at p 1 and bury at p 0.1, so all germination now
   routes through the bank; (b) the prototype's "burning plant sometimes
   becomes steam" probability split is unimplementable - instead it becomes
   a per-species choice (§4.5): dry parts burn, wet parts steam.
5. **`rb` is the colour variant** (ADR 0040), seeded at birth, never written.
   A flower declaring 8 petal colours gets per-cell meadow variety for free.
   Petals cannot inherit their parent's exact colour (rb reseeds) - they
   share the same palette, statistically identical in a crowd.
6. **Chunk margin is 2.** The evaporation film test (1 cell down) and the
   biome depth test (2 cells) fit. Anything reading deeper (a depth-3 rule,
   wicking) needs a margin raise - out of scope.
7. **Hooks must self-terminate or chunks never sleep.** Plant drinking and
   evaporation both burn out naturally (dry soil stops, dry ground stops).
   This is why wicking was rejected and why the evaporation hook's
   keep-awake strategy is the risky half of ticket 05.
8. **Reactions see pairs**, so the biome check (water vs air above a
   germination) is a hook, not a row.

## 3. New roster

Ids continue after burnables (ember 18, ash 19). Pinned once merged, never
renumbered. None are paintable.

| id | element | archetype | tags | lifetime | ra | notes |
| --- | --- | --- | --- | --- | --- | --- |
| 20 | buried seed | static | solid | none | soak counter | lives in the soil; fireproof (fire never reaches below the surface); germinates only when unroofed |
| 21 | sprout | static | solid, flammable | none | branch/none | land-committed moss; grows a stalk, never grows into water |
| 22 | stalk tip | static | solid, flammable | none | energy budget | the grower; climbs into empty air, budget decrements as it travels |
| 23 | stalk | static | solid, flammable | long, `every`-coarse | engine | inert stem left behind the tip; crumbles to nothing when it expires |
| 24 | flower | static | solid, flammable, 8 colours | 600-1200 ticks via `every` | engine | death drop: seed + petals (§4.4) |
| 25 | petal | powder d10 slide 1 move ~0.25 | powder | 80-150 ticks | engine | needs `move` on the powder archetype (ticket 01); floats on water |

Existing elements re-used: seed 15 (falls, buries), moss 16 (becomes the
*aquatic* commitment - unchanged vine growth), vine 17, steam 10, water 3,
mud 14, dirt 1. Ash 19 arrives from burnables.

## 4. Mechanics

Tuning values live in the prototypes; the numbers below are the validated
starting points, not gospel.

### 4.1 Seed bank (ticket 02)

A seed resting on mud buries: `seed + mud -> buried seed` (p ~0.1 per contact
tick), the seed sinking into the soil cell. **This row replaces the existing
`seed + mud -> moss` row** (§2.4). Buried seeds are dormant while roofed and
germinate with low coarse probability when the cell above is open. They are
not flammable - fire quenches on the wet surface above them (§4.5) - so the
bank survives a total burn. Measured: recovery from a full burn in 500-3000
ticks (was 15-25k and usually never); the bank self-caps structurally because
burial costs a soil cell and germination refunds it.

### 4.2 Biome commitment (ticket 02)

Germination decides the biome **once**: standing water above the buried seed
-> moss (aquatic, grows vine, existing rules); open air -> sprout (land).
"Standing water" requires **depth and soak** - at least 2 cells of water above
*and* ~120 ticks of continuous wetness (soak counter in the buried seed's
free `ra`) - because a one-shot look-above was gameable: a droplet resting
three ticks flipped a germination aquatic and rain turned meadows to marsh.
Measured with depth+soak: a rain session produces ~2 vines, a poured flood
662. Flooding still flips the *next generation* - the waterline decides the
biome, seeds are the single source of both flowers and vines.

### 4.3 Stalk and flower (ticket 03)

Sprouting charges the soil (ruling 2): the sprout's birth converts the soil
cell it drank from to dirt, and the tip's prepaid `ra` budget (~6-10, jittered)
is the water it holds as biomass. The tip climbs: each tick, p ~0.3, `set` the
cell above as the new tip carrying budget-1 (ticket 01), `become` inert stalk.
At budget 0 the tip becomes a flower. Flowers get 8 pastel colours - variety
via `rb & 7` is free.

### 4.4 Petals and the meadow loop (ticket 04)

A withering flower drops a falling seed plus 3-4 petals, and sheds an
occasional petal while alive (p ~0.005/tick) - 1-2 petals per death measured
as nearly invisible. Petals drift down-sideways (slow powder), expire as
garnish, except: resting on mud -> seed p ~0.01 per contact tick; touching
water -> seed p ~0.001 (garnish rate, ruling 3; the seed sinks, pond floors
grow vine). The loop closes: seed -> buried -> sprout -> stalk -> flower ->
seed. Measured steady state: stable population over 60k ticks, petal-seeds
~15% of germinations, offspring-per-flower pins itself at 1.0 (that number is
untunable by definition - tune the settled population instead, ruling 4).

### 4.5 The water cycle (ticket 05)

- **Thin-film evaporation** (ruling 1): a water cell with open air above and
  a non-water cell below may become steam, coarse p (film clears in ~300-800
  ticks). **The humidity brake is load-bearing and deliberate**: steam
  directly above blocks evaporation, else a sheet under its own plume
  evaporates as fast as a droplet. Steam already condenses back to water -
  evaporation transmutes, never deletes.
- **Fire quenches on wet soil**: `fire + mud -> steam + dirt` - the soil's
  water is lofted, not deleted. Fire therefore spreads through the plants
  standing in a bed but never along it, and a wildfire rains on its own ashes.
- **Dry parts burn, wet parts steam** (§2.4): stalk and stem ignite per the
  burnables ladder (they become fire); flower and sprout are wet biomass and
  become steam instead. One row per pair, no splits, and the flower's stored
  water returns to the sky.
- **Ash closes regrowth** (from burnables): `ash + water -> mud`, and buried
  seeds under the burn germinate into the cleared air.
- Ledger measured drift-zero at every sample across all runs.

## 5. Staging

| ticket | what | blocked by |
| --- | --- | --- |
| 01 | engine: `set` carries `ra`, `lifetime.every`, powder `move` | nothing - can go to main now |
| 02 | seed bank, burial row, biome commitment | 01, burnables merge |
| 03 | sprout, stalk tip, stalk, flower | 02 |
| 04 | petal, shedding, petal-seed strikes | 03 |
| 05 | evaporation, quench row, dry-burns/wet-steams, ash regrowth | 02, burnables merge |
| 06 | tuning + scenes (density ~20+ crowns, burn recovery, iwft) | 03, 04, 05 |

## 6. Held back, deliberately

- **Shallow-pool evaporation** (drain level 2-deep pools too): measured
  better on paper (2-deep clears 268-468 ticks vs never; poured puddles
  faster on 3 of 4 seeds), declined on feel - standing water is a feature.
  The numbers live in the evaporation prototype if it ever comes back.
- **Any-surface evaporation is a recorded trap** (§7): it reads as the
  intuitive rule and fails its own job - it manufactures the rain that
  refills the puddle it was meant to dry (never cleared in 12k+ ticks, ~40%
  of all water permanently aloft) and kills ponds (half-life ~1000 ticks).
- **Wicking / permeability**: revisit only for a deep-soil terrarium scene,
  and only the conserving half (moisture *moves*, never multiplies).
- **Ambient weather**: an undisturbed pond emits nothing under thin film.
  Plumes and rain come from fire. A deliberate scope decision - silt is calm
  until provoked.
- **Critters** (fifth archetype) and **canopy trees** (multi-cell structure).

## 7. ADRs to write during implementation

1. The grower/product split: one byte cannot both grow and expire (ticket 02
   or 03, whichever lands the first pair).
2. Thin-film evaporation with the humidity brake, recording the any-surface
   trap and the declined shallow-pool measurements (ticket 05).
3. The water ledger: every rule transmutes, none deletes; biomass is a water
   store (ticket 05).

## 8. Watch items

- **Keep-awake economy**: growth already writes `ra` every tick to hold its
  chunk awake; evaporation needs film cells awake too. Both self-terminate,
  but the pattern is spreading - if a third hook needs it, promote a real
  `keepAwake` on `Api` instead of a third disguised write.
- **The fire brush digs.** In the prototype a dragged radius-3 fire brush
  excavated the soil row and destroyed the seed bank - it read as "the bank
  doesn't work" until diagnosed. Check whether the real app's brush has the
  same trap when painting fire over terrain; if so it wants the same guard
  (fire ignites what stands on ground, it does not replace the ground).
- **Density vs dormancy**: the germination probability is the single knob
  that moved the standing population most. Tune last, in ticket 06, against
  the ~20+ crown target.
- **Id collision risk with burnables**: this spec assumes ember 18 / ash 19.
  Confirm before pinning 20-25.
