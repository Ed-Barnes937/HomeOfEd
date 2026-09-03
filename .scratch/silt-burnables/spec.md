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

All ps are starting points; ticket 04 is the tuning pass. Vine-as-fuse is a
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

- `fire + ember, p 0.05 -> fire + ash` - open flame occasionally burns a
  smoldering cell straight down to residue instead of letting it erupt. This
  is the probabilistic branch `lifetime.becomes` (single-valued) cannot
  express, done as a reaction row: most embers flame, some become ash.
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
