# 02 — Seed bank and biome commitment

**Status:** done
**Type:** task
**Blocked by:** 01, burnables epic merge (ids 18/19 must be pinned first)
**Spec:** [../spec.md](../spec.md) §4.1, §4.2, §2.1, §2.4

**What to build:** buried seed `20`, the burial row, dormant germination, and
the one-shot biome decision. This ticket changes how ALL germination works.

- **Burial replaces instant germination.** Delete the `seed + mud -> moss`
  row; add `seed + mud -> buried seed + <consumed>` (p ~0.1 per contact tick;
  the seed sinks into the soil cell — the mud cell becomes the buried seed).
  One row per pair means the two rows cannot coexist (spec §2.4) — say so at
  the site.
- **Buried seed** (spec §3): static, `solid`, NOT flammable (the bank must
  survive fire — that is its whole job), no lifetime. `ra` is its soak
  counter — document the ownership as growth.ts does.
- **Dormancy and germination** (onTick): roofed by anything solid — wait.
  Open above — germinate with low coarse probability (~0.005 effective).
  Biome commitment happens here, ONCE (spec §4.2): aquatic requires **depth
  AND soak** — 2 cells of water above and ~120 continuous soaked ticks in
  `ra` — then germinate to moss `16` (existing aquatic rules take over).
  Open air above — germinate to sprout `21` (built in ticket 03; until then
  land germination can no-op behind a constant, or sequence the tickets in
  one branch — implementer's call, but keep the commits split).
- Germination refunds the soil cell **as dirt, not mud** — the plant drank
  the moisture (ruling 2, spec §4.3). The bed's ledger becomes
  bank + mud + dirt.
- Hook discipline: self-terminating (a dormant roofed seed writes nothing
  and sleeps), margin ≤ 2 (the depth test reads exactly 2 up — that is the
  whole margin, note it as growth.ts does).

## Acceptance

- [x] Seeds on wet soil bury, then sprout after dormancy; nothing germinates
      instantly any more (update the pinned tests in `life.test.ts` that
      assume `seed + mud -> moss` at p 1). Land germination is one `null`
      away - ticket 03 passes sprout 21 to `createSeedBank`; the aquatic half
      is live end to end.
- [x] A droplet resting on a buried seed for < soak window does NOT commit
      aquatic; a 2-deep soak for the window does (both directions tested).
- [x] Fire swept over a bed leaves the bank intact (buried seeds not
      flammable, count unchanged through a burn).
- [x] Bank self-caps: long-run bank + mud + dirt is constant for a closed bed.
- [x] Verify loop green (`pnpm --filter silt run test`, lint, typecheck) -
      apart from the 4 stale `interactionGraph.test.ts` expectations that are
      red on `main` (regen PR #124). The checked-in graph doc was regenerated,
      so the drift check itself is green.
- [x] ADR: the grower/product split (spec §7.1) - [ADR
      0043](../../../docs/adr/0043-silt-growers-and-products-split-the-byte.md).

## Context pointers

- Prototype rev 3 report measured: burn recovery 500–3000 ticks, bank 15–28
  cells steady on a 100-cell bed, `bank + mud = 100` exactly at every sample.
  Rain vs flood after depth+soak: 2 vs 662 vines.
- Primary source: `above-water-life.html` pure module (branch
  `proto/silt-life-followup`) — BURIED species, burial/germination rules.
