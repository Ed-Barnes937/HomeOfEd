# 02 — Acid: acid, stone, sulphur, and a hardness pass

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01 (needs wood)
**Spec:** [../spec.md](../spec.md) §3, §4 rows 5–9

**What to build:** acid `11`, stone `12`, sulphur `13`, plus hardness on the
existing roster (dirt 0, sand 0, obsidian 5, wood 1) — the first use of
`maxHardness`. Five rows, spec §4.

**Row order is load-bearing and will fail silently if wrong.** Row 5
(`acid + wood → sulphur + ∅`) covers a pair that rows 6–7 also cover via the
`[solid]` tag with `maxHardness: 1`. `resolvePairs` keeps the *first*
registration, so row 5 must be declared before them or the feature vanishes with
no error. Pin it with a registry test asserting `acid + wood → sulphur`.

**Why the residue is on the acid side.** `(sulphur, ∅)`: the wood is gone, the
cavity is dug, and the spent acid leaves a grain. `(∅, sulphur)` converts the
wall into a sulphur wall and digs nothing. Two cells in, one out.

**Why wood only.** If all corrodible matter left residue, acid would plug its own
hole with a grain it cannot dissolve. Sulphur is hardness 2 against
`maxHardness: 1`, so `resolvePairs` never registers the acid↔sulphur pair at all
— the loop is impossible by construction, not by a guard. Do not add a `[woody]`
tag.

**Paintable:** acid, stone. Not sulphur — corroding wood is the only way to get
it, and that is what makes acid worth using rather than a second eraser.

- [ ] Acid dissolves dirt and sand, and is consumed doing it
- [ ] Acid eats wood and leaves sulphur; a registry test pins the row ordering
- [ ] Acid cannot touch stone, obsidian or sulphur — assert the pair is unregistered
- [ ] Water neutralises acid; acid on lava boils off to smoke
- [ ] Acid + oil is a deliberate non-reaction — oil floats and shrugs it off
- [ ] Sulphur burns (it is `flammable`, so PR 01's row 3 already covers it)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green
