# 0046 - silt: a meadow's density is its flower's lifetime, not its germination rate

- **Status:** Accepted
- **Date:** 2026-09-03
- **Related:** `.scratch/silt-life-followup/spec.md` ruling 4 and §8
  ("density vs dormancy"), ticket 06
  (`.scratch/silt-life-followup/issues/06-tuning-and-scenes.md`);
  [ADR 0043](0043-silt-growers-and-products-split-the-byte.md) for the
  grower/product split that makes a crown a countable thing at all;
  [ADR 0045](0045-silt-the-water-ledger.md) §4 for the old-age hole this tuning
  was measured inside and deliberately did not close. The constants are the
  flower's and the stalk's `lifetime` in `apps/silt/src/sim/elements.ts` and
  `GERMINATE_P` in `apps/silt/src/sim/seedBank.ts`; the measurements are pinned
  in `apps/silt/src/sim/life.test.ts` under `the meadow loop`.

## Context

Ruling 4 asked for a fuller meadow: an established bed carrying ~20+ crowns
rather than the 4-16 scrub the dormancy tuning left. Both the spec (§8) and the
ticket named the knob in advance - the germination probability, which was the one
that moved the standing population most in the prototype.

Measured on the 261-cell reference bed, it is not the knob here, and the reason
is a rule the prototype did not have. **Ruling 2 reinstated plant drinking**: a
germination refunds the soil cell it grew out of as *dirt*, not mud, so every
plant costs the bed one cell of water for good. The prototype refunded mud, so
its bed was free and germination really was the throttle.

Here the bed is a budget. `dirt` is `static`, so a spent surface cell is never
re-supplied from below and a closed bed of N cells pays for exactly N plants,
however fast they arrive. That makes the standing crown count arithmetic:

```
crowns ≈ (cells spent in the window) × (how long a crown lasts) / (the window)
```

Germination sets the first term and nothing else. Raising it buys the same
meadow sooner and burns the bed out earlier - measured over three seeds, four
times the rate filled the bed to 33-41 crowns by tick 2000 and left 0-3 by
12,000, with every cell of soil dry. A meadow that flowers once and is gone.

## Decision

### 1. The flower's lifetime is the density knob

600-1200 ticks becomes **1200-2400** (`ticks: 75, jitter: 75, every: 16`). A
crown that lasts twice as long holds up twice as many crowns per cell of water,
which is the only term in that arithmetic that is not fixed by the bed.

### 2. The stem's countdown moves with it, and the ordering is the constraint

1400-1800 ticks becomes **2720-3200** (`ticks: 170, jitter: 30, every: 16`).
The number that matters is not the size but the ordering: **the stem's minimum
must clear the flower's maximum**, or a stalk crumbles under a living flower and
leaves it hanging in the air - `flower` is a `static` archetype and nothing
catches it. `registry` cannot check this (it has no idea the two are one plant),
so it is an assertion in `life.test.ts`'s boot case instead.

### 3. `GERMINATE_P` is retuned for **establishment**, not density

`0.005/4` becomes `0.008/4`. Small, and it buys the beat before the meadow
exists rather than the meadow: 20 crowns on the reference bed by 1300-2000 ticks
instead of 3300-7100.

### 4. The petal shed rate is left alone

`SHED_P` stays 0.005 a tick. What a reader sees is petals *in the air*, which is
the rate times a petal's own 80-150 ticks - not the six to twelve a flower now
gets through in a longer life. Measured on the settled bed: 9-39 petals aloft
against 30-40 crowns. A denser meadow drifting more petals is the density
showing, and correcting for it would have been a second change hiding the first.

## Consequences

- **Measured on the 261-cell reference bed**, sampled every 1000 ticks over seeds
  1-6:

  | tuning | settled band | 20 crowns by | bed dry by |
  | --- | --- | --- | --- |
  | ticket 04 (`0.005/4`, flower 600-1200) | 5-23 | 3271-7109 | 20,600-22,400 |
  | germination alone (`0.005`, flower 600-1200) | 0-41 | 955-1408 | 11,400-13,200 |
  | **this ADR** (`0.008/4`, flower 1200-2400) | **19-47** | **1325-2005** | **20,000-21,600** |

- **The drying horizon is unmoved**, which is the part worth keeping: a plant
  that lasts longer spends the bed *slower* per crown, so doubling the standing
  population cost nothing against ADR 0045 §4's number. Buying the same density
  out of germination would have halved it.
- **[ADR 0045](0045-silt-the-water-ledger.md) §4 asked this ticket whether a
  meadow should be perpetual without a match, and the answer is deferred, not
  given.** The cycle is still closed under fire and open under old age. Nothing
  here closes it - no flower-to-steam wither, no mud refund - because both
  closures cost something structural (§4 sets out which), and whether an unburnt
  bed *should* thin is a question about feel that wants a person watching it, not
  a measurement. What this pass owed it was a number, and the number is that the
  horizon did not move.
- **A burn reads differently now.** More standing fuel means a dragged torch
  leaves a single straggler on some seeds rather than clearing to nothing, so the
  burn case pins the *crown* count (at most one left) instead of total erasure -
  buffing fire to beat it is exactly the over-buffing the ticket warned off. Full
  recovery to the mass and crown count the fire found: 342-884 ticks over six
  seeds.
- **`every: 16` on both products.** `ticks + jitter` lives in one byte
  (`MAX_LIFETIME_TICKS` 255), so a 3200-tick stem does not fit at `every: 8` -
  the coarser countdown is what makes these numbers expressible at all, and its
  granularity (16 ticks) is well under the jitter it is spreading.
- **Anything that hard-codes the old numbers is now wrong**, including the
  interaction-graph doc, which reports coarse lifetimes in real ticks and has
  been regenerated.
