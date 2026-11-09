# 07 - Branch wood: matte grain, stain that soaks in, bark

**Status:** ready-for-human
**Type:** task
**Spec:** [../spec.md](../spec.md)
Blocked by: 06 (sequencing)

Ed, after looking at branch wands on a real GPU: "we seem to be back to rather
glossy materials and the dye doesn't seem to do a huge amount". Ticket 05
claimed to have made stained branches matte, so something regressed or was
never enough.

## What to build

1. **Diagnose the gloss first.** Reproduce what Ed sees: headless GPU shots of
   branch wands, plain and stained, close look and box. Find where the shine
   comes from: roughness, clearcoat, env map intensity, the 03 zone shader, or
   a merge that lost 05's matte change. Record the cause in Comments.
2. **Make branch wood read as real wood.**
   - Matte, with roughness varying along the grain.
   - Stain that clearly soaks in: darker in open grain, pooling in knots and
     cracks, visibly different between stains.
   - Fine fibre and pore detail.
   - Check that turned wands don't regress. If a fix helps both kinds, apply
     it to both, but don't change turned wands' character without saying so.
3. **A "Bark" choice for Branch wands only: None / Patches / Full.**
   - Bark is rough, cracked and darker. It sits slightly proud in the radius
     field, within the ADR 0081 envelope, and bends with the spine.
   - Bare wood is worn through on the handle where a hand grips.
   - Stain mostly affects bare wood. Bark takes only a little.
   - Bark avoids metal zones, gems and engravings.
   - "Try another" uses option weights.
   - Old saves and Turned wands get None.
   - Make it deterministic from the branch seed.

## Done when

- Unit tests cover bark compilation, the envelope, determinism, and old saves
  getting None. An iwft covers the Bark control showing on a Branch only.
- There are before/after headless GPU shots of the gloss fix and each bark
  setting with 2-3 stains.
- Ed has looked on a real GPU.
- The verify loop is green.
- ADR 0086 records the material retune and the bark model.

## Comments

**2026-11-09, agent (built):** On branch `armoury-variety-07-branch-wood` (chained
on 06); decisions in ADR 0086. Needs Ed's eye on a real GPU before merging.

Gloss, the cause: not a merge. 05's change (base roughness 0.72, stain gloss 0.15)
was still there, but three.js _multiplies_ the material's roughness by the roughness
map's green channel, and the wood scans' maps average 0.53 (oak) to 0.77 (maple). So a
"0.72" branch rendered at 0.33-0.55, a satin-to-gloss finish, and 05 only moved it by
about 0.05. The sheen also washed a dye's colour out towards the light's, which is a
good part of "the dye doesn't do a huge amount". Reproduced in `shots/07/before/`.

What changed:

- A Branch's roughness is now set directly: 0.7, varied by the map about its own
  mean so it follows the grain, plus pores and fibres; 0.5-0.92. A stain no longer
  makes it shinier.
- Dye on a Branch absorbs harder (raw wood drinks more) and soaks more into the open
  grain and pores, so stains look different from each other.
- Pores and fibres in the shader, per wood (oak strongest, maple faintest), faded
  where finer than a pixel.
- Turned wands keep their roughness, gloss and dye; they gain pores and fibres at
  half strength only (a small change, visible in the zoom; `t_*` shots).
- "Bark" in The branch group: None / Patches / Full, weights 3 : 3 : 2, old saves and
  Turned wands None. Furrowed, proud by up to 8.5% of the radius, worn bare with a
  ragged edge on a grown handle's grip, absent on a turned handle, off zones, gems,
  engravings, knot bosses and the tip. Takes 20% of the stain (up to 60% in its
  furrows). Seeded from "Which branch" through its own stream.

Deviations:

- Bark started as Voronoi plates (`plates` in an early round); they read as tiles or
  reptile skin, so it is noise stretched along the grain instead (furrows that meet
  and part, patches that tear along the wood).
- Bark adds about 40-50% to a branch's mesh build (full 42 ms against a bare 28 ms
  on a busy machine).

Shots (headless Chromium, ANGLE Metal; gitignored, in this worktree's `shots/07/`):
`gloss-before-after-zoom.png`, `stains-before-after.png` (box, left before),
`stains-close-after.png`, `bark-settings-box.png` (rows oak natural, maple forest,
walnut midnight, cherry ember; columns none, patches, full), and every wand's box,
close look and zoom in `before/` and `after/`. `shots.mjs` retakes them.

Questions for Ed:

- Bark defaults to None, so switching to Branch shows bare wood. Should a new Branch
  (not an old save) start with Patches?
- Smoky on oak is still a quiet stain, because smoky's swatch is close to oak's own
  brown. Is that fine, or should the swatch be darker?
