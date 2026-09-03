# 0042 - silt: wood smolders as a species, not as a heat field

- **Status:** Accepted
- **Date:** 2026-09-03
- **Related:** `.scratch/silt-burnables/spec.md` §2-3 and tickets 02 and 03
  (`.scratch/silt-burnables/issues/02-ember.md`,
  `.scratch/silt-burnables/issues/03-ash-loop.md`);
  [ADR 0028](0028-silt-simulation-engine.md) for the engine and its byte
  ownership; [ADR 0040](0040-silt-colour-variants-in-rb.md) for the shade rule
  the new element follows; [ADR 0038](0038-silt-liquids-keep-their-direction-in-ra.md)
  for why a static element is the one that can safely own a lifetime. Implemented
  in `apps/silt/src/sim/elements.ts` (roster + rows) and
  `apps/silt/src/features/palette/paletteGroups.ts` (the comment; the rail itself
  is untouched). §6 is ticket 03's extension: the ash branch off the same pair.

## Context

Until the burnables effort every fuel burned through one row - `fire +
[flammable]`, p 0.4, both sides become fire - so a wall of wood detonated on
touch exactly as a pool of oil did. Ticket 01 split that row per fuel, which
gives each fuel its own *rate*. Wood does not want a rate: it wants a *phase*.
Real wood chars, glows, and only then flames, and that phase is most of what
makes wood read as wood rather than as slow oil.

The engine offers three places that phase could live:

- **A per-cell heat field.** The natural model, and the one every falling-sand
  toy with fire eventually grows. It needs a byte, and there is none: the cell
  is four bytes and stays four bytes, `ra` belongs to the lifetime countdown and
  `rb` to the colour variant, and a parallel grid for heat is a new engine
  feature - which the spec (§4) calls a stop-and-rethink, not a ticket.
- **A hook on wood.** Also wrong by the rules the engine already holds:
  archetypes own movement, hooks own transmutation, and a hook is for what a
  reaction row cannot express - a direction, or a brake (`growth.ts` is the one
  such case). Charring has neither.
- **A species.** Everything a smolder needs is already data: a `lifetime` for
  the glow and its expiry into flame, and reaction rows for what lights it,
  what it spreads through, and what puts it out.

## Decision

### 1. The smolder is a species - `EMBER = 18`

A static solid with four glowing-char shades, `hardness: 1` as wood, and

```ts
lifetime: { ticks: 120, jitter: 60, becomes: 'fire' }
```

2–3 s of glow at 60 tps, then the cell erupts into open flame, which cascades,
rises and dies to smoke as fire always has. 180 is comfortably under
`MAX_LIFETIME_TICKS = 255`, which the registry checks at boot.

The byte ownership is clean and is *why* ember is static. The countdown owns
`ra`; the colour variant owns `rb`; and the two `ra` exceptions in the engine -
the growth hook's branch count and the liquid kernel's opinion field - are
conditional on the element declaring no lifetime. A static element declaring a
lifetime collides with neither (ADR 0038 §3).

### 2. Four rows, and their order is load-bearing

```ts
{ a: 'fire',  b: 'wood',  p: 0.2,  aBecomes: 'fire',  bBecomes: 'ember' },
{ a: 'lava',  b: 'wood',  p: 0.1,  aBecomes: 'lava',  bBecomes: 'ember' },
{ a: 'ember', b: 'wood',  p: 0.02, aBecomes: 'ember', bBecomes: 'ember' },
{ a: 'water', b: 'ember', p: 1,    aBecomes: 'steam', bBecomes: 'wood'  },
```

Wood is flammable, so both tag rows (`fire + [flammable]`, `lava +
[flammable]`) cover the first two pairs as well, and `resolvePairs` keeps the
first registration and drops the rest without a word. The two specific rows
therefore sit **above** their tag rows - the same trap `acid + wood` has
documented since the materials effort. `fire.test.ts` pins it twice: as a
declared-order slice, and, more usefully, as two registry assertions that
`reactionFor(FIRE, WOOD)` and `reactionFor(LAVA, WOOD)` produce ember. The
second pair is what fails if someone reorders the table, since a slice can be
"fixed" by editing the slice.

