# 03 — Soil: mud, and two ways to bake it

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01 (fire, smoke), 02 (stone)
**Spec:** [../spec.md](../spec.md) §3, §4 rows 10–12

**What to build:** mud `14` — one element, three rows, no new machinery.

- `water + dirt → (∅, mud)` p 0.4 — water is spent, dirt slumps
- `mud + fire → (dirt, smoke)` — fire **dries** it back
- `mud + lava → (stone, lava)` — lava **bakes** it, and lava survives

Two heat levels, two products. Row 12 gives stone a second source, so PR 02's
stone stops being purely decorative.

**Dirt, not sand.** Sand plus water is wet sand, not mud, and a lake slowly
converting a whole sand bed to ooze annoys more than it delights. Dirt is
`static`, so wetting a dirt wall makes it slump — which is the discoverable bit.

**Mud is paintable** despite being a reaction product. It is a material in its
own right, unlike obsidian.

- [ ] Pouring water on dirt makes mud and consumes the water
- [ ] Mud oozes rather than flows — `dispersion: 1`, `move: 0.1`
- [ ] Mud sinks under water; sand still sinks through mud
- [ ] Fire dries mud to dirt; lava bakes mud to stone
- [ ] Mud appears in the rail under Liquid
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green
