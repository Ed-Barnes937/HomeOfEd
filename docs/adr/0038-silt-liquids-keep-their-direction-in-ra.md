# 0038 — silt: liquids keep their direction in `ra`

- **Status:** Accepted
- **Date:** 2026-08-28
- **Related:** `.scratch/silt-sandspiel/spec.md` and ticket 01
  (`.scratch/silt-sandspiel/issues/01-water-direction-persistence.md`);
  [ADR 0028](0028-silt-simulation-engine.md) for the engine and its
  byte-ownership rule; [ADR 0035](0035-silt-plant-growth-is-bounded-by-crowding.md)
  §3 for the first conditional claim on `ra`. Implemented in
  `apps/silt/src/sim/kernels.ts`.

## Context

The liquid kernel drew its lateral direction fresh every tick:

```ts
const along = api.randInt(2) === 0 ? -1 : 1
if (!spread(api, along, dy, spec.dispersion)) spread(api, -along, dy, spec.dispersion)
```

A coin per cell per tick, with both sides tried. Water therefore had no
*direction* at any scale larger than one cell: a body of it was a fog of
independent decisions, so puddles jittered and sloshed instead of flowing. The
sandspiel teardown named this as the largest single difference between the two
simulations.

Sandspiel's `update_water` fixes it with three stacked mechanisms, and a
throwaway prototype
(`.scratch/silt-sandspiel/prototype-water-opinion.html`, kept on branch
`silt-water-opinion-prototype`) ran both kernels side by side on one seed before
any of this was written. The prototype settled two things. The feel is better
with all three mechanisms on — that was the whole question, and it was answered
by eye. And the ticket's original "levels faster" claim is **false**: committing
to one direction halves lateral throughput against try-both-sides, and the
opinion variants crossed a dam-break levelling threshold *later* than the
baseline (tick 84/137/177 against 82). The win is coherence, not speed.

## Decision

### 1. The opinion lives in `ra`, for liquids that do not claim it

Packing, all inside the one byte:

| bits | meaning                                        |
| ---- | ---------------------------------------------- |
| 0    | direction parity — 0 is leftward, 1 rightward   |
| 1–3  | momentum counter, 0–7                          |
| 7    | seeded                                         |

`ra` belongs to the engine's `lifetime` feature, and none of the roster's five
liquids (water, lava, oil, acid, mud) declares one — so the byte is unclaimed
for all of them. This is the same carve-out moss and vine already use
([ADR 0035](0035-silt-plant-growth-is-bounded-by-crowding.md) §3), and it is now
the *second* conditional claim on `ra` rather than a one-off.

Unlike ADR 0035, this one is **enforced rather than merely documented**. The
scan hands `applyArchetype` a `raIsFree` flag — `registry.lifetimeOf(id) ===
undefined` — and a liquid that does declare a lifetime falls through to the old
coin flip. Giving a liquid a lifetime therefore costs it its currents; it does
not corrupt its countdown. A boot-time refusal was considered and rejected: the
graceful degradation is the safer failure, and refusing to boot would make
adding a decaying liquid a breaking change rather than a trade-off.

No roster liquid declares a lifetime, so that branch is unreachable from the
roster and would go unverified. `liquids.test.ts` therefore registers a
throwaway liquid that does, and pins its countdown. The case is worth the
throwaway element: on a cell's first tick `ra` is 0, which reads as "not seeded
yet" to the opinion field *and* to the countdown, so an ungated kernel writes a
parity and the cell then ages from 128 instead of 200 — confirmed by removing
the gate and watching the test fail on exactly that.

Bit 7 is what makes "0 means not seeded" work. `grid.write` clears `ra`, so a
freshly painted pour has no opinion at all and every cell must draw one, or the
whole pour would share a parity and lean. Without the marker, a cell whose
parity and momentum had both run down would read as 0 and draw again every tick.

### 2. Gases are out of scope

The gate is on the **liquid** archetype, not on `raIsFree` alone, even though
`fluid()` is one kernel run in two directions. A rising plume disperses rather
than pooling, so there is no body for an opinion to organise, and both gases in
the roster spend `ra` on a lifetime in any case.

### 3. Contagion needed one new engine affordance

`Api` exposes `ra` for the cursor cell only, deliberately. Contagion has to
write a *neighbour's* byte, so `MovementApi` — the engine-internal extension the
kernels see, which no element hook can reach — gains `raAt(dx, dy)` and
`setRaAt(dx, dy, value)`. They route through `Grid.setRa` like everything else,
so a contagion write marks the neighbour's chunk dirty; that is also what keeps
a flowing body awake.

