# 05 - Branch wands: bent spine, organic noise, knots

**Status:** ready-for-human
**Type:** task
**Spec:** [../spec.md](../spec.md)
Blocked by: 04 (sequencing: gems must bend too)

The first wand that isn't a straight turned stick. Rewritten from
[02's Answer](02-branch-spike.md#answer). The spike branch
`spike/armoury-branch` has working code for every piece below
(`wand/geometry.ts`: `spineOffset`, `spineFrame`, `lumpAt`, `knotAt`;
`wand/compile.ts`: `branchProfile`, `compileBranch`). Read it, then write it
again test-first. Don't merge it.

Ed answered the three questions on 2026-11-09 (see "Decisions" below); the
bullets under "What to build" include them.

## What to build

- **A "Kind of wand" picker** at the top of the panel: Turned (today's wand,
  always straight) and Branch. Old saves and links open as Turned (`normalise`
  default). "Try another" keeps the current kind and randomises within it.
- **Branch profile** in `compile.ts`: no turned beads and no collar. A natural
  taper, thickest at the butt, with a slight swell where the hand goes. End
  and tip shapes still apply.
- **"Handle: grown / turned"** on a Branch (Ed's decision 1). Grown is the
  natural profile above, and hides the controls that do nothing on it: Handle
  style (and its turned thumbnails), Ring and the handle Pattern. Turned brings
  those back: the turned handle and ring, then a natural shaft.
- **No shaft carving on a Branch** (Ed's decision 2): hide the grooves and
  spirals and their controls, and build none. 01's bumps stay available.
- **Branch controls** in one group (the panel needs a `GROUPS` entry in
  `shop/controls/groups.ts`, or the group never shows):
  - **How bent**: a bow, up to 7% of the length sideways.
  - **How wiggly**: 3 wiggles of frequency 2-5 along the wand, amplitude
    `0.03 L * (2/f)^2` so each frequency bends equally hard. They fade in
    with a smoothstep over the first 40%, so the handle stays true.
  - **Lumpy**: low-frequency radius noise, periodic in angle. Cap it at about
    7% of the radius; the spike's 14% looked melted.
  - **Knots**: 0 to about 6, jittered along 10-82% of the length. Make them
    smaller below the grip, because full-size knots at the butt read as blobs.
  - **Which branch**: the spike's 0-99 slider (Ed's decision 3), not a reroll
    button. It is the seed below.
- **Spine, applied after building** (the spec's decision, confirmed by 02):
  - Build the straight rings, then carry each ring onto the spine frame at its
    z. Do this *before* the normal pass, so normals come out right without
    extra work. UVs stay in straight space, so the grain follows the bend.
  - Subtract the straight line between the spine's ends, so pommel and tip
    stay on the axis. That's why the box, wave, tip glow and share picture
    need no changes.
  - Use only smooth functions with bounded curvature. No `u^p` with p < 2 at
    the ends, and no `min`/`max` envelopes: the spike found both fold the
    inside of the bend.
- **Lumps and knots live in `radiusAt`** because they change the radius.
  `depthNorm` clamps at 0, because they add wood.
- **Knots pool stain.** Each knot gets a dark heart and a stained rim around
  its boss, through the `stain` and `shade` attributes. Without this a knot
  reads as a lump of putty (02, shots a7 vs a8). Ship it on; it isn't a control.
- **Same params, same wand.** Seed the branch from an explicit param that
  `normalise` fills in, not from a hash of the other params. A hash would grow
  a new branch whenever the colour changed.
- **Everything else bends with it**: grooves, nodes (01), material zones (03)
  and gems (04) are authored straight and placed through `spineFrame`.
- **Downstream fixes** (all from 02's table; everything else was checked and
  holds):
  - Size the close look's hit box from the bent mesh's bounds. At 38cm, slim
    0.85 and full bend, the bow reaches 28.4mm against a 28mm half-girth.
  - Optional: aim the spell burst along the spine's tip tangent. The tip leans
    up to 23 degrees, and the burst currently fires along the chord.
- Benchmarks: Bellatrix (02's a4 is close already), Harry's handle, Neville's
  handle, Dumbledore (with 01's nodes), c1 (with 04's gems), c4.

## Decisions

Ed, 2026-11-09, on the three questions this ticket raised:

1. **A Branch can have a turned handle**: a "Handle: grown / turned" choice.
   Turned brings back the turned handle styles on a natural shaft (the spike's
   a9, and Neville's handle).
2. **Shaft carving is hidden on a Branch.** Grooves and spirals go; 01's bumps
   stay available.
3. **A kid gets a different branch with the spike's 0-99 "Which branch"
   slider**, not a reroll button.

## Done when

- Unit tests:
  - The bent mesh is finite and sealed, and its ends are on the axis.
  - Across length 28-38, bend 0-1, wiggle 0-1 and many seeds, the tightest
    bend radius stays above the local wand radius with margin (the spike's
    `branchSpike.test.ts` measures this: 1.74x).
  - The same params give the same wand.
  - The generator tests' "carving only removes wood" becomes the envelope
    invariant, with knots and lumps inside it.
- iwft covers the kind picker, the hidden controls for Branch, "Try another"
  keeping the kind, and that old saves open as Turned.
- Ed has rolled branch wands on a real GPU and they read as wood, not tubing.
  Glossy stained branches look lacquered, so check the finish by eye.
- Verify loop green. ADR for the spine model and the kind picker.

## Comments

**2026-11-09, agent (built):** Built on branch `armoury-variety-05-branch-wands`
(chained on 04's branch); decisions in ADR 0084. Needs Ed's eye on a real GPU,
including a few Try another rolls on a Branch, before merging.

- "Kind of wand" (Turned, Branch) sits above the groups on desktop and phone. It is
  a schema param in its own `kind` group; Try another always keeps it by locking that
  group in the workbench. Old saves open as Turned (iwft).
- "The branch" group (iii., tab "Branch") shows only on a Branch: How bent, How
  wiggly, Lumpy, Knots (0-6), Which branch (0-99). Group numerals count the groups
  shown. Its defaults are the spike's a4-like branch, so switching to Branch shows a
  branch at once; a Turned wand ignores them.
- "Grown or turned" in the handle group. Grown hides Handle, Pattern, Ring and "Ring
  made of"; Turned brings them back, with a natural shaft tapering straight from the
  ring. Shaft carving and its controls hide on any Branch; bumps stay.
- The spine, lumps and knots follow the spike's recipe, rebuilt test-first. Knot height
  is a fraction of the local radius, so knots and lumps sit inside the envelope (the
  generator tests now include gnarled branches of both handles). Knots stay off gem
  seats and bands.
- Gems, the crystal (on the spine's tangent) and the orb ride the bend; the tip glow
  and spell aim along the tip's tangent; the close look's hit box is sized from
  `reachMm`.
- A Branch is named "The ... Branch". New preset "Blackthorn".
- Bend safety: across 28-38 cm, slim to chunky, bend and wiggle 0-1 and twelve seeds,
  the tightest bend radius is at least 3.0x the widest surface radius there.

Deviations:
- Wiggle amplitude is 0.022 L, not 0.03 L: at full wiggle on a 38 cm wand the
  spike's read as a snake (`shots/05/r1/b6*` vs `r2/b6*`).
- A stained Branch is matte: stain lowers roughness by 15% (45% on a turned wand)
  from a base of 0.72 (0.62). Round 1 looked lacquered.

GPU shots (headless Chromium, ANGLE Metal) in `shots/05/`: `r2/` is final (box shots
of eleven branches, close look, spell, zoom and share picture for b1, b7, b9 and b10 (gems, metal, bumps); a phone
page in `r2/phone/`). `r1/` is before the wiggle and gloss changes.

Not done / for later:
- The box shadow is still a straight blur.

**2026-11-09, agent (review round 1 follow-ups):**
- Build time: the mesh loop writes positions from the frame's scalars, works out
  bands, growth and lump phases once per ring, and allocates nothing per vertex
  (`settingAt` and the knot sum write into reused scratch). Reading the frame's
  arrays per vertex had made V8 deoptimise the loop, which also slowed turned wands
  once any branch was built. In a quiet moment: turned 12.5 ms (04: 17 ms), branch
  27 ms, turned after a branch 12.6 ms. Under load the ratios hold (turned at or
  under 04, branch about 1.2-2x turned). ADR 0084 corrected.
- The tip glow, spell and close-look wave trail sit on `tipPose`: the crystal's
  point when there is one, aimed along it. Tested.
- Wiggles grow in from `branch.from`, so a turned handle on a Branch stays straight
  (within 1 mm, tested; only the bow passes through it).
- Phone: the kind picker's label sits beside its pills, and the tab row fades at
  its right edge to show it scrolls (`shots/05/r3/phone/`). "Grown or turned" stays.
- Nits: the branch end test only checks the ends are on the axis; the fold test runs
  all 100 branches of the chunkiest wand, both handles, on the spine alone (worst
  3.07x); the workbench kind test uses one seed per kind.
- Shots in `shots/05/r3/`: a 38 cm full-bend branch with a crystal (glow on its
  point) and the turned handle.
