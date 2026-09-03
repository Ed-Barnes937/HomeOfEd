# 04 — Petals and the closed meadow loop

**Status:** ready-for-agent
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

- [ ] A meadow left running self-seeds: population stable over a long run
      (neither extinct nor exploding — pin with a seeded soak test at the
      sim level, not wall-clock).
- [ ] Petals visibly shed and drift; some strike seeds on open mud; a pond
      beside a meadow gains floor vines on the measured timescale.
- [ ] Stuck seeds expire (no permanent seed litter on stone).
- [ ] Verify loop green.

## Context pointers

- Measured (prototype rev 2/3): offspring-per-flower self-pins at 1.0 and is
  untunable — the settled population is the real knob (ticket 06 owns it);
  petal-seeds saturate at ~15% of germinations because delivery (open ground)
  is the limit, not probability.
- Primary source: `above-water-life.html`, branch `proto/silt-life-followup`.
