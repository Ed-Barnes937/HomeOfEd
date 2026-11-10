# 0091 - armoury branch wood: a matte raw-wood finish, and bark

- **Status:** Proposed
- **Date:** 2026-11-09
- **Related:** [ADR 0084](0084-armoury-branch-wands.md) (branch wands; this replaces
  its "a stained Branch is matte" bullet), [ADR 0082](0082-armoury-material-zones.md)
  (zones, the wood shader), [ADR 0090](0090-armoury-raised-features.md) (the envelope,
  weighted choices), [ADR 0074](0074-armoury-save-format.md) (new params default so old
  saves open), `.scratch/armoury-variety/` ticket 07.

## Context

On a real GPU, Ed found branch wands "back to rather glossy" and the dye not doing
much. Ticket 05 had already made a Branch "matte": a rougher base (0.72 against
0.62) and a stain that lowered roughness by 15% instead of 45%. That change was
still in place after the merges; it was never enough.

The cause is how three.js uses a roughness map: it multiplies the material's
roughness by the map's green channel. The wood scans' roughness maps average 0.53
(oak) to 0.77 (maple), so a "0.72" branch actually rendered at 0.33-0.55, a
satin-to-gloss finish, and 05's change moved that by about 0.05. Under the key
light and the studio HDRI, that sheen washed a dye's colour out to the light's.

Branches also wanted bark, which Ed asked for as a None / Patches / Full choice.

## Decision

- **A Branch is raw wood.** Its roughness is set directly, not multiplied: 0.7,
  moved up and down by the roughness map's variation about its own mean (`rough`
  per wood in `WOODS`, measured from the scans), so it follows the grain, plus a
  little from pores and fibres; clamped to 0.5-0.92. A stain no longer lowers it.
- **Stain soaks in harder on a Branch.** Raw wood drinks more dye than oiled wood:
  a full coat absorbs more (hue weight 1.6, darkness 0.55, against 1.2 and 0.45 on a
  turned wand), and the darker open grain soaks up to 2.6 times as much as the
  dense wood between (2.0 on a turned wand). Pores take extra.
- **Pores and fibres** are drawn in the shader from the mesh's straight-space UVs,
  in mm: short dark dashes along the grain and fine streaks, in colour, roughness
  and bump. They fade to their average where a pixel covers several, so they never
  shimmer. Each wood has its own pore strength (oak 1, walnut 0.8, cherry 0.5,
  maple 0.35).
- **Turned wands keep their polished finish.** Their roughness, gloss and dye are
  unchanged; they only gain the pores and fibres at half strength. This is a small
  change of character, visible in the close look's zoom.
- **Bark** is a choice in "The branch": None, Patches or Full. A wand switched to
  Branch in the Kind picker starts with Patches (the workbench sets it); the schema
  default stays None, so old saves and links open bare. A Turned wand compiles no
  bark whatever the param says. Try another on a Branch rolls it 3 : 3 : 2.
- **Where bark grows** is decided in `geometry.ts`, in straight (angle, z) space, so
  it bends with the spine like everything else:
  - Full covers the wood; Patches is low-frequency noise, about half the surface.
    Both are roughened by noise stretched along the grain, so a patch tears along
    the wood.
  - A grown handle is worn bare up to about 24% of the length, with a ragged edge.
    A turned handle has none; bark starts just past its ring.
  - It stays off every zone (metal, paint, bone) with 1 mm to spare, gem seats,
    engravings, knot bosses and the last 8-14 mm of the tip.
  - It is seeded from "Which branch" through its own random stream, so changing
    the knots, lumps, bend or colour never moves it.
- **What bark is**: up to 8.5% of the local radius proud, cut by furrows (noise
  isolines stretched along the wand and drifting sideways, so they meet and part)
  down to 15% of that. Furrows are shaded darker. Kept off knot bosses, it stays
  inside the ADR 0090 envelope: lumps 7%, a knot's skirt about 4%, bark 8.5%.
- **What bark looks like**: a darker colour per wood (`bark` in `WOODS`), mottled,
  with stringy streaks along the grain and lenticels, short pale dashes across it;
  roughness 0.93; its own bump.
- **Bark takes little stain**: 20% of what bare wood takes, up to 60% in its
  furrows.

## Consequences

- A bare stained branch reads as matte wood with the dye in its grain, and stains
  look different from one another. Very dark stains on walnut give a near-black,
  flat branch; that's what the colours ask for.
- Bark adds about 40-50% to a branch's mesh build (measured in Node on a busy
  machine: bare branch 28 ms, patches 38 ms, full 42 ms, turned 15 ms).
- The share picture and the shelf need nothing new: the picture renders through the
  same shader, and the shelf draws no wand.
- Before/after shots, on a real GPU (Apple M3 Pro, ANGLE Metal), are in
  `.scratch/armoury-variety/shots/07/`.
