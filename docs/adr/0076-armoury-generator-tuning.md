# 0076 - armoury generator tuning: diamonds, grain, cherry and the box view

- **Status:** Accepted
- **Date:** 2026-11-08
- **Related:** [ADR 0073](0073-armoury-wand-shop.md); the prototype's "First prototype
  findings" in `~/Code/Playground/ideas/armoury/README.md`.

## Context

The prototype left three known faults: the gem-cut diamonds read as long
twisted flats, the wood grain vanished at full-wand distance, and cherry looked
orange. Moving the wand into a box viewed from above also changed how it is lit
and how it sits.

## Decision

- **Diamonds.** The two opposing flat sets twist 0.75 turns over the carved
  stretch (was 0.5) and cut at least 16% deep (was 12%), giving at least ten
  rows of diamonds on the reference wand. A unit test pins both.
- **Grain.** The stain shader raises each pixel's lightness ratio to the wood's
  mean by a per-wood power before blending (2.1, cherry 3.2), the roughness scan
  doubles as a bump map, and the finish is a little glossier (roughness 0.62) so
  a soft highlight runs along the wand and shows its form.
- **Handle calm.** A long shaft carving makes the handle's carving shallower so
  the wand isn't busy. The prototype did this as a hard step at 60% reach, which
  visibly changed the handle's shading mid-drag; it now eases in between 50% and
  75% reach. A unit test pins that no small change in reach jumps the depth.
- **Cherry.** A greyer tint (`#a08a88`) plus the stronger grain reads as cherry
  rather than orange.
- **The box view.** The camera looks down into the box from above, with a warm
  key light from the upper left. The shadow under the wand is CSS, a blurred bar
  sized from the wand's length: drei's contact shadows couldn't be made to sit
  under a wand seen from above without fighting the transparent canvas.
- **Assets.** Textures are webp (colour at 1k, roughness at 512) and the HDRI is
  downsampled to 512x256: 6.3 MB of prototype assets became about 0.75 MB.

## Consequences

- Tuning was judged by eye on a real GPU (Apple M3, ANGLE Metal). Tests prove
  the mesh is closed and carving only removes wood; they can't prove it looks
  carved, so check generator changes the same way.