Kept general (read and write a neighbour's byte) rather than modelled as a
`convert()` call, so the bit packing stays in the kernel that owns it. This is
the engine affordance ADR 0035 listed under "alternatives considered" and
declined at the time, arriving now for a second caller.

### 4. The stray gate comes before the seed

`lateralOpinion` returns on `isStray` before drawing anything. A lone droplet
therefore writes nothing at all, and its chunk is still free to sleep — the
property the stray gate exists for in the first place.

### 5. `canFlow` still asks about both sides

It is deliberately *not* narrowed to the cell's chosen direction. `canFlow` is
consulted only on a tick a slow liquid declined to act on, and a cell whose
parity points at a wall with its other side open does have a step available one
bump away. Narrowing it would let a chunk sleep on a puddle that has not
levelled. The sealed-pocket and mid-fall cases in `liquids.test.ts` are what pin
`canFlow` and the kernel together, and they pass unchanged.

## Consequences

- **Water reads as currents.** A pool that starts with every neighbour
  disagreeing votes itself to ~0.81 parity agreement within 100 ticks; a fresh
  pour organises from ~0.74 to ~0.86 while it is still flowing. Tests pin both
  ends of that.

- **A levelled pool now goes completely still, which it never did before.** This
  is the change's largest measured effect and it was not the point of it. Under
  the coin, a cell with a neighbour drew a fresh direction every tick and kept
  finding one of its two sides open, so an unconfined pool shuffled for ever. A
  cell that commits to one direction eventually runs out of moves and writes
  nothing, and the chunk sleeps. On the bench's `settled world` row: **0.052 →
  0.006 ms/tick, `scanned` 275 → 0**. Verified as real settling rather than lost
  simulation — the pool spreads from 71 columns to 120, conserves all 1562
  cells, and ends 13–14 deep across the whole span. `liquids.test.ts` now
  asserts `scannedLastTick === 0` where it previously allowed under 100.

- **The rest of the bench is flat to slightly better**, so the extra neighbour
  write per moving liquid cell costs nothing measurable:

  | scenario               | before | after |
  | ---------------------- | ------ | ----- |
  | spawners + mixed world | 0.549  | 0.506 |
  | reaction churn         | 0.674  | 0.633 |
  | plant growth           | 0.751  | 0.759 |
  | settled world          | 0.052  | 0.006 |

- **No exact-layout assertion moved.** The ticket expected some to, since the
  RNG stream changes shape (the seed draw and the contagion draw are new, the
  lateral order draw is gone). None did; the whole suite passed unedited apart
  from the sleep assertion above.

- **`sceneCodec` needs no change and gets none.** `ra` is already persisted, so
  a saved pool reloads with its currents intact. A scene saved before this
  change loads with `ra` zero throughout, which reads as "not seeded yet" and
  costs one draw per cell — the correct behaviour by construction, not a
  migration.

- **`ra` now has two conditional claimants.** Neither can collide with the other
  (moss and vine are static; the opinion field is liquid-only), but "`lifetime`
  owns `ra`" is now a rule with two documented exceptions rather than one. A
  third should be an argument for a second scratch byte instead.

## Alternatives considered

- **Persistence and contagion without momentum.** The ticket allowed dropping
  mechanism 3 if 1+2 read well enough, which would have freed bits 1–3. The
  prototype answered no: without momentum a cell at a wall flips every single
  tick, and the flip-flop destroys the coherence the other two mechanisms build.
  The reversal is supposed to travel back up the current as a wave, and it is
  momentum that makes that a wave rather than noise.

- **A boot-time registry refusal of any liquid with a lifetime.** Rejected — see
  §1. Graceful degradation is the safer failure and keeps the roster open.

- **A `convert(dx, dy)` method carrying the packing**, as the ticket sketched.
  Rejected: it would put the bit layout in `api.ts`, away from the kernel that
  defines it, in exchange for one method instead of two. The cost is a wider
  seam — `raAt`/`setRaAt` can read and write any neighbour's byte, where
  `convert` would have been one bounded operation. Acceptable because both stay
  off `Api`, so no element hook can reach them.

- **Extending the opinion field to gases.** Rejected as scope — see §2. It is
  additive if a pooling gas ever arrives.
