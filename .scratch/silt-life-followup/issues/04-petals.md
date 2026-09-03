# 04 — Petals and the closed meadow loop

**Status:** done
**Type:** task
**Blocked by:** 03
**Spec:** [../spec.md](../spec.md) §4.4, §3

**What to build:** petal `25` and the flower's death drop, closing
seed -> buried -> sprout -> stalk -> flower -> seed.

- **Petal**: powder d10, slide 1, `move ~0.25` (ticket 01), lifetime 80–150
  ticks, pastel palette. Floats on water (d10 < d30) — deliberate, petals on
  a pond are the point. Colour is NOT inherited from the parent flower (`rb`
  reseeds and nothing writes it, spec §2.5) — same palette, statistically
  identical in a crowd.
- **Death drop**: an expiring flower becomes a falling seed and spawns 3–4
  petals into adjacent empty cells. 1–2 petals measured nearly invisible —
  3–4 is the floor. Plus occasional shedding while alive (p ~0.005/tick).
- **Petal-seed strikes** (rulings 3): petal resting on mud -> seed, p ~0.01
  per contact tick; petal touching water -> seed, p ~0.001 (garnish — about
  one strike per 20k ticks; ponds are mostly colonised by seeds tumbling in,
  and that is fine). The struck seed sinks; a pond floor slowly grows vine —
  succession, on a 5k–10k tick timescale, never before the meadow itself is
  established.
- Surface seeds keep their lifetime from the prototype finding (immortal
  seeds on stone/stalks became litter that roofed the ground): seed `15`
  gains a generous coarse lifetime (~1280–2000 ticks via `every`). Check
  nothing else depends on seeds being immortal.

## Acceptance

- [x] A meadow left running self-seeds: population stable over a long run
      (neither extinct nor exploding — pin with a seeded soak test at the
      sim level, not wall-clock).
      Measured over seeds 1-8 on a 261-cell bed, sampled every 1000 ticks from
      2000 on: low 5-11 crowns, high 17-23. Pinned over seeds 1-3.
- [x] Petals visibly shed and drift; some strike seeds on open mud; a pond
      beside a meadow gains floor vines on the measured timescale.
      35-36 of 40 petals resting on mud struck; a drift of 30 on a pond struck
      4-8, and the pond floor carried 220-242 vine by 1500 ticks.
- [x] Stuck seeds expire (no permanent seed litter on stone).
- [x] Verify loop green.

## What building it turned up

- **The death drop needed an engine affordance, and the split says why.** A
  product cannot act on the tick it dies (`onTick` is gated on the cell
  surviving `applyLifetime`) and `becomes` rewrites one cell, so a flower has no
  way to leave both a seed and petals. `lifetime.emits` is that affordance,
  recorded as ADR 0043 §4 - "a thing that dies is a product, and a product does
  not act" is the same decision seen from its far end. Two alternatives are
  recorded as rejected there; the second looks correct and is not, because a
  coarse countdown holds `ra` at 1 for up to `every` ticks, so a hook firing on
  `ra === 1` would drop eight broods instead of one.
- **A closed dry bed dies of thirst, and that is ruling 2 rather than a bug.**
  Germination refunds its soil cell as *dirt* (plant drinking, reinstated), so
  every generation spends a cell of the bed's water: a 261-cell bed carries a
  meadow past 12,000 ticks and then thins, gone by 20,000-30,000. The prototype
  refunded mud and never met this. So the soak test pins a horizon rather than
  perpetuity, and a second case pins the ledger (mud + bank + dirt constant, and
  only ever moving one way) so ticket 05's water cycle has a number to beat.
- **The petal-water strike really is garnish.** 30 petals on a pond strike 4-8
  times, enough to colonise a floor - but only because the drift is 30. A single
  petal is a coin a test would lose, which is ruling 3 arriving as a measurement.

## Context pointers

- Measured (prototype rev 2/3): offspring-per-flower self-pins at 1.0 and is
  untunable — the settled population is the real knob (ticket 06 owns it);
  petal-seeds saturate at ~15% of germinations because delivery (open ground)
  is the limit, not probability.
- Primary source: `above-water-life.html`, branch `proto/silt-life-followup`.
