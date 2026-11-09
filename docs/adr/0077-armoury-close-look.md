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
  fades in briefly, and the wand doesn't idle-roll or sparkle.
