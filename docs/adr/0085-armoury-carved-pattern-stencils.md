# 0085 - armoury carved patterns: stencil tiles cut through the radius field

- **Status:** Proposed
- **Date:** 2026-11-09
- **Related:** [ADR 0084](0084-armoury-branch-wands.md) (the spine, no shaft carving on a
  Branch, build-time ratios), [ADR 0083](0083-armoury-glowing-gems.md) (gem seats),
  [ADR 0082](0082-armoury-material-zones.md) (metal zones, the bloom cap),
  [ADR 0090](0090-armoury-raised-features.md) (the envelope, weighted choices),
  [ADR 0074](0074-armoury-save-format.md) (new params default so old saves open),
  `.scratch/armoury-variety/` ticket 06.

## Context

Many reference wands carry a repeating carved pattern: scales, a climbing vine, a
knotwork band, runes, dots. The surface is already a radius field r(angle, z), so a
pattern can be one more cut in it. The open question was whether the mesh (256 points
round, a ring every 0.5 mm) could show one, or whether it needed a normal map.

## Decision

- **A stencil is one more cut in `radiusAt`.** A greyscale tile gives a height from 1
  (the surface) to 0 (the floor), and the floor cuts a fraction of the local radius
  (6-8% per tile). It follows bumps and the profile, stays inside the envelope, bends
  with the spine and pools stain through `depthNorm` like any groove.
- **An engraving replaces cut carving across its band.** Taking the deeper cut let
  carving swallow it (in review: none of it showed over a gem-cut handle, a quarter at
  most over flats, half over flutes). Inside a band, every cut groove set (flats, flutes,
  diamonds, cut spirals, twisted sides) fades out as the engraving fades in, so the
  engraving alone shapes the wood there. Raised ridges still stand over it.
- **Five original tiles, drawn in code.** `wand/stencils.ts` draws scales, a vine,
  knotwork (a plait of strands passing over and under in turn), runes (eight invented
  glyphs, no real or fictional alphabet) and dots as periodic functions, and rasterises
  each once on first use (at most about 45 ms). Code rather than images keeps
  `wand/` pure and testable in Node, with no image decoding. Each tile is a table
  entry: drawing, aspect, length range and depth.
- **Seamless both ways.** Every drawing is periodic on its tile, and the raster wraps.
  Round the wand, a band fits a whole number of tiles for its mean radius; along it, a
  whole number of tiles for its length, so a band ends on a tile's edge. The middle of a
  tile faces up in the box (`SHOWN_SIDE`), so a vine or a column of runes shows whole.
- **Finer rings in a band, not a normal map.** At the default mesh a vine's stem
  stair-steps and scales break into chevrons (`shots/06/r0` against `r1-fine`). Rings
  twice as close (0.25 mm) only over stencil bands, and each tile rolling its sheer
  edges over about 0.3 mm, make every tile read as carved. Geometry keeps stain pooling,
  the bend and the silhouette for free; a normal map would have replaced the wood's
  bump and needed none of that machinery.
- **Kid controls in "Extras"**: "Engraving" (Plain, Scales, Vine, Knotwork,
  Runes, Dots), "Where it goes" (On the handle, Up the shaft, All over) and "Engraving
  size". The last two show only with an engraving. It isn't called a pattern, because
  the handle group already has a "Pattern" (its carving). The handle band is the handle style's
  carving stretch; the shaft band runs from just past the ring up 45% of the shaft;
  all over is both, up to 90% of the shaft.
- **Where a pattern may go** follows ticket 05's rule for carving. On a Branch there is
  no shaft or all-over band, and a handle band only on a turned handle, so a grown
  Branch hides the controls. A metal handle offers no handle band.
- **Stencils avoid metal and gems.** Bands are cut round every metal zone (the end cap,
  a metal ring or handle, bands, the crystal's cup) with a 0.8 mm gap, a metal spiral's
  crest stays uncut, and gem seats keep their dish and rim as they do over carving.
- **Try another stays mostly plain.** "Plain" weighs 50 against 1 for each tile, so
  about one Turned roll in eleven has a pattern, and "On the handle" weighs 2 against
  1 for the others.
- **Old saves.** The new params default to Plain, so every save and link opens as the
  same wand. The shop number changes, as ADR 0074 allows.
- **New preset "Ivy"**: a vine up an oak shaft.

## Consequences

- Build time, measured in Node as ratios to ticket 05's turned wand, with ticket 05's
  code and this one's built in turn in the same process (medians of 13 runs): wands
  without a pattern are unchanged (turned 1.00, branch 1.66 against 1.65, turned-handle
  branch 1.55 against 1.52); scales on the handle 1.33, a vine all over 2.41, runes on a
  branch's turned handle 1.91.
- An all-over engraving is about 314k vertices (26 MB of attributes at 34 cm), about
  twice a plain wand. Fine on desktop and the phone viewport. Ed's real-phone check gates
  the merge; if a phone struggles, the segments round the wand come down then.
- A handle or shaft carving still shows wherever the engraving's band doesn't reach,
  for example a handle's carving under a shaft-only engraving.
- The surface still passes through the 03 bloom cap, so no pattern blooms.
- The tag's name and lore don't mention the pattern.
- Tuning was judged by eye on a real GPU (Apple M3 Pro, ANGLE Metal) in the box, the
  close look, on a phone viewport and in the share picture.
