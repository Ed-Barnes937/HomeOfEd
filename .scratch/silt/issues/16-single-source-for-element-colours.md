# 16 — The rail and the grid read element colours from different places

**What's wrong:** Spec §9: *"Element colours are identical in rail and grid."*
Two modules guarantee this independently, from different sources:

- `apps/silt/src/features/palette/paletteGroups.ts:23` — the rail reads
  `v1Elements`, the raw config array.
- `apps/silt/src/features/render/palette.ts:22-25` — the canvas reads the
  `registry`, and its own comment at `:16` claims colours come *"straight from
  the registry so the rail and the grid can never drift apart"*.

The rail doesn't. `Sim` accepts `SimOptions.elements`, so a sim constructed with
a non-default roster renders one set of colours on the canvas and a different set
in the rail. The comment asserts an invariant the code only half holds.

Secondary: two modules named "palette" meaning different things — the rail's
groupings vs the renderer's species→colour lookup.

**What to build:** One source. The registry is the honest one (it's what the sim
actually renders), so `paletteGroups` should derive from the same registry the
renderer uses rather than from `v1Elements`. Then either the comment is true, or
delete it. Rename one of the two "palette" modules while you're there.

**Status:** claimed

- [ ] Rail and canvas colours provably come from one source
- [ ] `palette.ts:16`'s claim is true, or gone
- [ ] The two "palette" modules have distinguishable names
- [ ] `paletteGroups.test.ts` still passes; full suite green

**Source:** whole-branch drift review (2026-08-06), Standards axis.
