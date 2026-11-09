# 06 - Pattern stencils: scales, vines, runes, knotwork

**Status:** ready-for-human
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

**2026-11-09, agent (resolution check):** Carved a scale tile and a vine tile all
over a cherry and an oak wand and shot the close look, zoomed, on a real GPU
(headless Chromium, ANGLE Metal, DPR 2), `shots/06/r0/` against `shots/06/r1-fine/`.

- At the default mesh (256 round, a ring every 0.5 mm) neither reads as carved
  close up. The vine's stem stair-steps into something like a twisted rope, and the
  scales' edges break into chevrons. Round the wand is already fine (about 0.14 mm
  per step on the shaft); the coarse direction is along it.
- **Chosen: rings twice as close (0.25 mm) only over the stencil's bands.** Both
  tiles then read as carved: a clean stem with leaves and midribs, and overlapping
  scales. Softening each tile's sheer edges over about 0.3-0.4 mm removed the last
  beading along the scales' lips.
- No normal map. Geometry keeps stain pooling, the bend and the silhouette for free,
  and the finest strokes (runes, about 0.7 mm wide) are still a few rings across.
- Build time, Node, medians of 13 interleaved runs, as ratios to ticket 05's turned
  wand: turned 0.98, branch 1.64 (05: 1.73), turned-handle branch 1.57 (05: 1.55);
  with a stencil, scales on the handle 1.35, a vine all over 2.38, runes on a branch's
  turned handle 1.91. Wands without a stencil build exactly as before. Each tile is
  rasterised once, on first use (vine 44 ms, the rest under 25 ms).

**2026-11-09, agent (built):** Built on branch `armoury-variety-06-pattern-stencils`
(chained on 05's branch); decisions in ADR 0085. Needs Ed's eye on a real GPU and a
real phone, including a few Try another rolls, before merging.

- "Extras" gain "Carved pattern" (Plain, Scales, Vine, Knotwork, Runes, Dots),
  "Where it goes" (On the handle, Up the shaft, All over) and "Pattern size"; the last
  two show only with a pattern. Extras' summary names the pattern when there is
  nothing else to name.
- Tiles are drawn in code (`wand/stencils.ts`), not images in `public/`, so `wand/`
  stays pure and testable in Node. All five are original; the runes are eight invented
  glyphs built from strokes, arcs, rings and dots.
- Each tile is periodic both ways; a band fits whole tiles round and along it, and the
  middle of a tile faces up in the box, so a vine or a column of runes shows whole.
- On a Branch: no shaft or all-over band, and a handle band only on a turned handle (a
  grown Branch hides all three controls). A metal handle offers no handle band.
- Bands are cut round every metal zone with a 0.8 mm gap; a metal spiral's crest and gem
  seats stay uncut. Stain pools in the cuts through `depthNorm`. The surface still goes
  through the bloom cap.
- Try another: "Plain" weighs 50 to 1 per tile, so about one Turned roll in eleven has a
  pattern; "On the handle" weighs 2.
- New preset "Ivy" (a vine up an oak shaft).
- Final build-time ratios (same process, 05's code and this one's in turn, medians of
  13): turned 1.00, branch 1.66 (05: 1.65), turned-handle branch 1.55 (05: 1.52); scales
  on the handle 1.33, a vine all over 2.41, runes on a branch's turned handle 1.91.

Deviations:
- Tiles are generated in code rather than stored as images in `public/` (the brief
  allowed either).
- Controls are in "Extras" (the spec's "Decorations" became that in 03).
- "Knotwork" is a plait of strands crossing over and under, not a closed knot.
- Added a preset, "Ivy" (a vine up an oak shaft), which the ticket didn't ask for.

GPU shots (headless Chromium, ANGLE Metal, Apple M3 Pro) in `shots/06/`: `tiles/` the
five tiles flat; `r0/` and `r1-fine/` the resolution check; `r3/` final: each pattern in
the box, the close look and zoomed (`*-detail.png`), scales on a turned-handle Branch
(`b1_*`), share pictures (`*-share.png`) and phone viewports (`r3/phone/`). `r2/` is
before the tile was centred on the side facing up.

Not done / for later:
- Not checked on a real phone, only a phone viewport. An all-over pattern has about
  twice the vertices of a plain wand.
- A pattern can sit over the handle's or shaft's own carving (the deeper cut wins).
  Ed to judge whether one should hide the other.
- Name and lore don't mention the pattern.

**2026-11-09, agent (review round 1 follow-ups):**
- An engraving now replaces cut carving across its band: every cut groove set fades out
  as the engraving fades in, and raised ridges still stand over it. Before, the deeper
  cut won and carving hid most of it (none showed over a gem-cut handle). Tested over
  diamonds, flats and flutes; shots in `shots/06/r4/` (scales over a gem-cut handle,
  knotwork over flutes and twisted sides).
- The controls are "Engraving" and "Engraving size", so they can't be mixed up with the
  handle's "Pattern". "Where it goes" is unchanged.
- `stencilHeight` keeps the last raster, so a mesh build skips the Map lookup per vertex.
- The determinism test builds its second wand from freshly loaded modules, so the tiles
  are drawn again.
- Name and lore don't mention the engraving, the same as for gems (decided).
- **Known gate: the real-phone check.** An all-over engraving is about 314k vertices and
  26 MB of attributes at 34 cm. Ed's check on a real phone gates the merge; if a phone
  struggles, the segments round the wand come down then.
