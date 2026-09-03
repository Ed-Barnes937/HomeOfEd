# 0043 - silt: growers and products split the byte

- **Status:** Accepted
- **Date:** 2026-09-03
- **Related:** `.scratch/silt-life-followup/spec.md` §2.1 and §7.1, ticket 02
  (`.scratch/silt-life-followup/issues/02-seed-bank.md`);
  [ADR 0028](0028-silt-simulation-engine.md) for the byte-ownership rule;
  [ADR 0035](0035-silt-plant-growth-is-bounded-by-crowding.md) §3 and
  [ADR 0038](0038-silt-liquids-keep-their-direction-in-ra.md) §1 for the first
  two conditional claims on `ra`. Implemented in `apps/silt/src/sim/seedBank.ts`
  and the roster in `apps/silt/src/sim/elements.ts`.

## Context

A cell is four bytes - `{ species, ra, rb, clock }` - and both scratch bytes are
already spoken for. `rb` is the colour variant, seeded at birth and never written
([ADR 0040](0040-silt-colour-variants-in-rb.md)). `ra` belongs to the engine's
`lifetime` feature, which seeds it on a cell's first tick and counts it down
every tick after, so **an element may use `ra` for anything of its own only if it
declares no `lifetime` at all**.

Two elements already take that carve-out: moss and vine keep a branch count there
(ADR 0035 §3), and the five liquids keep their lateral opinion there (ADR 0038
§1). ADR 0038 closed with a line this effort had to answer: "a third [claim]
should be an argument for a second scratch byte instead."

The life-above-the-waterline epic needs per-cell state on almost everything it
adds, *and* finite lives on almost everything it adds:

| wants a counter                          | wants a lifetime                     |
| ---------------------------------------- | ------------------------------------ |
| a buried seed's soak, 0-255 ticks        | a flower, 600-1200 ticks             |
| a stalk tip's travelling energy budget   | a stem left behind, then crumbling   |
| -                                        | a petal, 80-150 ticks                |

The obvious roster - "a seed that remembers how wet it is", "a stalk that grows
and then dies" - asks one byte to be two things. It cannot be. The v3 prototype
hit this from the other side as well: it wanted 600-1200-tick flowers, which is
past `MAX_LIFETIME_TICKS` (255) and needed `lifetime.every` (life ticket 01) to
fit at all.

## Decision

### 1. Every living thing is a **grower** and a **product**, as two species

The organism is split across two ids. The grower owns `ra` and never expires; the
product expires and owns nothing:

| organism | grower (owns `ra`, no lifetime)     | product (engine owns `ra`)          |
| -------- | ----------------------------------- | ----------------------------------- |
| seed     | **buried seed 20** - soak counter   | seed 15 - a falling grain, burns    |
| stalk    | stalk tip 22 - energy budget (t03)  | stalk 23 - inert stem, expires      |
| flower   | -                                   | flower 24, petal 25 - expire (t04)  |

The transition between the two is a transmutation, which the sim already does on
every reaction: a seed *becomes* a buried seed when it reaches wet soil, a tip
*becomes* stem behind itself. Nothing needs a new engine concept, and the two
halves get to differ in every other way as well - which turns out to be most of
the design rather than a side effect. Seed 15 is a flammable powder that falls;
buried seed 20 is a static solid that fire cannot touch. That is exactly what the
seed bank needs (life spec §4.1), and it comes free with the split.

### 2. The third conditional claim on `ra` is accepted, not the second byte

`ra` now has three claimants - growth's branch count, the liquid opinion field,
and the seed bank's soak counter - and the answer to ADR 0038's line is that the
rule holds because the claim is **per species**, not per archetype or per hook:

- No two claimants can ever look at the same cell. A cell is one species, and a
  species has at most one claimant; each hook reads only its own cell's `ra`
  (`Api` exposes no neighbour's - ADR 0038 §3).
- The invariant that matters is therefore "no species has two claimants", and the
  dangerous half of it is enforced rather than documented: ticket 01's
  `requireRaIsFree` throws at the call site when a hook seeds `ra` on a species
  whose `lifetime` owns it, and the liquid kernel degrades to a coin flip rather
  than corrupting a countdown.

A second scratch byte would widen every cell by 25% (60,000 cells × 4 bytes today
- and the sim runs over a `SharedArrayBuffer`, so the width is also the worker
protocol and the scene format) to buy something the split already provides. The
trade would be worth it for an element that genuinely needs a counter *and* a
finite life, and this decision is precisely the claim that no such element is
needed: a thing that dies is a product, and a product does not count.

### 3. Where the split changes the mechanics, say so at the site

The split is not free. Two consequences are load-bearing enough that the code
carries them as comments rather than leaving them to this file:

- **Burial replaced instant germination.** One reaction row per pair, and `p` is
  a rate rather than a split (life spec §2.4), so `seed + mud -> moss` at p 1
  cannot coexist with `seed + mud -> buried seed` at p 0.1. All germination now
  routes through the bank's hook, and the pinned tests that assumed the old row
  moved with it.
- **A hook cannot hand state to a cell it creates** without ticket 01's
  `set(dx, dy, species, { ra })`. Without it the travelling tip budget would have
  to swap-and-backfill - movement inside a hook, which the element model forbids.
  The grower half of a pair is therefore only implementable *because* that
  affordance landed first.

## Consequences

- **Two ids per organism**, and the roster grows faster than the number of things
  a player can name. Six of this epic's ids are three organisms.
- **A species with a claim on `ra` can never be given a `lifetime` later.** Doing
  so silently hands the byte back to the engine: growth's brake would uncap, and
  the bank's biome test would read a countdown instead of a soak. The comments at
  all three sites say so, and `life.test.ts` asserts that the buried seed
  declares no lifetime, so the trap is a failing test rather than a surprise.
- **`ra` semantics are now genuinely per-species.** A future reader cannot ask
  "what does `ra` mean" and get one answer; they have to ask which species. That
  is the cost of not widening the cell, and it is why the app's scoped
  `CLAUDE.md` lists the claimants beside the rule they are exceptions to.
- **The generated interaction graph under-reports germination.** Burial is a row
  and appears; germination writes two cells (a plant above, dirt in place) and a
  `GrowthEdge` has no shape for that, so `apps/silt/docs/interaction-graph.md`
  reports the bank's chemistry but not its hook - the same gap growth has, one
  step wider. Worth a `HookEdge` if a third hook arrives.
- **A fourth claimant is the trigger to revisit this.** Not a third one: the
  economy of the split is what buys the third, and it holds only for as long as
  every claimant is a grower that never dies.

## Alternatives considered

- **A second scratch byte** (a fifth byte per cell, or a parallel plane). What
  ADR 0038 pointed at. Rejected for now - see §2. It is additive: nothing here
  becomes harder if the byte arrives later, and every claimant would keep working
  unchanged.
- **One species that both grows and expires**, with the hook writing `ra` around
  the engine's countdown. Rejected outright: the engine writes that byte every
  tick, so the two uses do not interleave - they corrupt each other, silently and
  intermittently, which is the worst failure mode available.
- **Hook state in a side table keyed by cell index.** Rejected. It would have to
  be moved by every swap, invalidated by every write, chunked alongside the grid
  and persisted into scenes - reimplementing `ra` badly, and breaking
  determinism at the first missed invalidation.
- **A shorter soak window that fits in a nibble**, sharing the byte with a
  4-bit countdown. Rejected as false economy: bit-packing two engine features
  into one byte is the same collision with more arithmetic, and the soak window
  (120 ticks) is a tuning value ticket 06 is expected to move.