The creep and the douse are keyed on ember and water, which no tag row above
them claims, so those two are safe where they sit.

### 3. The creep resets the ember's own countdown - deliberately

`ember + wood -> ember + ember` rewrites the **a** side as well as the b side,
and a rewrite clears `ra`, so the ember that just spread starts its 120–180
ticks again. That is the intent, not an oversight: an ember with fuel still
beside it goes on smoldering, and only once its wood is consumed - or the 0.02
draws keep missing - does the countdown run out and the cell erupt. The
alternative (a b-side-only row) would have every ember erupt on a fixed
schedule from the moment it was lit, which is a timer, not a fire.

The same rewrite re-rolls `rb`, so a smoldering mass shimmers slightly as the
front moves through it. Also kept: at 300×200 it reads as a live coal bed.

### 4. The douse quenches to wood

`water + ember -> steam + wood` at p 1, mirroring `water + fire`. Raining on a
smoldering structure to save it is a real player verb that the instant burn
never offered, and it is the reason the smolder phase is worth having as
*gameplay* rather than only as an animation.

Back to wood rather than to a "damp char" species, because a third state would
have to earn its place in the roster and its rows, and the roster is the thing
this effort is trying to keep tight. Revisit only if a wall that survives a
downpour looking untouched reads wrong in play (ticket 04's judgement).

### 5. Neither flammable nor paintable

**Not `flammable`.** An ember is already burning, so no ignition row may reach
it - including the `fire + [flammable]` fallback, which would otherwise flash a
smoldering wall the instant its own first eruption lit a neighbour, undoing the
whole phase. The tag is what the whole ignition ladder keys on, so leaving it
off is the enforcement, not a comment.

**Not paintable.** `PAINTABLE_IDS` is untouched: ember joins obsidian, sulphur,
moss, vine, smoke and steam as something the world makes rather than something
you place. The list is explicit rather than tag-derived precisely so a new
product stays out by default; the only change here is the comment naming ember
and `paletteGroups.test.ts` asserting it is absent from the rail.

### 6. The residue is a branch off `fire + ember` - `ASH = 19`

Ticket 03's addition (spec §3). A burn should leave something behind, and that
something should feed the plant cycle rather than being litter:

```ts
{ a: 'fire',  b: 'ember', p: 0.05, aBecomes: 'fire', bBecomes: 'ash' },
{ a: 'water', b: 'ash',   p: 0.4,  aBecomes: null,   bBecomes: 'mud' },
```

`ASH = 19` is a pale-grey inert powder, `tags: ['powder']`, hardness 0,
`{ kind: 'powder', density: 35, slide: 1 }`, four shades by the mass rule
(ADR 0040 §3) — and, like ember, neither `flammable` (it is what already
burned, and the tag is what every ignition row keys on) nor paintable
(`PAINTABLE_IDS` untouched; only its comment gained ash).

**Why the branch hangs off `fire + ember` rather than anywhere else.** Ember's
`lifetime.becomes` is single-valued, so "most embers erupt into flame, a few
burn down to residue" cannot be said there at all — a lifetime is a schedule,
not a fork. (What the row actually delivers on that promise, and why 0.05 does
not mean "5% of embers", is in the consequences below.) The two alternatives
were both worse:

- **A second ember species** (`ember` → `deep-ember` → ash, or a parallel
  "burning down" species) buys the fork by paying a roster slot and a full set
  of rows for it, and every one of those rows has to answer the creep and the
  douse again. §4 already refused a "damp char" on that ground; a second char
  is the same trade.
- **Ash off ember's own lifetime** (`becomes: 'ash'`, with the eruption as a
  row instead) inverts which outcome is the common one. Every ember would end
  as residue on a fixed schedule and open flame would become the rare
  accident, which is the wrong story: wood that chars mostly does catch.

