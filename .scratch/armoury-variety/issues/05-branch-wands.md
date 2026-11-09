# 05 - Branch wands: bent spine, organic noise, knots

**Status:** ready-for-agent
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
