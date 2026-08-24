# 01 — Fire: wood, oil, fire, smoke, steam

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §3, §4 rows 1–4

**What to build:** the fire group — five elements and four reaction rows, all
config in `apps/silt/src/sim/elements.ts`. First use of the `gas` archetype and
of engine-managed `lifetime`, both of which are built and tested but unused.

Elements (spec §3): wood `6`, oil `7`, fire `8`, smoke `9`, steam `10`.
Rows, in order (spec §4): 1 `water+lava → steam+obsidian`,
2 `water+fire → steam+smoke`, 3 `fire+[flammable] → fire+fire`,
4 `lava+[flammable] → lava+fire`.

**The three things that are easy to get wrong:**

- **Gas densities are counter-intuitive.** `canDisplace` is `mine > theirs` and
  is not direction-aware, so the gas *closest to zero* rises highest. smoke −5,
  steam −10, fire −20. Backwards, and fire sits on top of its own smoke.
- **Row 3 rewriting fire is correct, not a bug.** `become` clears `ra`, so fire
  touching fuel restarts its countdown — it burns while fuel lasts, then dies to
  smoke. Do not "fix" this.
- **Row 1 changes shipped v1 behaviour** (was obsidian + obsidian). Deliberate.
  The existing test pinning it needs updating, not working around.

**Paintable:** wood, oil, fire. Not smoke or steam. Fire is what makes the
**Energy** rail group render for the first time — check it actually appears.

- [ ] Five elements registered with pinned ids; registry boot validation passes
- [ ] A gas rises; smoke ends up above fire, verified in a sim test
- [ ] Fire next to wood keeps burning; fire alone dies to smoke, and smoke to nothing
- [ ] Steam expires back to water — the cycle closes
- [ ] Oil floats on water; lava ignites both wood and oil
- [ ] Water poured on fire puts it out and yields steam
- [ ] The Energy group renders in the rail, on desktop and mobile
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green
