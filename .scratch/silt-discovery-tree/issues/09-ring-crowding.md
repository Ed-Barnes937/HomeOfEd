# 09 - The ring does not scale: fire's chart is a crowd

**Status:** needs-triage
**Type:** task
**Blocked by:** 08 (grouping removes the stage-species duplicate spokes; size
the residual problem after it lands, not before)
**Source:** PR #128 review feedback (Ed, 2026-09-04), with screenshot - fire's
ring at ~24 witnessed spokes: ring tiles overlap and clip at the panel edge,
outcome labels collide ("lava + sulphur" over "lava + moss"), the twelve
o'clock arc is a solid wall of arrowheads.
**Spec:** [../spec.md](../spec.md) §6 (ring), decision 7.

Decision 7 accepted the ring because "the panel shows one element at a time, so
the picture does not get busier as the roster grows" - true per element, but a
*hub* element's own ring still grows with every row that names it. Fire and
lava sit on the tag rows (`fire + [flammable]`, `lava + [everything]`), so
their degree grows linearly with the roster. `ringGeometry.ts` spaces spokes
evenly at one fixed radius (RING.radius 33), so beyond ~14 spokes the 40px
tiles overlap and the labels, at a fixed 0.62 along every spoke, land on their
neighbours.

## Directions to choose between (recommendation first)

1. **Group spokes by shared origin + outcome** (recommended). The derivation
   knows a pair came from one tag row; render `fire + [flammable]` as one spoke
   carrying the reagent tiles stacked (or a count chip `5/7`), the way the
   still-to-find notches already summarise without naming. Degree becomes
   roughly the number of *rules*, not pairs, which is what actually scales.
2. **Adaptive geometry**: above a threshold, spokes wrap onto a second, outer
   radius (alternating), tiles step down a size, labels alternate inner/outer.
   Buys maybe 2x, keeps every pair individually drawn.
3. **List fallback**: a high-degree element renders its entries as rows instead
   of a ring. Cheapest, but abandons the chart's own visual language exactly
   where the player has done the most.

Option 1 changes what an "entry" visually is but not what is counted (the
grouped spoke's chip carries the per-pair progress); options 1+2 combine well.

## Tests

- ringGeometry: for the chosen design, a vitest case that no two tile boxes
  overlap and no tile leaves the 0-100 box at the max real-world degree
  (derive it from the graph, don't hardcode).
- panelModel: grouped-spoke data shape, masking still via `refOf`.
- iwft: open fire's ring fully witnessed; screenshot-free assertions on count
  of rendered spokes.
