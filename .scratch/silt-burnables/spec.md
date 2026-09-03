# silt-burnables - wood smolders, fuels get personalities, fire leaves ash

Today there is exactly one burning rule - `fire + flammable, p 0.4, both become
fire` (`apps/silt/src/sim/elements.ts`, row 3) - so every fuel ignites at the
same rate and wood flashes like oil. This effort gives each fuel its own
ignition character, puts a visible smolder phase between wood and open flame,
and closes a burn-to-regrowth ecology loop with an ash residue.

Agreed with Ed 2026-09-02. Everything here is data rows and two new species -
no new archetypes, no new hooks, no engine changes.

## 1. The ignition ladder (ticket 01)

The single tag row splits into per-fuel rows, each with a probability that
gives the fuel a personality. The tag row survives at the tail as the default
for future flammables ("one row covers every fuel, now and later" becomes the
fallback rather than the whole story).

| fuel    | p    | character                                          |
| ------- | ---- | -------------------------------------------------- |
| sulphur | 1.0  | flash powder - a heap chains instantly             |
| oil     | 0.9  | flashes - the burning-pool feel today, kept        |
| vine    | 0.6  | a fuse - fire races reliably along a grown line    |
| seed    | 0.3  | pops                                               |
| moss    | 0.2  | burns briskly, a mat takes visible time to consume |
| wood    | -    | never becomes fire directly - see the ember (§2)   |
| (tag)   | 0.4  | fallback for future flammables                     |

**Shipped as written.** Ticket 04's measured tuning pass left every rung of the
ladder alone, because each one tells its story: a settled sulphur heap chains
end to end in 0.2 s from one touch, a dammed 60-cell oil pool is fully alight in
0.17 s and then chars 17-22 cells of the wall it is banked against, a 59-cell
grown vine burns to the top on 10 of 10 seeds in 0.6-0.8 s, and consumption
times rank the way the rungs do (vine 0.5 s, seed 1.0 s, moss 1.5 s over the
same mat). Vine-as-fuse is a
deliberate design goal, not a side effect: vines already grow in long climbing
lines, so a reliable fast burn makes them a player-buildable way to route fire.

## 2. The ember - wood smolders (ticket 02)

New pinned species `EMBER = 18`. A static solid with glowing char shades and a
lifetime; **not** tagged flammable (it already is burning) and **not**
paintable (a reaction product, like obsidian - `PAINTABLE_IDS` untouched).

- `fire + wood, p 0.2 -> fire + ember` - wood chars instead of flashing. The
  fire-side rewrite restarts fire's countdown, exactly as the tag row does
  today: fuel keeps flame alive.
- `lava + wood, p 0.1 -> lava + ember` - lava chars wood too; it stays the
  heat source it is everywhere else.
- `ember + wood, p 0.02 -> ember + ember` - the smolder creeps through a beam
  along orthogonal contacts. The a-side rewrite resets that ember's countdown,
  which is thematic, not a bug: an ember with fuel beside it keeps smoldering;
  only once its wood is consumed does its countdown run out.
- `lifetime: { ticks: 120, jitter: 60, becomes: 'fire' }` - 2-3 s of glow at
  60 tps, then the cell erupts into open flame (which then cascades, rises,
  and dies to smoke as fire always has). 180 total is comfortably under the
  `MAX_LIFETIME_TICKS = 255` byte ceiling.
- `water + ember, p 1 -> steam + wood` - the douse. A smoldering structure can
  be saved, which is a real player verb the current instant burn never offered.
  Quenching back to *wood* (not char) keeps the roster tight; revisit only if
  it reads wrong in play.

So the story of a torched wall becomes: the contact point chars and glows, the
glow crawls, then erupts - instead of the whole wall detonating on touch.

**All four rows and the lifetime shipped as written**; ticket 04 measured each
and moved none. A 20x13 wall chars fully in 3.2 s and is spent by 5.8 s; a
hollow 60x51 cabin torched at a corner goes up section by section - left wall
4.6 s, near floor 5.4 s, mid floor 11.4 s, far floor 17.8 s, roof 17.9 s, last
ember 24.4 s. The lifetime's own reading is the eruption: first open flame at
2.5 s, inside the 2-3 s the ticks/jitter pair was chosen for. The creep is the
one value the pass considered raising, since the cabin's pace is creep-rate
times path length - and refused, because halving the crawl is halving the thing
the phase exists to show.

Byte ownership is clean: ember's lifetime countdown lives in `ra`
(engine-managed, as designed), colour variant in `rb`, static archetype so no
opinion-field conflict.

**Ordering trap (both tickets):** `resolvePairs` keeps the first registration
per pair silently, so every specific `fire + <fuel>` row must sit above the
`fire + flammable` tag row, and `lava + wood` above `lava + flammable` - the
same trap `acid + wood` already documents. Tests pin it.

## 3. The ash loop (ticket 03)

New pinned species `ASH = 19`. A pale-grey inert powder (not flammable, not
paintable), density 35 - sinks through water (30), rests on mud (50).

- `fire + ember, p 0.003 -> fire + ash` - open flame occasionally burns a
  smoldering cell straight down to residue instead of letting it erupt. This
  is the probabilistic branch `lifetime.becomes` (single-valued) cannot
  express, done as a reaction row: most embers flame, some become ash.

  **0.003, not the 0.05 this spec first wrote** - ticket 04's one retune. The
  draw is per tick over a 120-180-tick glow, so the chance an exposed ember
  ends as residue is `1 - (1 - p)^150`, not `p`: at 0.05 an ember held against
  open flame erupted on 2 of 40 seeded pockets, which inverts the sentence
  above, and roughly half of every burnt wall ended as grey. At 0.003 it erupts
  on 26 of 40, and a burnt-out copse is left under a bed of residue about a
  fifth of its own height. See ticket 04's Answer for the whole sweep.
- `water + ash, p 0.4 -> (water spent) + mud` - mirrors the existing
  `water + dirt` row shape (a-side null, water is consumed).

Which closes the ecology loop with rows that already exist: forest burns ->
ash falls -> rain wets it to mud -> `seed + mud -> moss` regrows it. Very much
silt's register: calm, cyclical.

## 4. What this deliberately does not do

- **No flammable gas element.** Ed likes the idea (a rising gas pooling under
  ceilings, chain-igniting with a whoomph) but it is explicitly deferred to a
  future effort.
- **No damp wood**, no fire-resistance states - the douse row covers the
  save-the-structure verb.
- **No fire flicker.** Fire keeps its single colour; giving it variant shades
  in `rb` is a candidate visual follow-up, not part of this effort.
- **No engine changes.** Everything is roster + reaction-table data. If a
  ticket finds it needs a hook or a new byte, that is a stop-and-rethink, not
  a workaround.

## Tickets

1. `01-ignition-ladder.md` - per-fuel ignition rows + tag fallback.
2. `02-ember.md` - the EMBER species, char/creep/erupt/douse rows, the ADR.
3. `03-ash-loop.md` - the ASH species, residue row, ash-to-mud row.
4. `04-feel-and-tuning.md` - whole-story eyeball in the dev app, probability
   tuning, bench, doc sweep.

Sequential (each blocked by the last): all four edit the same roster/table
region, and 04 tunes what 01-03 landed.
