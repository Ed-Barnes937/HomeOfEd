# 02 - Spike: can a bent, noisy wand read as a branch?

**Status:** resolved (2026-11-09, spike on spike/armoury-branch)
**Type:** prototype
**Spec:** [../spec.md](../spec.md)
Blocked by: none

A throwaway spike on its own branch (`spike/armoury-branch`, never merged),
inside the real app so it uses the real stage, wood and lighting. It answers
questions for ticket 05; it doesn't ship code.

## Questions to answer

1. **Does it look like a branch?** Bend the wand along a gentle curve, add
   low-frequency radius noise and a few knots (local bumps in angle and z).
   Benchmarks: Bellatrix, c1, Harry's handle. Find which ingredients matter:
   is a bend alone a bendy stick? How much noise before it looks melted? Do
   knots need the stain to pool around them?
2. **Is "bend after building" enough?** Build the straight mesh as today, then
   map each vertex through a spine (point plus frame at each z). Does that keep
   the mesh valid, normals right and the wood grain following the bend? Or does
   the bend need to live inside `radiusAt`?
3. **What breaks downstream?** Try a bent wand in: the box (`BoxPose`, fitting
   in `stage.ts`), the close look's grip and turn (`CloseUpStage.tsx`), the
   figure-of-8 wave and tip position (`wave.ts`, the tip glow), the share
   picture (`share/shareCard.ts`), handle thumbnails. List each break and the
   likely fix.
4. **Is a "Kind of wand" picker needed?** Do branch params make sense next to
   turned-wand params (a ringed handle on a gnarled branch?), or do they want
   their own kind with its own controls and defaults?

## Output

- Screenshots on a real GPU of 3-5 branch attempts, with the settings that made
  each.
