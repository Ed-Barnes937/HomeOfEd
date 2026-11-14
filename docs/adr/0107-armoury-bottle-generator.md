# 0107 - armoury bottle generator: lathe profiles, equal pours, tipped levels, parts

> Amended 2026-11-14: the wax seal is cut; see [The wax seal: cut](#the-wax-seal-cut).

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
  `fullZ`, so every pour adds the same volume (tests: within 1e-5 against Simpson's
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
  shape keeps its volume within 0.4 percent to 60 degrees, including between rows, and within
  5 percent at 90. A table costs several milliseconds; build it once per spec, never per
  frame.
- **The frame of a tipped level.** A level h is the plane dot(p, u) = h, where p is a point
  in the bottle's own millimetre frame (origin at the foot's centre) and u is world up
  expressed in that frame (the inverse of the bottle's rotation applied to world up).
  Upright, u is +z and the test reduces to `aHeight`, the vertex's height along the
  bottle's axis; tipped, a shader must use dot(p, u), not `aHeight`.
- **Stoppers.** Each is a lathe that fills the bore to the cavity's top, 0.05 mm inside it:
  `cork` a tapered plug 60 percent in the bore, chamfered; `glass` a ground plug, a collar
  on the lip, a stem and a teardrop knob that reaches `heightMm`. A third, `wax`, was cut
  (below).
  `heightMm` is the top of the 16 mm stopper allowance: the glass knob reaches it, the cork
  stops below it. It is the same for every stopper, so a bottle is framed the
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
  connected piece of a part (the tag's card, its string) encloses a
  positive volume, so an inside-out piece fails a test even when the part's total does not.
  Budgets are asserted on vertex counts: glass 20k, liquid 10k, stopper and label 8k, total
  40k. The most any combination takes is under [The wax seal: cut](#the-wax-seal-cut); the
  test catalogue names those.
- **Outline (`outline.ts`, main chunk safe).** `potionOutline` returns a `PotionSilhouette`:
  the glass's outer silhouette, the stopper's envelope and one polygon per band clipped to
  the cavity at the upright levels with its colour, x across and y up from the foot, plus
  `widthMm` and `heightMm`. The shelf's `PotionOutline` draws it, flipping y to SVG's
  `heightMm - y` and keeping the stopper's colour itself.
- **What the main chunk may import:** `profile.ts` and `outline.ts` import only
  `sword/curve.ts`, `bottles.ts`, `compile.ts` and `potionSchema.ts` (a test pins it).
  `geometry.ts` and `tipped.ts` are for the stage's lazy chunk only.

## Form gate

The bottle is judged in plain grey (`?clay`) on the real stage rigs (ticket 09), beside the wand
and sword baseline, before any material exists. Shots and each round's review are in the epic's
`shots/09/r<N>/`.

- **A correction to the text above.** The cork sits 60 percent in the bore on most necks and
  54 percent on short ones.
- **The round label is 32 percent of the body's height across** (was 40), so on the teardrop and
  the gourd, where it sits low on the widest band, the lower pours show beside it.
- Cuts: none at this gate. The wax seal was reshaped here twice and cut later, at ticket 10's
  look gate (below).

### Form gate, round 2

Round 1's review (`shots/09/r1/review.md`) passed the shapes, necks, cork, glass stopper and pours
and asked for changes to the bottle's dressing. In ring diameters D (the lip ring's outer
diameter, 18 to 22 mm):

- **The banner wraps 120 degrees** (was 140) and is 18 mm high (was 22), so both notched ends sit
  inside the front silhouette and more of the pours shows above and below. On the round flask
  (ticket 10's gate, round 2) it wraps 100 degrees, is 12 mm high and sits 5 mm below the widest
  band: the round flask's middle pours fill that band, and the 18 mm banner hid the whole middle
  layer of three. About half of that layer's front now shows (at least 40 percent, a unit test).
- **The tag hangs like a luggage tag.** Its top hangs 0.66 to 0.71 neck diameters below the
  string's loop (0.75 by the hole, which is 3 mm below the top), resting on the shoulder or the
  upper bulb (the hang search starts 0.5 mm off the glass); it is rolled 10 degrees in its own
  plane and its top corners are clipped 4 mm at 45 degrees. The string is 0.4 mm in radius (was
  0.5), leaves the loop 0.6 rad either side of the front, follows a clearance envelope 1.2 mm off
  the glass pulled taut (it bridges hollows such as a neck's join), and passes through the hole
  in a round U of 2 mm radius, with no V; it is smoothed, and no bend turns more than 20 degrees
  per 0.3 mm. It is still one closed tube clear of the glass.
- **The round label is at most 0.6 of the body's width from the front** as well as 32 percent of
  its height across, so the tall bottle's comes down from about 0.8 to 0.6 and the others stay
  where round 1 passed them (teardrop 0.51, square shoulders 0.58, gourd 0.57). The round
  flask's stays at 0.3: 0.6 would hide its middle three pours, on the shape every pour shot uses.
  **Paper is 0.1 mm thick, 0.1 mm off the glass** (was 0.12 mm thick, 0.3 off), so it reads as
  paper stuck on glass edge-on; the glass writes no depth, and the label's grid lies inside its
  true surface by at most 0.02 mm, so it cannot fight.
- **The cavity floor rounds into the wall with a 4 mm radius** (1.6 walls), the liquid's with
  3.7 mm about the same centre, on every shape. Volumes still come from the cavity's own curve, so
  pours stay equal to within 1.2 millionths against Simpson's rule (tests: 1e-5), and the tipped
  bands within 0.35 percent to 60 degrees (tests: 0.4 percent).
- **The cavity's inset drops any step more than 60 degrees off the curve's tangent at either
  end** (it dropped only steps running backwards along the source), so the square shoulders'
  inner wall no longer folds a lathe ring at necks 0.625 to 0.67. Only that shape moves: its
  inner wall by at most 0.01 mm and its liquid by 0.05 mm; every outer silhouette is unchanged.
- **Budgets after round 2**, across all 1,260 combinations then (with the wax seal, since cut):
  glass 13.6k (gourd, neck 1, cork, no label), liquid 5.2k (gourd, neck 0.9), stopper and label
  7.5k (round, neck 0.9, wax, tag), total 25.0k (gourd, neck 1, wax, tag).
- Left for the owner or later tickets: the glass stopper's finial, a tighter square shoulder, the
  bottle's size in the scene, and the liquid surface's aliased far rim (ticket 10).

## The wax seal: cut

On 2026-11-14 ticket 10's look gate (`shots/10/r2/review.md`, "The wax seal: CUT") cut the
`wax` stopper, after three reshapes (round 1, round 2 and ticket 10's short-neck tries). Upright
on the short round flask, the pose seen most, its bell read as a muffin top or a mushroom cap;
tipped towards the child, as a plastic drawer pull; and its even gloss read as plastic or clay,
worse in the mixed colours every child sees after the mix. It did not read as wax on a cork on
every shape a child can make, which was the bar.

- **Two stoppers remain:** `cork` and `glass`. The wax's profile, its coat and runs, its lifted
  lathe, its colour (`waxColour`) and its material are gone, and so is the shader split that told
  the cork under it from the wax.
- **A save or a share link that says `stopper: 'wax'` opens with a cork.** `normalise` already
  falls back to a choice's default for a value it does not know, and the stopper's default is
  `cork`; tests pin it at the schema, the save document and the share link. Nothing had shipped,
  so there is no other migration.
- **Presets:** Puddle Jumper (frogfizz, bluebell and puffcap in smoky glass on a tag) takes a cork,
  for its earthy pond; Night Sky (moonmilk and rosehip in violet glass) takes the glass stopper, a
  jewel for a night sky. Both kept their other choices.
- **Budgets now**, across all 840 combinations (necks in 0.05 steps): glass 13.6k (gourd, neck 1),
  liquid 5.2k (gourd, neck 0.9), stopper and label 5.2k (round, glass stopper, tag, neck 0.15 and
  up), total 23.2k (gourd, neck 1, glass stopper, tag).

## Consequences

- Tuning a shape is a row edit; the tests derive their expectations from the rows and pin
  each shape's character (the round flask nearly as wide as tall, the teardrop tapering all
  the way, the tall bottle three times as tall as wide, the square shoulder turning in over
  a few millimetres, the gourd's waist).
- A new stopper or label is a profile or a sheet plus a catalogue entry; the closed-mesh,
  seat and clearance tests cover it.
- The form gate (ticket 09) judges the shapes in plain grey on a real GPU and adds its
  tuning and cuts here as a "Form gate" section.

## The stage's level seam

- **`levels` defaults to the levels at the surface's tilt**, `levelsAt(table, tilt(u))`, not the
  upright levels the ticket named. Upright they are the same; tipped, the bands keep their volume
  with nothing passed, so a slosh only moves `surfaceNormal`.
