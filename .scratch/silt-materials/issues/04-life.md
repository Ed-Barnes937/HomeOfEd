# 04 — Life: seed, moss, vine

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 03 (mud)
**Spec:** [../spec.md](../spec.md) §3, §4 row 13, §5

**What to build:** seed `15`, moss `16`, vine `17`, one reaction row, and the
**first `onTick` hook in the codebase**. Split the hook into its own commit from
the elements — it is the risky half.

Sprouting is a reaction: `seed + mud → (moss, mud)`. The seed is consumed, the
soil is not.

**Growth is a hook, not a reaction.** The pure-reaction version
(`moss + water → (moss, vine)` — the water cell that lands on the plant becomes
the plant) works and needs no hook, but has no direction (it grows a blob, not a
vine) and no brake (a vine in a lake turns the lake into vine; lowering `p` only
slows it). Both were rejected deliberately — see spec §5.

The hook, shared by moss and vine:

- inspect orthogonal neighbours, **up first**, then the sides
- if one is water, and `rand() < p`, and `ra < BRANCH_BUDGET`:
  `set(neighbour, vine)`, `ra++`

Water is the resource and the real limiter. `ra` caps branching per cell.

**`ra` ownership needs a comment.** The spec's rule is that the engine's
`lifetime` feature owns `ra`. Moss and vine have no lifetime, so nothing is
claiming it and the hook may use it. This is the first use of `ra` outside the
engine — say so at the site, or someone will read it as a violation.

**Corrodible for free.** Hardness 0 plus the `solid`/`powder` tags means PR 02's
rows 6–7 already dissolve all three. No new rows, no `[corrodible]` tag. And
they are `flammable`, so PR 01's row 3 already burns them.

**Paintable:** seed only. Moss and vine are the reward.

**The rail hits its design ceiling here** — 11 paintable elements against a rail
`paletteGroups.ts` says was "built for a roster that will triple" (12). Check it
on mobile rather than assuming.

- [ ] A seed landing on mud sprouts moss; the mud survives
- [ ] Seed sinks through water and rests *on* mud (density 40) rather than burying itself
- [ ] Vines grow **upward** by preference — pinned by a test, not by eye
- [ ] Growth consumes water, and `BRANCH_BUDGET` bounds one cell's fan-out
- [ ] A vine dropped in a pool does not convert the pool without limit
- [ ] The `ra` ownership comment is at the hook
- [ ] Acid dissolves all three; fire burns all three — no new rows needed
- [ ] Rail checked at mobile width with the full 11-element roster
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green
