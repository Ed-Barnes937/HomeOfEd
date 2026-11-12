# 0100 - armoury sword close look and shared stage rigs

- **Status:** Accepted
- **Date:** 2026-11-11
- **Related:** [ADR 0077](0077-armoury-close-look.md) (the wand's close look, its rise and wave),
  [ADR 0082](0082-armoury-material-zones.md) and [ADR 0083](0083-armoury-glowing-gems.md) (the
  bloom cap at rest), [ADR 0099](0099-armoury-smithy-stage.md) (the smithy's canvas, light and
  materials), [ADR 0101](0101-armoury-smithy-scene-tag-and-picture.md) (the anvil scene).

## Context

A second item kind needs the same box stage and the same close look as the wand: lift out of
its box (or off the anvil) without a jump, turn under a finger, zoom, a show-off move on arrival
and on each tap, and a flight back. The close look's gesture and flight code is about 300 lines
and was tuned by eye over several rounds. The owner's brief for the sword's moment (decision
E3) is "slow flourish, a glint runs up the edge, then runes or the fuller glow", kept subtle and
realistic. At rest, nothing on either item may bloom (ADR 0082, 0083; decision O5).

## Decision

### Shared rigs, not a copy

- `stage/boxRig.tsx` (`Framing`, `Roller`, `Bridge`, `captureScene`) and `stage/HeldRig.tsx`
  (the lift, the hold, the gestures, the flourish clock, the flight back) serve both kinds.
  Copying `CloseUpStage.tsx` for the sword was rejected: every gesture or flight fix would be
  needed twice.
- `HeldRig` is parameterised by a `HeldItem`: `lengthMm`, the `tip` a trail streams from, the
  `hit` box a tap must land in, the `grip` it turns about, `flourishScale` (stretches the figure
  of 8 in time; 1 is the wand's), `trailColour` (null for none) and `boxHalfWidth` (so the lift
  starts at the size the item lay). The item's own lights, environment and effects are props;
  the rig turns the lights with the rise and fades the rim. Children receive the clock time of
  the latest flourish and draw the item from it.
- `wave.ts` stays a pure function of time, fitted to the screen by `fitWave`; the rig scales its
  clock, never its shape.
- Stage changes are judged on a real GPU with `scripts/gpu-shots.mjs` (ANGLE Metal only), by a
  reviewer who did not build them, and the wand's frames are pixel-diffed against the ticket 02
  baseline after any change to a shared rig.
- For the sword's close look, a dev-only probe (compiled out of production) publishes how far
  into the flourish the stage is and, on the script's request, pins the stage's clock to an
  exact moment and stops drawing until the shot is taken. The rig's pose, the glow and the
  presenting turn all read that one clock, so each frame lands exactly on its label however
  slow the screenshot is.

### The sword's close look

- The sword's `HeldItem`: `grip = spec.gripAt`, `flourishScale = 1.5`, no trail, and
  `boxHalfWidth = SWORD_HALF_WIDTH / boxScale(lengthMm)` so a sword drawn larger on the anvil
  (decision O3) rises from exactly where and how big it lay. `fitWave` keeps the tip in frame,
  so a greatsword's 8 shrinks and a dagger's does not.
- One flourish: `wavePose(t / 1.5)`, so aim 0.75 s, a slow figure of 8 3.0 s, settle 1.05 s,
  4.8 s in all; on arrival and on each tap, as the wand's wave. No spell, burst, trail or shop
  flash (`flashDelaySeconds: null`).
- `stage/swordGlow.ts` is a pure clock, unit-tested with given times:
  `swordGlow(sinceFlourish, reducedMotion, wakeFrom)` returns `glintAt`, `glint`, `runes`,
  `wake`, `cap` and `gems`.
  - **Glint**: starts as the 8 closes (3.75 s) and runs once, guard to tip, over 0.6 s; its
    strength is `sin(pi u)`, so it fades in and out. The blade shader adds a band about 5% of
    the blade long with soft (Gaussian) ends at `aAlong == glintAt`, on the edge bevel only
    (`aEdge`), in the window's cool white at 1.5x the bloom threshold at its height. A
    two-edged blade glints only on the edge that lies toward the window (up and right) on
    screen, found from the screen gradient of the blade's across coordinate, so a flat held
    square to the viewer still lights one edge. A single-edged blade glints on its cutting edge
    only, never on its back, even where a flared Sabre's back is sharpened (`glintEdge`, pure
    and tested). No tip star.
  - **Rune wake**: begins as the glint reaches the runes (`wakeFrom`, where they start along the
    blade). The runes rise from rest (0.9 times their colour) to 1.3x the threshold over 0.6 s
    with a smoothstep, hold 0.6 s, and settle back over 1.5 s with a smoothstep; never linear,
    never flickering. They light from the guard outward (`wake`, a soft front through the rune
    band), and their cores pale as they heat. The fuller's floor round runes that sit in it
    picks up a faint light in their colour (0.2 times a blurred read of the glyph mask, fading
    past the band's ends, so it pools round the glyphs); a fuller with no runes in it never
    glows. A sword with neither runes nor gems gets the glint alone.
  - **Gems** catch the light as the glint leaves the guard (a 0.3 s rise and fall to 2.2 times
    their rest glow), then glow with the wake.
- **Presenting the flat**: from 0.75 s before the glint until the wake has peaked, the close
  look rolls the sword about its length so a flat faces the viewer, whichever way the idle roll
  or the child left it, then lets go over 0.8 s and keeps the roll it added, so nothing turns
  back (`presentWeight`, pure and tested). It shows the nearer flat, or the face a gem is set
  in when the gems sit on one face only (`presentedFace`), so the gems' catch is seen. Without it the idle roll left the blade edge-on as
  the runes woke.
  - A tap mid-wake starts a new flourish without dropping the glow: the stage shows the brighter
    of the two flourishes' light.
- The hooks are uniforms written through the material each frame (`SwordMesh` takes the
  flourish time; the anvil passes none and never writes them). At rest every hook is an exact
  no-op, proved by pixel-diffing box and reduced-motion close frames before and after: max 0
  on swords without runes. Rune and engraving masks are now read before their bounds test (a
  mipmapped read inside a per-pixel branch picked a wrong level at the band's edge), which
  removes a faint seam along the rune band at rest; that seam is the only at-rest change.

### The bloom exception (decision O5)

ADR 0082 caps every surface at `0.92 * BLOOM_THRESHOLD` and ADR 0083 lets only the wand's gems
and spell past it. The sword's close look adds one bounded exception:

- **What and where**: only pixels on the glint's band on the edge bevel, and only pixels inside
  the rune channels as the wake reaches them. The blade's cap is lifted per pixel by how much
  of the glint or of a lit rune is there; the flat, the fittings and the grip keep the rest cap
  throughout. Gems' cap rises with the wake to 1.4x the threshold.
- **How far**: the glint's cap reaches at most 2x the threshold; a waking rune's at most 1.4x,
  so only the hottest centres of the glyphs bloom.
- **How long**: the glint for 0.6 s from 3.75 s after the flourish; the gems' catch for 0.3 s
  from then; the wake for at most 2.7 s after the glint reaches the runes. Everything is back at the rest cap 7.05 s after a
  flourish. Only in the close look; the anvil, the picture and the shelf never lift the cap.

### Reduced motion

The rig does not flourish, idle or fly (ADR 0077); `swordGlow` returns the rest values and
`presentWeight` 0 for every time, so there is no travelling glint, no presenting roll, and the
runes and gems hold their resting glow. The sword simply appears lifted and goes back.

### The anvil at rest

The smithy's light pool on the anvil is always the forge's ember, never the sword's glow
colour, so a rune sword shows no coloured halo at rest.

## Consequences

- A new item kind gets a close look by writing a `HeldItem` and a mesh; it inherits every
  gesture and flight fix.
- The glint and wake numbers live in `swordGlow.ts` and `SwordMesh.tsx`; changing them is a GPU
  gate, not a unit test, as the tests prove timing and bounds, never the look.
- The wand's close look is unchanged: its `HeldItem` has `flourishScale: 1` and its trail.
