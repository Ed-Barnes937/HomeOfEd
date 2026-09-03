# 05 — The water cycle: evaporation, quench, wet biomass, ash regrowth

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 02, burnables epic merge (ash 19 and the ignition ladder)
**Spec:** [../spec.md](../spec.md) §4.5, §2.7, §6, §7.2, §7.3

**What to build:** the sinks and returns that make water circulate instead of
standing. Every rule transmutes; none deletes (spec §7.3).

- **Thin-film evaporation** (ruling 1 — Ed's explicit choice over the
  measured shallow-pool variant, see spec §6): a WATER cell with open air
  above and a non-water cell below may become steam, coarse probability
  tuned so a film clears in ~300–800 ticks. **The humidity brake is
  deliberate and load-bearing**: steam directly above blocks evaporation.
  Level pools 2+ deep and ponds are immortal — by design.
  - **The risky half is keep-awake**: settled water sleeps, so a film under
    a sleeping chunk never evaporates. Growth solved this with a disguised
    `ra` write, but water's `ra` is the liquid opinion field (ADR 0038) —
    do NOT collide with its bits. Spec §8 says: if this is the third hook
    needing keep-awake, promote a real `keepAwake` on `Api` instead of a
    third disguised write. That is likely the right move here — decide with
    a measurement, record it in the evaporation ADR.
- **Quench**: `fire + mud -> steam + dirt` — fire touching wet soil dies
  into steam and dries one cell. Fire spreads through plants, never along
  the ground, and the bank below survives (ticket 02's guarantee).
- **Wet biomass steams** (spec §2.4 — the engine cannot do probability
  splits, so this is per-species): stalk and stem keep their burnables-ladder
  ignition rows (become fire); flower and sprout rows become STEAM instead —
  dry parts burn, wet parts return their water to the sky. This deviates
  from the prototype's split-based rule deliberately; validate the burn
  still propagates through a meadow (the prototype found single sparks die
  on 1-cell stems — a dragged torch or an ember reaching the stalk is the
  expected ignition story, don't over-buff).
- **Ash regrowth** (burnables owns `ash + water -> mud`): verify end to end
  that a burnt bed under its own rain re-wets and the bank regrows it.

## Acceptance

- [ ] A film on saturated ground clears in the target window; a stone pond
      and a level 2-deep pool are volume-stable over a long seeded run.
- [ ] Conservation soak test: free water + steam + mud (+ biomass proxy)
      constant through pour/burn/rain cycles on a closed scene.
- [ ] Torch a meadow: steam plume, rain, ash washed to mud, bank germinates
      into the clearing — recovery on the order of 500–3000 ticks.
- [ ] Chunks under a finished (dry or fully wet) bed sleep — no permanent
      keep-awake (measure, don't assume).
- [ ] ADRs: thin-film evaporation recording the any-surface trap and the
      declined shallow-pool numbers (spec §7.2); the water ledger (§7.3).
- [ ] Verify loop green.

## Context pointers

- Measured (evaporation prototype, 4 seeds): thin film — poured 13-cell
  puddle clears 644–864 ticks, pond exactly stable over 60k, ledger drift 0;
  any-surface — puddle NEVER clears (it manufactures its own rain, ~40% of
  water aloft), pond half-life ~1000 ticks. Chosen `evapP` 0.03 every 4.
- Primary source: `evaporation.html`, branch `proto/silt-life-followup` —
  all three rule variants behind a toggle, with the conservation ledger.
