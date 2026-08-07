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

## Comments

**Known, accepted duplication in the fix (PR #55):** `useSimLoop.ts` seeds its
`registry` React state with its own `createRegistry(v1Elements, v1Reactions)`
call, used only as the first-paint placeholder before the mount effect swaps
in the running `Sim`'s own `sim.registry`. This duplicates the exact default
construction `Sim`'s constructor already does internally
(`elements = v1Elements, reactions = v1Reactions`) — a second, independent
place building "the default registry."

It's safe today: verified content-identical to `sim.registry`, so the rail and
canvas show the same colours from the very first render. The latent risk is
narrow — if `Sim`'s defaults ever diverge from `v1Elements`/`v1Reactions`, the
rail would show the wrong colours for exactly one render, until the mount
effect swaps in the real registry. That's a much smaller version of this
ticket's original bug (persistent drift vs. one frame), not a full regression.

Both review axes (Standards and Spec) flagged this independently during
implementation and called it non-blocking; it was consciously left as-is
rather than fixed, since removing it would mean either exporting a shared
"default registry" constant from `sim/` (a small engine-surface change beyond
this ticket's scope) or delaying the rail's first paint until the sim mounts
(a UX regression). Whoever next touches `useSimLoop.ts` or `Sim`'s defaults
should know this pairing exists.
