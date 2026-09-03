# 03 — Sprout, stalk tip, stalk, flower

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 02
**Spec:** [../spec.md](../spec.md) §4.3, §2.1, §2.2, §2.5, §3

**What to build:** the land plant: sprout `21`, stalk tip `22`, stalk `23`,
flower `24`. The travelling-budget hook is the risky half — split it into its
own commit as the materials epic did with growth.

- **Sprout** (land moss): static, flammable, no lifetime. Its hook raises a
  stalk tip above it when there is empty air; it NEVER grows into water — a
  droplet against a sprout is inert. Sprouting is the moment the soil is
  charged (ticket 02 already refunds dirt at germination; make sure the
  charge happens exactly once between the two — the prototype charges at the
  germination/sprout boundary, follow it).
- **Stalk tip** (the grower): no lifetime; `ra` is the energy budget, seeded
  ~6–10 jittered at birth. Each tick, p ~0.3: `set` the cell above as the
  new tip with `{ ra: budget - 1 }` (ticket 01), `become` stalk behind. At
  budget 0, `become` flower. Keep-awake: like growth, the tip writes every
  tick it still has a candidate; a boxed-in tip must terminate (become
  flower early rather than spin forever — decide and test).
- **Stalk** (the product): static, flammable, long coarse lifetime
  (`lifetime.every`), crumbles to nothing. Without this the meadow silts up
  with immortal dead columns — the prototype's single most important finding.
- **Flower**: static, flammable, 8 pastel colours (`rb & 7` variety is free,
  ADR 0040), `lifetime` 600–1200 ticks via `every`. Death drop wired in
  ticket 04 (until then, expiring to nothing is fine).
- All four are corrodible and burnable for free via existing tag rows;
  ignition personalities come from the burnables ladder (05 adjusts
  flower/sprout to steam).
- **Not paintable** (ruling 6): none of these join `PAINTABLE_IDS`. They are
  reaction/hook products like moss and vine.

## Acceptance

- [ ] A buried seed under open air becomes sprout -> climbing tip -> inert
      stalk column -> flower, with heights varying by the seeded budget.
- [ ] Tip budget travels: a mid-climb tip cell holds exactly
      initial - height in `ra` (unit test through the Api, not pixels).
- [ ] Spent plants disappear: after flower + stalk lifetimes, the column is
      gone and the soil below is dirt (drunk) — the bed can host a successor.
- [ ] Water against a sprout/stalk/flower changes nothing (land plants are
      splash-immune).
- [ ] iwft: paint seed on a wet bed, run, a flower blooms (state-through-UI
      per the pragmatic test split; unit tests carry the layer below).
- [ ] ADR: grower/product split (spec §7.1) if 02 didn't write it.
- [ ] Verify loop green.

## Context pointers

- Primary source: `above-water-life.html` (branch `proto/silt-life-followup`)
  — TIP/STALK/SPROUT/FLOWER rules and the pacing that read well (climb p 0.3:
  6–10 cells in 20–35 ticks).
