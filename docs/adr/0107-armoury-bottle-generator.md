# 0107 - armoury bottle generator: lathe profiles, equal pours, tipped levels, parts

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR 0104](0104-armoury-potion-item.md) (the potion item and its rows),
  [ADR 0098](0098-armoury-sword-generator.md) (the sword generator, the pattern this follows).

## Context

The potion shop's item is a bottle of up to four coloured pours. The stage (ticket 09 on)
needs the glass, the liquid, a stopper and a label as meshes; the liquid shader needs the
height of each band's top so every pour reads as the same amount, upright and when the
child tips the bottle in the close look; the shelf and anything else in 2D needs the
silhouette. All of it must be pure and three-free, like the sword's generator, and the
light half must be safe for the main chunk.

## Decision

- **Every bottle is a lathe: a radius along the height**, round the z axis, foot at z = 0,
  millimetres. A shape is one data row in `potion/bottles.ts`: body height, neck range,
  neck radius, lip, outer radius control points and `fullAt`. A lathe gives exact volumes
  (frustums of the profile), its silhouette is the profile itself, and every part is closed
  by construction.
- **Where the body ends and the neck begins.** The body's points run from the foot
  (fraction 0) to the top of the body (fraction 1), and the last point is always
  `[1, neckRadiusMm]`. `shoulderZ` is `bodyHeightMm`. The body and a flat neck are one
  monotone cubic (`sword/curve.ts`), so the join has no overshoot and a level tangent.
  `neckMm` runs from there to the top of the lip.
- **Neck ranges and the drawn height.** The neck ranges were retuned from 10-45 mm to
  16-40 (round, shoulder), 16-42 (teardrop, gourd) and 18-45 (tall): a stopper's plug needs
  a straight bore to sit in. The stopper allowance above the lip is 16 mm, so the tallest
  bottle (`TALLEST_MM`) is 211 mm, and a round flask at neck 0 frames at about 0.57 of the
  stage against the spec's "about 0.6".
