# 0035 — silt: plant growth is a hook, bounded by crowding

- **Status:** Accepted
- **Date:** 2026-08-25
- **Related:** `.scratch/silt-materials/spec.md` §5 (growth) and the roster in
  §3; [ADR 0028](0028-silt-simulation-engine.md) for the engine this leans on.
  Implemented in silt materials stage 04 (`apps/silt/src/sim/growth.ts`).

## Context

The materials expansion adds seed, moss and vine. Sprouting is a reaction row —
`seed + mud → (moss, mud)` — but *growing* is not, and the roster needed a
decision on how a plant spreads, plus a second decision on what stops it.

Two facts about the reaction table forced the first choice. A reaction row has
**no direction**: the table is symmetric and the scan reaches either cell first,
so `moss + water → (moss, vine)` grows outward in every direction equally and
produces a blob rather than a vine. And a row has **no brake**: `p` is a rate,
not a budget (spec §1.1), so a plant in a lake converts the whole lake and
lowering `p` only decides how long that takes.

So growth became the codebase's first `onTick` hook. That bought direction
immediately — take the water above before the water beside it — but the brake
was harder, and the first version shipped without one.

The `BRANCH_BUDGET` counter in that version does not bound anything. `api.set`
clears the target cell's scratch bytes, so every newly grown vine starts on a
fresh budget; the counter caps **one cell's fan-out** and nothing more. A hook
cannot seed a child cell's `ra`, so this is not fixable in the hook. A sealed
pool converted entirely in about 600 ticks, which is both wrong as a toy — the
water disappears — and wrong as a picture, since a solid mass of vine reads as
algae.

## Decision

### 1. Growth is a hook, not a reaction row

`growth.ts` owns it, shared by moss and vine, and it is the only `onTick` in the
roster. Ids are passed into `createGrowth` rather than imported, so the module
does not depend on the roster and there is no cycle back through `elements.ts`.

The hook takes the **first eligible water neighbour** in a fixed order — up,
then left, then right — as its single candidate, and gives that candidate one
draw per tick. It deliberately does *not* fall through to the sides when the
draw fails: doing so was tried, and it leaves a submerged plant growing upward
barely a third of the time, which is the blob again.

There is no downward step, so a plant standing on a pool grows out of it rather
than boring into it.

### 2. A cell is refused if two plant cells already touch it

`MAX_PLANT_NEIGHBOURS = 1`. The parent is always one of the four orthogonal
neighbours, so one means "nothing adjacent but the plant it grows from".

This is the brake, and it is structural rather than probabilistic. Every new
cell attaches to exactly one existing plant cell, which makes the plant an
**induced forest** in the grid graph: no cycle can close, and no two strands can
run alongside each other. In particular **no 2×2 block of plant can ever form** —
place three of its corners and the fourth permanently touches two plants. A
snake cannot fold back beside itself for the same reason.

So a sealed pool cannot convert. Measured over seeds 1–12 on a 210-cell pool,
vine saturates at 110–123 cells and 86–99 cells of water survive — a little over
half, and it settles rather than creeping on. Zero 2×2 blocks at any tick.

Three sub-choices inside this:

- **Orthogonal neighbours only**, matching the reach. Counting the diagonals as
  well forbids strands from running diagonally past each other, which is most of
  the room growth has, and a plant then stalls after a few cells.
- **Crowding is an eligibility test, not a failed draw.** A crowded candidate is
  skipped and the next offset is tried, so a plant blocked above still branches
  sideways. This is safe where falling through on a failed draw is not, because
  the filter is deterministic — it cannot bias the direction preference.
- **A blocked candidate costs nothing.** No water is consumed and no branch
  spent. Draining a pool without growing is worse behaviour than not growing,
  and it would break the one-cell-of-water-per-cell-of-growth invariant, which
  is worth being able to assert.

`BRANCH_BUDGET` is kept, but only for what it actually does: a per-cell,
per-lifetime rate limit, so a plant creeps rather than fanning out of one cell.

### 3. The branch counter lives in `ra`, conditionally

Moss and vine declare no `lifetime`, so nothing else claims `ra` and the hook
uses it as its branch count. This is the one documented exception to the
byte-ownership rule in [ADR 0028](0028-silt-simulation-engine.md), and it holds
only while those two elements stay lifetime-free — giving either one a lifetime
hands the byte back to the engine and silently uncaps the fan-out. There is a
comment saying so at the site.

### 4. The hook writes `ra` every tick it can still act

`Api` has no `keepAwake` — it is on the engine-internal `MovementApi` — so a
hook that must go on being offered a draw has to write something, because
writing is what marks a chunk dirty. Settled water writes nothing at all, so
without this a plant in a still pond gets two or three draws and then sleeps
for good.

The write stops as soon as the budget is spent or every candidate is dry or
crowded, so a finished plant lets its chunk sleep. Crowding only ever increases
on its own, and anything that *decreases* it — fire, acid, painting — is a write
that wakes the chunk itself.

## Consequences

- Plants read as vine: separated strands with water between them, climbing.
- A pool is no longer consumed, and the bound is provable rather than tuned.
  The tests pin both halves — the survival of water in a sealed pool, and the
  no-2×2 invariant checked on every tick.
- **`CHUNK_MARGIN` is now fully spent.** The crowding check reads two cells from
  the plant, since the candidate is one away and the check looks one past it.
  Two is the margin, and it is exactly enough — `Chunks.touch` wakes every chunk
  within two cells of any write, so a plant blocked today is woken when the cell
  blocking it burns or dissolves. But there is no slack left: a hook that needs
  a third cell needs `CHUNK_MARGIN` raised in the same change, and raising it
  makes the world sleep less.
- Growth cannot be expressed in the reaction table, so the roster is no longer
  pure config. That is the point of the archetype/hook split, but it does mean
  "elements are data" now has exactly one exception, and a second hook should be
  argued for rather than assumed.

## Alternatives considered

- **Require plants to be rooted against something solid.** Bounds growth, but by
  geometry the player cannot see, and it makes a plant in open water impossible
  rather than merely limited.
- **An engine affordance letting a hook seed a child cell's scratch bytes.** This
  would make `BRANCH_BUDGET` a real global bound, and it is the more general
  fix. Rejected for now as a change to `Api` in service of one element; the
  crowding rule needs no engine change and gives a better-looking result. Worth
  revisiting if a second hook wants the same thing.
- **Lowering `GROWTH_P`.** Does not bound anything, only slows the same outcome
  down. Rejected on the same grounds the reaction-row version was.
