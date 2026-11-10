# 06 - Pattern stencils: scales, vines, runes, knotwork

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
Blocked by: 05 (sequencing only: both edit the same files)

Carve a repeating pattern into a band of the wand from a greyscale tile. The
radius field already works in (angle, z), so a stencil is one more term in
`radiusAt`: sample a tileable height map and cut that deep.

## First: the resolution check

The mesh is 256 points around and a ring every 0.5mm
(`buildWandMesh` defaults), about 0.37mm per step around a 15mm handle. Before
building the feature, carve one scale tile and one vine tile into a wand and
look at it on a real GPU.

- If it reads as carved, build the feature as below.
- If it doesn't, try more segments only in the stencil band, or put the
  pattern in a normal map instead of the geometry (fine detail like Sirius's
  engraving will probably need this anyway). Record which in Comments before
  continuing.

## What to build

- **A small curated set of tiles**, original artwork, stored in `public/` like
  the wood textures: scales (c13), a climbing vine (Hermione, Krum), a knotwork
  band (Ginny, Snape), runes (Sirius), dots (Voldemort's shaft). Each tile is a
  table entry: image, depth, size.
- **Kid controls** in the Decorations group: pattern, where (handle band, shaft
  band, all the way), how big.
- Stain pools in stencil cuts the same way it does in grooves (`depthNorm` in
  `geometry.ts` already does this if the cut goes through `radiusAt`).
- Stencils lie under gems (04) and avoid metal zones (03).
- Tiles must wrap around the wand without a seam: they tile in angle as well
  as along z.

## Done when

- Unit tests: stencil cuts stay inside the envelope, wrap without a seam, and
  are deterministic. iwft covers the controls.
- Ed has seen each pattern on a real GPU, and on a phone.
- Verify loop green. ADR for the stencil model, and normal maps if used.

## Comments