- **`profile.ts` (main chunk safe)** builds dense closed curves with exact normals (from the
  curve's derivative, never from triangles): a domed push-up and a ring to stand on, a
  rounded foot, the body, the neck, a rolled lip bead (a half round as proud as `lipMm`), a
  flat lip top and a filleted bore. The inside is the outside offset by a **2.5 mm wall**
  along its normal, with loops cut out, over a **5 mm base**. Meshes keep a point every
  5 degrees of turn or 4 mm of run; volumes and radii use the dense curve.
- **Equal pours to `fullAt`.** `fullZ = fullAt * bodyHeightMm`, just under the shoulder.
  `uprightLevels` puts band k's top where the cavity holds k quarters of the volume to
  `fullZ`, so every pour adds the same volume (tests: within 1 percent against Simpson's
  rule). Fewer pours are the first levels of four.
- **The cavity runs up the bore to the bottom of the stopper** (18 mm below the lip top,
  the same for every stopper, or 2 mm above the shoulder on a neck too short for that, so no
  plug ever shows below the neck), and the liquid mesh with it, 0.3 mm inside the glass.
  The ticket said the liquid stops at the bottom of the bore; on a full tall bottle at
  60 degrees the liquid reaches the neck, so the mesh and the tipped table include it.
- **Tipped levels (`tipped.ts`, not the main chunk).** `levelTable` stores, every 5 degrees
  from 0 to 90, each band top's height along world up measured from the foot's centre, by
  bisection on the cavity's volume below a tilted plane, integrated in 0.25 mm slices with
  the exact disc-segment area. By symmetry the tilt's direction does not matter. `levelsAt`
  interpolates linearly. Measured against independent quadrature, every band of every
  shape keeps its volume within 2 percent to 60 degrees, including between rows, and within
  5 percent at 90. A table costs several milliseconds; build it once per spec, never per
  frame.
- **The frame of a tipped level.** A level h is the plane dot(p, u) = h, where p is a point
  in the bottle's own millimetre frame (origin at the foot's centre) and u is world up
  expressed in that frame (the inverse of the bottle's rotation applied to world up).
  Upright, u is +z and the test reduces to `aHeight`, the vertex's height along the
  bottle's axis; tipped, a shader must use dot(p, u), not `aHeight`.
- **Stoppers.** Each is a lathe that fills the bore to the cavity's top, 0.05 mm inside it:
  `cork` a tapered plug 60 percent in the bore, chamfered; `glass` a ground plug, a collar
  on the lip, a stem and a teardrop knob that reaches `heightMm`; `wax` a cork 4 mm above
  the lip, dipped: the wax hugs the cork, the lip and the neck inside; outside it is a soft
  superellipse dome from the bead over the cork, a thinner coat down the neck and a roll
  where the dip ended. The mesh lifts the lathe unevenly (the dome tilts, the roll wanders
  about a millimetre up and down round the neck), with normals carried through the lift
  exactly, and six flattened drips of different lengths, fatter at the foot, hang from
  inside the roll (shortened together on a short neck, and kept clear of a tag's string).
  `heightMm` is the top of the 16 mm stopper allowance: the glass knob reaches it, the cork
  and the wax stop below it. It is the same for every stopper, so a bottle is framed the
  same whatever its stopper.
- **Labels face the child, along -y** (`FRONT_ANGLE`). Paper is a closed sheet 0.3 to
  0.42 mm off the glass along its normal, its UVs in millimetres across the paper, centred:
  `round` a disc on the middle of the body's widest band, 40 percent of the body's height
  across but never more than 100 degrees round or off its bulb (so the tall bottle's is
  smaller); `banner` 140 degrees round, 22 mm high, swallowtail notches; `tag` a 26 by 18
  card hanging 6 mm below the shoulder, tilted just enough to clear the glass, in a U of
  string that runs down across its face from a loop round the neck. The string is one
  closed tube that hugs the glass along its normal; it does not thread through the card,
  because a threaded hairpin folded the tube.
- **Parts and budgets.** `buildPotionMesh` returns `glass` (64 segments), `liquid` (64),
  `stopper` (40) and `label` (or `null`), each closed, consistently wound and with outward
  unit normals, plus a per-vertex `aHeight`, the height in mm along the bottle's axis. Every
  connected piece of a part (a drip, the cork under the wax, the tag's string) encloses a
  positive volume, so an inside-out piece fails a test even when the part's total does not.
  Budgets are asserted on vertex counts: glass 20k, liquid 10k, stopper and label 8k, total
  40k. Across all 1,260 combinations (necks in 0.05 steps) the most is glass 13.1k (gourd,
  neck 1), liquid 4.7k (gourd, neck 0.9), stopper and label 6.4k (round, neck 0.05, wax,
  tag), total 23.8k (gourd, neck 1, wax, round label); the test catalogue names these.
- **Outline (`outline.ts`, main chunk safe).** `potionOutline` returns a `PotionSilhouette`:
  the glass's outer silhouette, the stopper's envelope and one polygon per band clipped to
  the cavity at the upright levels with its colour, x across and y up from the foot, plus
  `widthMm` and `heightMm`. The shelf's `PotionOutline` draws it, flipping y to SVG's
  `heightMm - y` and keeping the stopper's colour itself.
- **What the main chunk may import:** `profile.ts` and `outline.ts` import only
  `sword/curve.ts`, `bottles.ts`, `compile.ts` and `potionSchema.ts` (a test pins it).
  `geometry.ts` and `tipped.ts` are for the stage's lazy chunk only.

## Consequences

- Tuning a shape is a row edit; the tests derive their expectations from the rows and pin
  each shape's character (the round flask nearly as wide as tall, the teardrop tapering all
  the way, the tall bottle three times as tall as wide, the square shoulder turning in over
  a few millimetres, the gourd's waist).
- A new stopper or label is a profile or a sheet plus a catalogue entry; the closed-mesh,
  seat and clearance tests cover it.
- The form gate (ticket 09) judges the shapes in plain grey on a real GPU and adds its
  tuning and cuts here as a "Form gate" section.