- An `## Answer` below with the four answers and a recommended shape for
  ticket 05 (rewrite 05's "What to build" if the spike says so).
- Delete the spike branch once 05 is written up, or leave it unpushed.

## Answer

Spike code is on branch `spike/armoury-branch`, pushed as a DO NOT MERGE PR so
Ed can pull it and play: the panel gets a sixth group, "The branch (spike)",
with Kind, How bent, How wiggly, Lumpy, Knots, Stain pools at knots and Which
branch. Screenshots are in [`../shots/02/`](../shots/02/), taken in headless
Chromium on the real GPU (ANGLE Metal). Each attempt's settings are in
`apps/armoury/spike-shots.mjs` (`attempts`) on the spike branch. The
measurements come from `apps/armoury/src/wand/branchSpike.test.ts`.

| Shot | Settings (kind Branch unless noted) | Reads as |
|---|---|---|
| `a1_bend_only-boxcrop` | bend 0.6 | a smooth bent rod, like a liquorice whip |
| `a2_bend_wiggle-boxcrop` | bend 0.5, wiggle 0.6 | a snake or a hose: wiggles with an even radius look extruded |
| `a6_lumps_only_max-boxcrop` | lumpy 1 | a melted candle at the handle |
| `a4_dark_gnarled-*` | walnut, midnight 0.85, bend 0.35, wiggle 0.8, lumpy 0.6, knots 6 | **a branch** (the best of the set; Bellatrix-like) |
| `a7` vs `a8` `-zoom` | maple, smoky, knots 5, bend 0.3, lumpy 0.3; pooling off vs on | off: lumps of putty. On: knots |
| `a5_max_everything-*` | all 1, knots 7 | still a branch, but knots near the butt are blobs and the handle looks rubbery |
| `a9_turned_mix-*` | Turned profile (ringed handle, ring stack, short spiral) + bend/wiggle/lumps/knots 0.5/0.5/0.5/4 | a turned handle on a grown shaft. Plausible, not broken |
| `a10_pale_branch-spell` | maple, natural, bend 0.4, wiggle 0.35, lumpy 0.35, knots 3 | a peeled stick |

### 1. Does it look like a branch?

Yes, but no one ingredient does it. It takes the mix:

- **A bend alone** gives a bent rod (a1). **A wiggle with an even radius** gives
  a snake or tubing (a2). Both need lumps and knots to read as wood that grew.
- **Lumps** (low-frequency radius noise, periodic in angle) look melted above
  about 7% of the radius (a6 at 14%). Cap "Lumpy" at half the spike's range.
- **Knots need the stain to pool.** Without it a knot is a lump of putty (a7).
  With a dark heart and a stained rim around the boss it reads as a knot at
  once (a8). The rim and heart darken unstained wood too, through `shade`.
- **The profile matters.** The Branch profile drops the turned beads and
  collar for a natural taper, thickest at the butt with a slight swell where
  the hand goes. That is most of what makes a4 and a10 read as grown.
- **Gloss.** Stained branches look lacquered: the stain lowers roughness. That
  is fine for a polished branch but worth a look by eye in 05. It is not a
  blocker.
- **Knots on the handle at full size are too big.** Scale knot size down below
  the grip (a5).

### 2. Is "bend after building" enough?

**Yes. The spec's decision stands.** Build the straight mesh, then carry
each ring onto a spine frame at its z (`spineFrame` in the spike's
`geometry.ts`):

- **Mesh stays valid.** The spine subtracts the straight line between its ends,
  so pommel and tip stay on the axis. The end rings still collapse to a point
  and seal. 30 random bent wands came out finite with sealed ends.
- **Normals are right for free.** Run the bend *before* the existing
  central-difference normal pass, which then works on the bent positions.
- **Grain follows the bend for free.** UVs stay in straight (angle, z) space
  (see the `-zoom` shots).
- **Lumps and knots belong in `radiusAt`**, because they change the radius. Only
  the spine is post-build. Keep `depthNorm` clamped at 0, because knots and
  lumps add wood.
- **The bend's curvature must be bounded.** That is the one real constraint. Two
  bugs found by measurement: a `sin(pi * u^0.8)` bow has infinite curvature at
  the butt (bend radius 2mm), and a wiggle envelope `min(1, u/0.35)` has a kink
  (8mm). Both fold the inside of the bend. Fixed with smooth functions
  (`sin(pi u) - 0.2 sin(2 pi u)`, a smoothstep envelope) and with wiggle
  amplitude scaled by `(2/f)^2` so every frequency has the same curvature.
  Result: across L 28-38, bend and wiggle 0-1 and 25 seeds, the tightest bend
  radius is at least 1.74x the local wand radius plus 3mm. The worst cases
  are 38mm (wiggle 1) and 258mm (bend 1, no wiggle). Max sideways offset is
  28mm, and the tip leans up to 23 degrees.
- **The frame** is Gram-Schmidt from world x. That is fine at these bends. A
  rotation-minimising frame is only needed if 05 allows much bigger bends.
- **Cost**: a full-resolution build takes 39ms against 27ms straight.

### 3. What breaks downstream?

Less than expected, because the ends stay on the axis:

| Place | Result | Fix in 05 |
|---|---|---|
| Box (`stage.ts` framing, `WandStage`) | Fits, even a 38cm wand at full bow (`max-bow-38cm-boxcrop`). Rolling swings the bow round, which looks right (`a4_dark_gnarled-boxrolled`) | none |
| Box shadow (`Counter.module.scss` `.wandShadow`) | A straight CSS blur under a bowed wand. Not noticeable in the shots | none, or offset it by the bow later |
| Close look grip and turn (`CloseUpStage.tsx`) | Fine on desktop and phone (`phone-closelook`). Grip at 20% of the chord is still on the handle | none |
| Close look hit box (`CloseUpStage.tsx` `girth`) | Half-girth is 3.5x the handle radius, about 28mm at its slimmest. Max bow is 28.4mm at 38cm, bend 1, slim 0.85, so a tap on the peak of the bow can just miss | size the hit box from the mesh's bounding box, or add the spine's max offset |
| Wave and `fitWave` (`wave.ts`) | Correct: the reach runs along the chord and the tip is on it (`a4_dark_gnarled-spell`, `a9_turned_mix-spell`) | none |
| Tip glow, trail, sparkles (`WandMesh.tsx` `TipGlow`, `Rig` tip) | On the tip in every shot | none |
| Spell burst direction (`SpellBurst.tsx`) | Fires along the chord (+x) while the tip leans up to 23 degrees. Not visible in the shots | optional: aim it along the spine's tip tangent |
| Share picture (`share/shareCard.ts`) | Correct: the tip glow lands on the tip (`a4_dark_gnarled-sharecard`) | none |
| Shelf (`ShelfPage.tsx`) | Draws no wand, only labels and a core-colour seal (`a4_dark_gnarled-shelf`) | none |
| Handle picker thumbnails (`public/thumbs`, `Widgets.tsx`) | **Broken.** A Branch wand still shows the turned-handle thumbnails, and Handle style, Ring and Pattern do nothing on the Branch profile (`controls-handle-thumbs`) | hide those controls for Branch (see 4) |
| Control groups (`shop/controls/groups.ts`) | **A new schema group doesn't show** until it gets a `GROUPS` entry (numeral, title, tab) | add the entry |
| Try another (`randomise`) | Randomises the new params too, so turned wands come out bent and knotted. 29 tests in `generator.test.ts` fail ("carving only removes wood") | randomise within the kind; use the envelope invariant the spec already plans |
| Old saves | Open unchanged: `normalise` defaults Kind to Turned and the rest to 0 | none |

### 4. Is a "Kind of wand" picker needed?

**Yes.** That's less because the two kinds clash on screen and more because
the controls stop meaning anything. The Branch profile has no turned beads or
collar, so Handle style (with its turned thumbnails), Ring and the handle
Pattern do nothing on it (`controls-handle-thumbs`). Showing all of them plus
four branch controls on every wand takes the panel from five groups to six,
with dead controls. The mix itself is not ugly: a turned, ringed handle on a
bent, knotted shaft (a9) reads as a carved handle on a grown shaft. That
argues for leaving a door open, not for showing everything at once. Turned
wands stay straight. Branch gets its own defaults (a4-like) and controls.

**Seeding.** The same params must give the same wand, but hashing the other
params would grow a different branch whenever the colour changed. The spike
uses an explicit `branchSeed` param ("Which branch"). For a kid it fits better
as a "Find another branch" button than as a 0-99 slider.

**Recommended shape for 05**: see the rewritten ticket.

## Comments
