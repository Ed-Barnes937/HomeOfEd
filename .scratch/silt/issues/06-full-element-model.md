# 06 — Full element model: liquids, reactions, hooks

**What to build:** Close the archetype set and complete the v1 roster, per
`.scratch/sand-sim/spec.md` §4–5:

- `liquid {density, dispersion, move?}` and `gas {density, dispersion,
  move?}` motion kernels — the archetype set is now closed at four; `move` is
  per-step move probability, density orders displacement, gas density < 0
- Water (liquid) and Lava (liquid, `move: 0.15` — the "slow liquid") as pure
  config
- Tag-keyed pair-reaction table `{a, b, p, aBecomes, bBecomes, maxHardness}`;
  the one v1 row: Water + Lava → Obsidian (static, reaction-product only,
  not in the paint palette). The rule lives in the table, not element code
- Engine-managed `lifetime {ticks, jitter, becomes}` stored in `ra`, and the
  single `onTick(api)` hook running strictly **after** archetype movement.
  No v1 element uses either — prove the seams with a throwaway test-only
  element (e.g. a steam-like gas with a lifetime) in the test suite
- `ra`/`rb` ownership rules honoured: lifetime owns `ra`, colour variant owns
  `rb`

Demoable: water flows and levels, lava oozes slowly, they meet and obsidian
forms.

**Blocked by:** 03 — Sim core (headless)

**Status:** resolved

- [x] Water disperses and levels; lava moves visibly slower via move probability
- [x] Water + lava adjacency produces Obsidian via the reaction table (test at p=1 for exactness)
- [x] A test-only element exercises `lifetime` and `onTick` end-to-end; hook runs after movement
- [x] Registry validation covers reaction rows (unknown targets, bad probabilities)
- [x] `pnpm lint`, `pnpm typecheck`, silt tests green

## Comments

Resolved in commits `13e6260` + `e49dc14` (Opus agent). Closes the archetype
set: liquid/gas kernels (dispersion, `move` probability, density-ordered
displacement, gas density < 0), water + lava (`move: 0.15`) + obsidian as pure
config, tag-keyed pair-reaction table with the one v1 row (Water + Lava →
Obsidian, both cells transmute), engine-managed `lifetime` in `ra` with jitter
from the sim PRNG, and the single `onTick(api)` hook running strictly after
archetype movement — both seams proven by a throwaway test-only gas element.
Registry validation extended to reaction rows. Follow-up commit fixed a liquid
spread gate and a lifetime overflow found by code review.
**ADR 0024 — Silt simulation engine** records the cross-ticket engine
decisions (clock-guard restore pass, within-band scan order, exhaustive
archetype closure, reaction placement).
Orchestrator gate: 72 vitest + 3 CT green, lint/typecheck clean.
