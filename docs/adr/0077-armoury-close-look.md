# 0077 - armoury lifts the wand out for a close look

- **Status:** Accepted
- **Date:** 2026-11-08
- **Related:** [ADR 0073](0073-armoury-wand-shop.md) (amends "The box drives the
  wand"), the prototype's free-orbit stage in `~/Code/Playground/ideas/armoury`.

## Context

Seen from above in its box, the wand is small and only rolls about its length.
The prototype let a child turn the wand freely in 3D, and that was the part
that made it feel like a real object. Ed asked for tapping the wand to darken
the shop and bring the wand up to the middle of the screen, where it can be
turned and waved.

## Decision

**A tap lifts the wand.** Tapping the box (or Enter/Space on it) opens the
close look: the shop dims, the wand rises out of its box to the middle of the
screen and casts a spell as it arrives. A drag along the box still rolls the
wand in place. Up close, a tap on the wand (or "Wave it") casts again; "Put it
back", Escape or a tap on the dark flies it back into the box.

**A native modal `<dialog>`.** `showModal()` gives the focus trap, Escape, an
inert shop behind and focus back on the box afterwards, without hand-rolled
equivalents. Escape is intercepted so the wand flies back before the dialog
closes.

**A second canvas, handed off seamlessly.** The close look is its own
full-screen canvas (`CloseUpStage`) rather than one canvas spanning the page,
which would have to sit above the panel and phone sheet. To make the change of
canvas invisible, the close stage starts the wand exactly where it lay: the
shop passes the box stage's screen rect and roll (`BoxPose`), the close stage
converts the box's top-down view into its own (same field of view, the box's
world turned about the wand's length, and the lights turned with it) and only
then flies the wand to the middle. The box shows empty only once the close
stage has drawn its first frame (`onLift`), so a slow first canvas never leaves
a gap. Putting it back runs the same flight in reverse, re-reading the box's
rect, and the dialog closes once the wand is lying in the box again. Both stages
come from the one lazy three.js chunk; `StageContext` now carries both (`Stages`)
and the `.iwft` harness passes fakes for both.

**Turning like a pencil under a finger.** A drag across the wand rolls it about
its length; a drag along it swings the tip towards or away from the viewer. A
flick carries on and slows; a wheel or pinch zooms within limits. A free
trackball was tried first, but combined drags stood the wand on end and off the
screen. Roll and swing keep it in frame and still show every side and both
ends. Until first touched, the wand rolls slowly by itself.

**A wave is a figure of 8, drawn out in front.** Casting (the arrival, a tap or
"Wave it") waves the wand before the spell leaves it, turning it only about the
grip (a fifth of the way up from the pommel, where a hand would hold it): the
tip turns away from the viewer, diagonally into the scene, draws one slow figure
of 8 there over 2s, and the spell bursts out as the 8 closes, 2.5s after the
wave starts (`WAVE_TO_SPELL_SECONDS`, which the shop's flash waits for too). The
wand then settles back to where the child left it. A streak of light follows
the tip through the 8, so the shape shows even in a still frame. The 8 turns
about the screen's own vertical and horizontal axes, so it reads as side to side
whether the wand is held level (landscape) or upright (portrait). It is wide,
sweeping the tip across about two fifths of a laptop screen, and shrinks to keep
the tip clear of the header and the caption on a narrow phone or a zoomed-in
wand (`fitWave`, which projects the 8 through the camera each frame).

Earlier versions were rejected by eye. The first drew the 8 across the screen
with the wand sliding along its length, which was too fast and read as the wand
flying off to the side. The second turned only about the grip but drew a small
8 in 1.2s and ended in a flick forward and down; the flick muddied the 8 and the
8 was too small to read. The wave is a pure function of time (`wave.ts`),
unit-tested to start and end at rest, never jump, stay aimed away while drawing
a real 8 over at least 2s, cast as it closes and only settle afterwards, and to
fit the tip on laptop, tablet and phone screens in both orientations.

**Held framing.** Landscape holds the wand nearly level with a slight lift to
the tip; portrait holds it nearly upright, so it is as large as the screen
allows, leaving the lower part for its name, tag line and buttons.

## Consequences

- Two WebGL contexts exist while the close look is open. Textures and the HDRI
  are shared through the loader cache, so the second canvas costs a shader
  compile, not a download.
- The box no longer casts on a tap; spells and the shop's flash live in the
  close look. `StageHandle` loses `cast`.
- With reduced motion the wand appears and returns without flying, the shop
  fades in briefly, and the wand doesn't idle-roll, wave or sparkle; the tip
  flares at once.
- Building the wave's streak exposed that R3F 9.8 copies each uniform given to
  `<shaderMaterial uniforms>`, so numbers written to them later never reach the
  GPU. The tip's sparkles had been frozen and the spell burst had never drawn.
  The glowing point effects now build their material once (`stage/glow.ts`).
- The box's cool rim light, from behind the wand, fades out as the wand rises.
  Up close, a wand aimed into the scene (by the wave or a swing) caught it at a
  grazing angle along its whole length and turned silver.
