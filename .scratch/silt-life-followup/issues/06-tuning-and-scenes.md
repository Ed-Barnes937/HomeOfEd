# 06 — Tuning pass and scenes

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 03, 04, 05
**Spec:** [../spec.md](../spec.md) §5, §8, ruling 4

**What to build:** measured tuning against the agreed targets, plus the scene
and UX sweep. Tune by measurement (headless seeded runs), not by eye alone —
the sandspiel epic's lesson (a premise refuted by measurement) applies.

- **Density** (ruling 4): an established bed should carry ~20+ crowns, not
  the 4–16 scrub that v3's dormancy produced. Germination probability is the
  knob that moved it most; measure the settled population, not
  offspring-per-flower (self-pins at 1.0, untunable).
- **Burn and recovery feel**: full-meadow recovery in the 500–3000 tick
  window; a dragged torch clears a meadow, a single spark need not (spec
  §4.5 — don't over-buff single-spark fires).
- **Pacing sanity**: climb speed (~20–35 ticks to bloom), flower life,
  petal shed rate — the prototype's values are the starting point; adjust
  against the real renderer at 60 fps.
- **Scenes**: pre-age plants via `set`-carries-`ra` so pre-grown meadows
  don't die as one synchronised cohort (prototype finding). Remember: earth
  basins do not hold water — dirt wets to mud and mud is a liquid, so any
  scene pond must be stone-lined and stone-floored.
- **Fire brush check** (spec §8): confirm whether the real app's brush
  painting fire over terrain replaces the ground (and would silently destroy
  a seed bank). If it does, guard it: fire ignites what stands on the
  ground, it does not excavate. Small, but it will otherwise read as "the
  bank doesn't work".
- **Docs sweep**: apps/silt CLAUDE.md byte-ownership bullet (buried seed's
  `ra`, tip's `ra`), README/CONTEXT if the roster tables live there, ADR
  cross-links, and the discovery-tree interaction graph gains the new
  elements (they are discovered, not painted — ruling 6).

## Acceptance

- [ ] Settled population ≥ 20 crowns on the reference bed across 3 seeds.
- [ ] Burn/recover cycle inside the target window across 3 seeds.
- [ ] No new paintable ids; mobile iwft's eleven-name rail assertion
      untouched.
- [ ] All tuning changes carry a one-line measured justification in the
      commit message.
- [ ] Verify loop green.
