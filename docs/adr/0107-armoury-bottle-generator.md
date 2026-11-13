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
- **The cavity runs up the bore to the bottom of the stopper** (`PLUG_MM` 18 below the lip
  top, the same for every stopper), and the liquid mesh with it, 0.3 mm inside the glass.
  The ticket said the liquid stops at the bottom of the bore; on a full tall bottle at
  60 degrees the liquid reaches the neck, so the mesh and the tipped table include it.
- **Tipped levels (`tipped.ts`, not the main chunk).** `levelTable` stores, every 5 degrees
  from 0 to 90, each band top's height along world up measured from the foot's centre, by
  bisection on the cavity's volume below a tilted plane, integrated in 0.25 mm slices with
  the exact disc-segment area. By symmetry the tilt's direction does not matter. `levelsAt`
  interpolates linearly. Measured against independent quadrature, every band of every
  shape keeps its volume within 2 percent to 60 degrees, including between rows, and within
  5 percent at 90. A table costs about 15 ms; build it once per potion.
- **Stoppers.** Each is a lathe that fills the bore to 18 mm down, 0.05 mm inside it:
  `cork` a tapered plug 60 percent in the bore, chamfered; `glass` a ground plug, a collar
  on the lip, a stem and a teardrop knob that reaches `heightMm`; `wax` a shorter cork
  under a dipped seal that hugs the cork, the lip and the neck inside and is a flat-topped,
  round-edged cap outside, with four flattened drips down the neck that stop above the
  shoulder. The stopper allowance is now 16 mm: the glass knob reaches it, the cork stops
  4 mm short, the wax cap 9 mm short. `heightMm` stays stopper-free (`compile.ts` is
  unchanged) so a bottle is framed the same whatever its stopper.
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
  unit normals, plus a per-vertex `aHeight` in mm. Budgets are asserted on vertex counts:
  glass 20k, liquid 10k, stopper and label 8k, total 40k. Across every shape, neck, stopper
  and label the most is glass 13.1k, liquid 4.7k, stopper and label 6.9k, total 24.3k.
- **Outline (`outline.ts`, main chunk safe).** The glass's outer silhouette, the stopper's
  envelope and one polygon per band clipped to the cavity at the upright levels with its
  colour, x across and y up from the foot, plus `widthMm` and `heightMm`.
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