Leaving it as a reaction row means the fork is a *neighbourhood* fact rather
than a per-cell one - an ember burns down to ash because there is open flame
beside it, which is what "the fire consumed the char" looks like from the
outside. Ember carries no tag any row keys on, so the row needs no particular
position; it sits with the other fire rows, below the tag row, because it is
not a rung of the ignition ladder.

**The row keeps the flame alive, and that is the same call as §3.** `aBecomes:
'fire'` rewrites the fire cell, and a rewrite clears `ra`, so a flame walled in
by char is renewed every time it burns a neighbour down to residue. Identical in
kind to `ember + wood` resetting the ember's countdown and to the ignition
ladder resetting fire's: something with fuel beside it goes on burning. Char is
therefore fuel *to an existing flame* while still not being `flammable` - the
tag governs ignition, this row governs consumption, and keeping the two apart is
what lets a smoldering wall neither detonate nor go out.

**Ash-to-mud is the fertility call.** `water + ash` is `water + dirt` with the
bed swapped: same shape (two cells in, one out - the water is spent), same p.
Wetting a bed of residue is the same act as wetting a bed of soil, so it gets
the same row rather than a special one, and `seed + mud -> moss` then closes the
loop with no new rows at all: forest burns → ash falls → rain wets it → it
regrows. The alternative - ash as inert grit that rain merely washes about -
leaves the world with a one-way sink in it, which is the opposite of silt's
register.

**Density 35** is what makes the loop reachable: above water (30) so a grain
sinks into a pool instead of floating on it, below mud (50) so it rests *on* a
wetted bed instead of burying itself in it, and below sand (60) and seed (40) so
neither a sandfall nor a dropped seed is stopped by a layer of it. In practice
ash in a body of water is usually wetted on the way down rather than on the
floor, which is the row doing its job - and the reason the density claim is
pinned through `canDisplace` rather than through a fall down a water-filled
shaft.

## Consequences

**A torched wall now has three acts.** Measured on a 20×13 wall with one fire
cell painted in the middle of it (seed 1), **with §6's ash branch in place**:
the fire chars its four contacts within two ticks and then stays that one cell -
it never spreads, because char is not flammable, and it does not go out either,
because the ash branch renews it (it lives to tick 133 rather than dying at 55,
which is what ticket 03 changed). Meanwhile the burn is carried by the creep: 97
of the 260 cells glow at tick 70 with 150 still wood, and the wall is entirely
charred by tick 180. Eruptions then do the rest - 33 open flames at tick 320 -
and the last ember is gone by tick 340, leaving 126 cells of ash and 126 of
smoke. The old behaviour consumed the same wall inside 70 ticks and left
nothing.

Ticket 02 measured the same wall before the branch existed: the flame died at
tick 55, the first eruption landed at 128, and the last wood was gone at 232.
The branch both feeds the flame and slows the finish, which is worth an eyeball
in ticket 04 - along with the yield, since **roughly half the wall (126 of 260
cells) ends as ash**, which is a lot of pale grey for one fire.

**Read the 0.05 carefully, because "most embers flame, some ash" is not what the
probability says.** The draw is offered every tick, and an ember glows for
120-180 of them, so an ember held against open flame for its whole life becomes
ash all but certainly - the per-contact fork is not a fork at all. What keeps
open flame the common ending is the *geometry*: the creep front runs away from
the cell that lit it, so most embers never touch a flame. The mix that falls out
of that is 48% ash on the wall above, and `p` is still the lever for it (fewer
draws land before the front moves on), but nobody should expect `p` to read as
"5% of embers". Worth Ed's eye in ticket 04 as a *feel* question - half a wall
of grey may simply be too much residue - and if the wanted story really is "an
ember beside a flame usually still erupts", that is a `p` nearer 0.001 than
0.05, not a structural change.

