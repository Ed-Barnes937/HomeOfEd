# 07 - Branch wood: matte grain, stain that soaks in, bark

**Status:** in-progress
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
