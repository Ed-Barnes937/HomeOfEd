# 0044 - silt: only a thin film evaporates, and its own plume brakes it

- **Status:** Accepted
- **Date:** 2026-09-03
- **Related:** `.scratch/silt-life-followup/spec.md` ruling 1, §4.5, §6 and §8,
  ticket 05 (`.scratch/silt-life-followup/issues/05-water-cycle.md`);
  [ADR 0038](0038-silt-liquids-keep-their-direction-in-ra.md) for the liquid
  opinion field this hook may not touch;
  [ADR 0043](0043-silt-growers-and-products-split-the-byte.md) for the three
  hooks that solved keep-awake by writing a byte they owned;
  [ADR 0045](0045-silt-the-water-ledger.md) for the conservation rule this hook
  is the largest single user of. Implemented in
  `apps/silt/src/sim/evaporation.ts`, with the roster in
  `apps/silt/src/sim/elements.ts` and the promoted affordance in
  `apps/silt/src/sim/types.ts`.
- **Primary source:** the throwaway prototype
  `.scratch/silt-life-followup/prototype/evaporation.html` on branch
  `proto/silt-life-followup`, which carries all three candidate rules behind a
  toggle and a live conservation ledger.

## Context

Water that lands on ground already saturated has nowhere to go. `water + mud` is
not a reaction - mud is wet dirt, and there is no "wetter" - so a puddle poured
on a bed the rain has already soaked stands there for the rest of the run. It is
the single most obvious dead spot in the world, and the epic that grows meadows
on mud makes it worse: every bed is saturated most of the time.

Evaporation is the obvious drain, and the risk is equally obvious. A rule that
dries puddles can quietly drink every pond in the world, and standing water is
something a person is meant to be able to *make*. The prototype therefore built
three candidate rules rather than one, ran them from the same seeds on the same
scene - a nine-deep pond, a pool standing dead level at two, a saturated bed and
a dry one - and measured all three over 60,000 ticks with a ledger totalling free
water, water aloft and water in the soil.

Two further constraints came with the ground rather than with the rule:

