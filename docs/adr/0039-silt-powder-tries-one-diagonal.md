# 0039 — silt: a powder tries one diagonal, not both

- **Status:** Accepted
- **Date:** 2026-08-28
- **Related:** `.scratch/silt-sandspiel/spec.md` and ticket 02
  (`.scratch/silt-sandspiel/issues/02-powder-single-diagonal.md`);
  [ADR 0028](0028-silt-simulation-engine.md) for the engine;
  [ADR 0038](0038-silt-liquids-keep-their-direction-in-ra.md), which made the
  matching change to the liquid kernel's lateral step. Implemented in
  `apps/silt/src/sim/kernels.ts`.

## Context

The powder kernel coin-flipped which diagonal to try *first*, then tried the
other:

```ts
const first = api.randInt(2) === 0 ? -1 : 1
if (api.tryMove(first, 1)) return
api.tryMove(-first, 1)
```

The coin picked the **order**, not the opportunity. A blocked grain with any
open diagonal therefore escaped on every tick — at `slide: 1`, which is what all
three powders in the roster declare, escape was certain.

Sandspiel's `update_sand` checks **one** random diagonal per tick and stops. A
grain wedged in a notch that opens only one way escapes on about half its ticks
instead of all of them. The sandspiel teardown named that stochastic stickiness
as the source of sand behaving like sand.

## Decision

### 1. The coin picks the direction, not the order

Drop the second `tryMove`. One draw, one diagonal, and a grain whose only way
out is the side the coin missed stays put and draws again next tick.

### 2. A wasted coin keeps the chunk awake

This is the part sandspiel does not need and Silt does. Sandspiel has no chunk
sleeping; Silt sleeps a chunk that nothing wrote to. A grain that declined the
only diagonal it had writes nothing, so without a guard its chunk would sleep
and the grain would sit frozen mid-notch for ever, never getting its next draw.

The fix is the shape the liquid kernel already uses for the same problem — when
the tried diagonal fails but the untried one is open, `api.keepAwake()`:

```ts
if (api.canMove(-dx, 1)) api.keepAwake()
```

The grain stays stochastic *and* stays scanned.

### 3. `slide` semantics shift, and no powder is retuned

A notch that opens on **exactly one** side is now escaped with probability
`slide × 0.5` per tick rather than `slide`. A grain with *both* diagonals open
still escapes with probability `slide`, and a grain with neither still never
does — the change only touches the one-sided case. All three powders (sand,
sulphur, mud) sit at `slide: 1` and are left there — see the measurements below,
which show the settled geometry barely moves, so there is nothing to compensate
for.

The "no `slide === 1` short-circuit" property is kept: the RNG draws this branch
takes stay a function of the world, not of tuning.

## Consequences

**The claimed payoff is smaller than the ticket predicted, and it is in the
dynamics rather than the geometry.** Two throwaway probes, sand on a dirt floor,
three to five seeds each:

| probe                                     | both diagonals | one diagonal  |
| ----------------------------------------- | -------------- | ------------- |
| free cone, 1500 grains from a point source | 38h × 77w      | 38h × 77w     |
| 9×60 column collapsing                     | 21h × 47w      | 22h × 46w     |
| …ticks until that collapse settles         | 95–100         | 208–220       |

The **steady-state angle of repose does not change at all** — a poured cone is
identical to the cell. That is not luck, and it was predictable from the change
itself. A world is settled exactly when every grain has its down cell *and* both
diagonals blocked, and that condition mentions neither the coin nor the rate: it
is the same set of configurations under both kernels. Trying one diagonal alters
how *fast* a grain with exactly one open diagonal leaves, never *whether* it
leaves. The absorbing set is untouched, so the angle it implies cannot move.

Only path-dependence can change where a pile ends up, which is precisely the
21×47 → 22×46 column result — a different route to a different member of the
same settled set. The ticket's "shallower, harder-edged piles" claim is not what
the old kernel produced.

What does change is the transient. A collapsing column takes **~2.2× as long to
settle** and ends about one cell taller and narrower. Sand avalanches as a
granular, stepped flow rather than draining like a liquid, which is the feel the
ticket was actually after.

**Cost.** Wedged grains stay awake, so an actively-pouring world scans more
cells: `pnpm --filter silt run bench` moves the mixed world from 0.492 ms/tick
(scanned 6359) to ~0.57 ms/tick (scanned 6834), reaction churn 0.627 → ~0.64
(scanned 1766 → 1832). A pouring pile probe scans ~2.5× as many cells at peak.
Plant growth and the settled world are unchanged — a *settled* pile still sleeps
completely, because a grain with both diagonals blocked writes nothing and asks
for nothing. Roughly 14% of an already-trivial tick budget, against a 16.7 ms
frame.

**Determinism is unaffected**, and no pinned layout moved — the whole silt suite
was green on the change without edits, determinism tests included. That is less
of a coincidence than it looks: `tryMove` draws no randomness of its own
(`api.ts`), so deleting the second one consumes no fewer numbers from the
stream. The only powder draws are the `slide` gate and the one coin, both still
there, and the only other consumer is the cross-chunk contention tie-break in
`DeferredMoves.resolve` — which the change can still reach indirectly, by
queueing a different set of moves for a destination to be contended over. So
same-seed-same-world holds as firmly as before, and world states happen to be
comparable across the change too, but nothing guarantees the latter.