**Cost: a smoldering mass is awake by construction, and it shows up in the scan
count rather than in the per-cell work.** A lifetime writes `ra` every tick, so
every ember keeps its chunk dirty. `pnpm --filter silt run bench`, three runs
either side of the change:

| scenario              | before                | after                 |
| --------------------- | --------------------- | --------------------- |
| spawners + mixed world | 0.570–0.572 ms/tick, scanned 7093 | 0.571–0.582, scanned 7093 |
| reaction churn         | 0.628–0.636 ms/tick, scanned 1749 | 0.678–0.694, scanned 2184 |
| plant growth           | 0.731–0.744 ms/tick, scanned 6226 | 0.787–0.810, scanned 6226 |
| settled world          | 0.002 ms/tick, scanned 0 | 0.002, scanned 0   |

Reaction churn - the scenario with a 240-cell wood slab and two fire spawners in
it - is the honest reading: **+25% cells scanned for +8% of a tick**, because
the wood block that used to flash and vanish now sits there glowing. That is
0.68 ms against a 16.7 ms frame, so the ember is affordable at the scale the
bench pours fire at; a whole-screen wood world set alight would be the
interesting case, and ticket 04 owns that eyeball.

The other two rows are noise, not signal. The mixed world and plant growth scan
*exactly* the same cells as before (7093 and 6226), which is the tell -
`scannedLastTick` is in the bench output for precisely this reason. Plant growth
in particular has no wood, no fire and no ember in it; run alone in its own
process it measures 0.69–0.92 ms/tick with the change and 0.69–0.92 without,
which is where the in-suite 7% comes from.

**A settled world still sleeps completely**, because an ember is not a settled
cell - it is a cell with business every tick, and it says so by writing. The
settled-world row is unchanged at 0.002 ms.

**The ash branch costs scanning and nothing else.** Same bench, three runs
after §6 landed: churn 0.680–0.711 ms/tick at **scanned=3399**, against
0.678–0.694 at 2184 with the ember alone. Half again as many cells awake for no
measurable per-tick change - the extra cells are the longer-lived flames and the
ash piles that keep a chunk awake while a grain sits in a notch it cannot leave
(ADR 0039), and none of them do expensive work. The other three scenarios are
untouched, `scannedLastTick` included (7093, 6226, 0).

**Determinism is unaffected**, and no existing determinism or layout test needed
an edit. Three behavioural tests moved across the two tickets, and were
rewritten rather than loosened:

- `keeps burning while it is touching wood` asserted the wall gone in 70 ticks.
  It is now `smolders through a wall of wood rather than detonating it` and
  asserts the three acts above.
- that same test's tick-70 fire assertion moved *again* in ticket 03, from
  `count(FIRE) === 0` to `=== 1`, for the reason §6 gives: the branch renews the
  flame. Its companion `flamed` flag became a peak-fire count, since "any flame
  at all" is now satisfied for free by the cell that never went out.
- `lets lava ignite wood and survive it` counted fire; its lit condition is now
  fire *or* ember, since lava chars wood and lights oil. The lava-count
  assertion is untouched - lava is still a heat source, not a fuel.

**Scenes need no migration.** 18 and 19 are fresh pinned ids, and the scene
envelope records what each byte meant by name, so an older scene simply contains
no embers and no ash. Renaming either element later would silently empty those
cells, as for every other species.

**The ecology loop closes with no further rows.** Ash falls, `water + ash` wets
it to mud, and `seed + mud -> moss` - all of it already here - regrows what
burned. `ash.test.ts` runs that end to end (rain on an ash bed with a seed
dropped into it: first mud at tick 5, first moss at tick 12) as one loose
assertion, since every row it crosses is pinned individually elsewhere.

**Acid dissolves ash**, through the `[powder]` row at `maxHardness: 1` that ash
at hardness 0 falls under. No row of its own, and deliberate: ash is spent
material, not a building block. Pinned in `ash.test.ts` so it reads as a choice
rather than as something nobody noticed.