- **`ra` is not available.** The hook lives on *water*, and water's `ra` is the
  liquid kernel's opinion field - lateral direction, momentum and the seeded
  marker (ADR 0038). The three hooks before this one each held their chunk awake
  by rewriting a byte they already owned (growth's branch count, the bank's soak,
  the tip's budget). This one has nothing to rewrite, and writing anyway would
  steer the liquid rather than wake it.
- **Settled water writes nothing.** Chunk sleeping is driven by writes, so a film
  under a chunk that has gone quiet is never offered a draw again. Keep-awake is
  not a detail of this hook; it is the half that decides whether it works at all.

## Decision

### 1. Only a **thin film** evaporates

A water cell becomes steam when there is open air directly above it **and
something other than water directly below it**. Everything else is refused.

That makes a level pool two cells deep permanent: its floor has water above it
and its surface has water below it, so no cell of it is a film anywhere. A pond
is the same argument with more cells. **This is the ruling, not a shortcut** -
standing water is a feature, and a rule that drained a two-deep pool would take
it away.

The line has to fall somewhere and one cell down is where `CHUNK_MARGIN` puts it
for free.

### 2. The humidity brake: steam counts as "not open air"

Steam directly above a film blocks the draw. There is no humidity field anywhere
and nothing tracks one - **the plume is the field**. Without it a wide sheet
under its own cloud evaporates exactly as fast as an isolated droplet, which is
both wrong to watch and the mechanism by which the rejected any-surface rule
turns the world into a rain machine (§5).

A braked film takes **no keep-awake**. The roof is either static, in which case
the cell genuinely has no business next tick, or it is a gas, in which case it
writes every tick it drifts and wakes the cell underneath it.

### 3. `keepAwake` is promoted from `MovementApi` onto `Api`

Life spec §8 named this in advance: *"if a third hook needs it, promote a real
`keepAwake` on `Api` instead of a third disguised write"*. It is the fourth, and
the trigger fired for the reason the rule gives rather than because of the count -
this hook has **no byte of its own to disguise a write in**, and the byte it
would have to borrow is enforced state belonging to something else.

The change is one line of interface: the declaration moves up from `MovementApi`
to `Api`, and `CellApi` already implemented it for the motion kernels.

**Measured**, since the spec asked for a measurement rather than an assumption:

| scene, 8000 ticks              | `scannedLastTick` | water   |
| ------------------------------ | ----------------- | ------- |
| nine-deep pond + level 2-deep pool | **0**         | 251 → 251 |
| saturated bed, no free water   | **0**             | -       |
| dry bed                        | **0**             | -       |
| bed under a lone film          | awake until it lifts, then quiet | 1 → 0 in 3-281 ticks (8 seeds) |

The affordance is used on exactly one branch - a film that made its draw and
missed - so it is self-terminating in the way the spec requires: the writes stop
the moment the film lifts, is roofed, or is buried under more water. The mirror
is what the table's first three rows show: a pond surface is not a film, takes no
keep-awake, and costs a world at rest nothing at all.

The disguised-write alternative was not weighed and rejected on taste. It was
**unavailable**: `applyArchetype` is handed a `raIsFree` flag and water passes it,
so a hook writing `ra` there would be writing the live opinion field.

### 4. The rate: 0.03 every four ticks, spelled as one draw a tick

The prototype drew p 0.03 once every four ticks - the coarse form `lifetime.every`
uses - and a hook cannot see the world's tick, so the pair collapses to
`EVAPORATE_P = 0.03 / 4` drawn every tick at the same effective rate. The seed
bank's `GERMINATE_P` is spelled the same way and for the same reason.

**The rate is tuned against the puddle a person pours, not against one cell.** A
brush-sized puddle is about thirteen cells and the last of them to go is the
slowest of thirteen independent draws - roughly three times the mean - so a rate
that clears *one* cell in the spec's 300-800 ticks leaves the poured puddle
standing for 900-2700. At this rate a lone film cell lasts 3-281 ticks over eight
seeds and a poured puddle is off the bed in 195-1659.

### 5. **A fall is not a film** - the one deviation from the prototype

The prototype lifted any water with open air above it, whatever was below;
"non-water below" was only how it separated film from pool. On this grid that
also hands a *falling* droplet a draw every tick of its fall, and the grid is 200
cells tall. A hundred-cell fall loses `1 - (1 - p)^100`, about half - and the
half that lifts rises, condenses and falls again.

Measured over three seeds, 200 droplets released 100 cells above a dry bed, read
at 400 ticks:

| below-is-air | landed as mud | still aloft |
| ------------ | ------------- | ----------- |
| allowed (the prototype's rule) | 87-107 | 55-74 |
| refused (shipped)              | **179-183** | 3-9 |

Half a burn's plume never coming back down is the any-surface trap (§5 below) in
miniature: the rule meant to dry standing water manufacturing permanent cloud
instead. So the cell below must be neither water **nor empty** - a film rests on
something. The prototype's scenes were small and static enough never to meet it.

## Alternatives measured and declined

- **Shallow pool** - a film, *or* the surface of a level two-deep pool (read one
  cell further down). It measures better on paper: the two-deep pool drains in
  **268-468** ticks against never, and poured puddles cleared faster on three
  seeds of four, with the pond exactly stable at 117 cells out to 60,000 ticks.
  **Declined on feel** (ruling 1): standing water is a thing you can make, and
  this rule takes it away. The numbers are here rather than in the prototype only
  so the alternative is not re-litigated blind. It cannot drain a three-deep
  puddle either, because at that depth it cannot tell one from a pond - and by
  design should not.
- **Any surface** - all water with air above it, whatever is below. This is the
  intuitive rule and it is a **recorded trap**: it does not merely kill ponds
  (half-life 1000-1250 ticks, settling to a permanent remnant of about ten
  cells), it *fails at its own job*. The poured puddle never cleared in 12,000+
  ticks on three of four seeds, because everything that lifts condenses and rains
  straight back, leaving about 40% of the world's water permanently aloft. The
  rule proposed to dry standing water instead guarantees it. §5 above is the same
  failure caught one step earlier.
- **Ambient weather** - an undisturbed pond emitting the odd cell of steam. Out
  of scope deliberately (spec §6): under thin film a pond emits nothing, plumes
  and rain come from fire, and silt stays calm until it is provoked.
- **Moisture wicking and permeability** - rejected outright in the spec: they
  break conservation ("1 water = >1 mud") and wicking soil holds chunks awake for
  ever to solve a transport problem a 2-4 cell bed does not have.

## Consequences

- **Ponds and level pools are permanent and asleep.** 251 cells of water,
  unchanged over 8000 ticks, with `scannedLastTick` at zero.
- **A finished bed sleeps either way round** - dry or saturated - because a bed
  with no free water on it has no film and the hook writes nothing.
- **Free water over ground that cannot absorb it is permanent light weather.**
  A puddle on impermeable stone lifts, rains, lands and lifts again; measured in
  a sealed box with a half-dry bed, five of thirteen poured cells soaked in and
  the rest were still cycling at 40,000 ticks. That world never sleeps, and it is
  the honest consequence of a drain with nowhere to drain *to*. Over soil it
  terminates, because `water + dirt -> mud` is a sink.
- **Water is the first element carrying a hook without claiming a byte**, which
  is what promoting `keepAwake` bought. The byte-ownership rule is unchanged and
  still has exactly four conditional claimants (ADR 0043).
- **`liquids.test.ts` moved two cases from water to oil.** A one-cell-deep sheet
  of water on open ground is no longer a resting state, so "spreads sideways" and
  "flattens to one layer and lets the world go quiet" - both claims about the
  *kernel* (ADR 0038) - now use the roster's other plain liquid, at doubled tick
  budgets for its `move` throttle. A third case gained a lid, which keeps the
  hook from drawing at all and leaves the PRNG stream under it untouched.
- **Every water cell with a clear sky and solid ground now draws once a tick.**
  The two structural reads come first, so a pond, a roofed film and a falling
  droplet all cost two grid reads and no draw.
