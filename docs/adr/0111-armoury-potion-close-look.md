# 0111 - armoury potion close look: the hold, the slosh and the show's seams

- **Status:** Accepted (ticket 14; ticket 15 completes it with the uncorking and its effects)
- **Date:** 2026-11-14
- **Related:** [ADR 0105](0105-armoury-upright-items-on-the-stage-rigs.md) (the upright hold),
  [ADR 0107](0107-armoury-bottle-generator.md) (the tipped level table, "The stage's level seam"),
  [ADR 0109](0109-armoury-potion-look.md) (the liquid's `setSurface`),
  [ADR 0113](0113-armoury-three-ingredients-that-mix.md) (the show on arrival, the reveal timer).

## Context

The close look lifts the bottle, plays the show on arrival (E13 to E15) and leaves the bottle to
free play between shows: a drag leans it (up to 60 degrees) and tips it (up to 45), and it rights
itself when let go. The liquid must stay level as the glass turns, every band keeping its volume,
and slosh when the bottle moves, then settle; under reduced motion it stays level and still.

ADR 0105 built the hold: for `flourishSeconds` after every flourish the rig eases an upright item
upright (`uprightFlourishWeight`), because the show comes out of the neck and must stay in its box
above it on screen. With the show now playing on arrival, that hold meant a child's first drag after
the lift did nothing for about 4 seconds (longer when shader compiling delayed the arrival): the
drag accumulated under a weight of 0 and the bottle was back upright by the time the hold let go.

## Decision

### The hold yields to a finger, and comes back when it lets go

- A drag past the tap slop during a flourish **takes** the bottle from the hold at once: the hold's
  weight is 0 while that finger is down. The pose the drag starts from is the pose as drawn
  (`takeFromHold`: the lean and tip scaled by `1 - weight`), so nothing jumps when a child grabs a
  bottle the hold is easing upright.
- When the finger lets go before the flourish ends, the hold comes **back** over 0.3 s from that
  moment (`uprightFlourishWeight(..., back)`, the seconds into the flourish it was let go), at once
  under reduced motion. The bottle is then upright for the rest of the show, as ADR 0105 wants, and
  the spring keeps running underneath.
- A drag in progress when a flourish starts (the arrival, while the finger is still down from the
  rise) keeps the bottle: that flourish starts taken.
- A tap (a replay) restarts the flourish untaken, as before.
- Nothing about the show's timing changes. The shell's reveal timer (the potion mixes 1.9 s after
  the show starts, 0.3 s under reduced motion) is in the shell and never reads the pose, so a drag
  neither delays nor hurries it. A tap during a show restarts both, as before.

Other options weighed: shortening the hold leaves a dead window, just a shorter one; taking drags
only once the bottle has risen is what the rig already did (the dead time was the hold, not the
rise); ending the hold for the rest of the show on the first drag leaves the effect (ticket 15) to
come out of a bottle the child has let go of mid-swing.

### The slosh (`stage/slosh.ts`, pure and tested)

- The liquid surface's tilt from level is a damped pendulum per axis (about the up frame's x, the
  tip, and z, the lean): one swing there and back in 0.6 s, damping ratio 0.3, stepped exactly so it
  is the same at any frame rate. After a flick it swings back past level once or twice and is within
  half a degree of level in about 1.3 s.
- It is pushed by how fast the bottle turns against the up frame (`spinBetween` of the bottle's
  turn last frame and this one, read from a marker group inside the held bottle, no rig change): the
  surface's rest is `-0.045` radians per rad/s of turn, so it leans against the turn, as the liquid
  below the grip is swung the other way about the hand and piles against the wall that pushes it.
  The turn about the vertical is ignored (it does not tip a surface), and a turn faster than 5 rad/s
  counts as 5, so a jumpy frame or a stalled one (dt capped at 0.05 s, as the rig's) cannot fling it.
- The tilt shown is eased into 12 degrees (`12 * tanh(m / 12)`), never past it, so the surface never
  flips. Shaken as hard as a finger can for 20 s, it never moves more than 3 degrees in a frame.
- It drives the liquid only through the seam ADR 0107 and ADR 0109 left: one mutable `Vector3`
  written each frame and passed as `surfaceNormal` (a direction in the rig's up frame, +y level),
  with `upFrom={up}` kept and no `levels` passed. The mesh composes it with the bottle's turn and
  looks the band tops up in the level table built with the mesh, so every band keeps its volume at
  the sloshed tilt too (by the table's 2 percent); nothing here replaces the level maths. The bottle's
  tilt is at most about 68 degrees and the wobble 12, so the table (to 90) always covers it.
- No travelling wave: the liquid's material takes no wave amplitude, so the slosh is the surface's
  tilt only.
- **Reduced motion:** the step resets the state and the normal is exactly +y: the surface is level
  with the world and still, whatever the bottle does.
- **The mix.** The slosh's state lives in the close look's stage, not in the mesh or the spec, so it
  carries on unchanged when `mixed` flips mid-show; the levels come from the table for the spec's
  volume, which mixing does not change.

### The shots script

`--settle=<ms,...>` shoots each lean and tip again that many milliseconds of motion after its
release, the stage held still at that moment on a motion clock (each frame's time capped at 0.05 s,
as the rig and the slosh step it, so a frame stalled by a screenshot does not skip the settle);
the pose and the surface's wobble land beside them. `--early=<s>` starts the first drag that many
seconds into the arrival show. A potion takes `--flourish` and `--glints` (a glint's tap replays
the show) in place of its close frames. `--views` takes `narrow` (900x900) and `small` (360x640).

## Consequences

- A child's first drag always moves the bottle, even in the first second of the show.
- **For ticket 23 (the mix, the swirl, the show's clock):** the show is timed from `flourishAt`
  (the rig's clock time of the latest flourish). The rig's upright weight is the one place the show
  holds the bottle; a lift beat (rise a little more) is a position offset on top and can play under
  a drag. A show longer than 4 s sets `flourishSeconds` in `potionHeldItem` to match. The swirl is
  a shading change and needs nothing from the slosh: the surface normal stays the one seam.
- **For ticket 15 (the uncorking and its effects):** a child holding a drag during the pop tips the
  effect's box with the bottle; let go, the hold brings the bottle upright within 0.3 s. Effects
  should stay correct (in their box, on screen) at a lean, not assume upright.
- The wand and the sword give no outline and no upright hold, so none of this reaches them; their
  pixels are re-diffed against the ticket 04 baseline.
