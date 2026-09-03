# 0042 - silt: wood smolders as a species, not as a heat field

- **Status:** Accepted
- **Date:** 2026-09-03
- **Related:** `.scratch/silt-burnables/spec.md` §2 and ticket 02
  (`.scratch/silt-burnables/issues/02-ember.md`);
  [ADR 0028](0028-silt-simulation-engine.md) for the engine and its byte
  ownership; [ADR 0040](0040-silt-colour-variants-in-rb.md) for the shade rule
  the new element follows; [ADR 0038](0038-silt-liquids-keep-their-direction-in-ra.md)
  for why a static element is the one that can safely own a lifetime. Implemented
  in `apps/silt/src/sim/elements.ts` (roster + rows) and
  `apps/silt/src/features/palette/paletteGroups.ts` (the comment; the rail itself
  is untouched). Ticket 03 extends this ADR with the ash branch.

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

## Consequences

**A torched wall now has three acts.** Measured on a 20×13 wall with one fire
cell painted in the middle of it (seed 1): the fire chars its four contacts
within two ticks and is dead to smoke by tick 55 - nothing re-lights it, because
char is not fuel. From there the burn lives entirely in the creep: 102 of the
260 cells glow at tick 70 with 157 still wood. The first eruption lands at tick
128, open flame then does most of the remaining work (41 fire cells at tick
200), and the last wood is gone at tick 232. The old behaviour consumed the same
wall inside 70 ticks.

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

**Determinism is unaffected**, and no existing determinism or layout test needed
an edit. Two behavioural tests did move, and were rewritten rather than
loosened:

- `keeps burning while it is touching wood` asserted the wall gone in 70 ticks.
  It is now `smolders through a wall of wood rather than detonating it` and
  asserts the three acts above.
- `lets lava ignite wood and survive it` counted fire; its lit condition is now
  fire *or* ember, since lava chars wood and lights oil. The lava-count
  assertion is untouched - lava is still a heat source, not a fuel.

**Scenes need no migration.** 18 is a fresh pinned id, and the scene envelope
records what each byte meant by name, so an older scene simply contains no
embers. Renaming the element later would silently empty those cells, as for
every other species.

**Ticket 03 extends this**: `fire + ember, p 0.05 -> fire + ash` is the
probabilistic branch a single-valued `lifetime.becomes` cannot express - most
embers flame, some burn down to residue. It needs no particular position in the
table, since ember carries no tag any row keys on.
