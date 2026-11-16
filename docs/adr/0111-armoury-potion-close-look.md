# 0111 - armoury potion close look: the hold, the slosh and the show's seams

- **Status:** Accepted (ticket 14; ticket 23 added the mix; ticket 15 completed it with the uncorking and its effects)
- **Date:** 2026-11-14
- **Related:** [ADR 0105](0105-armoury-upright-items-on-the-stage-rigs.md) (the upright hold),
  [ADR 0107](0107-armoury-bottle-generator.md) (the tipped level table, "The stage's level seam"),
  [ADR 0109](0109-armoury-potion-look.md) (the liquid's `setSurface`, no post pass at rest),
  [ADR 0082](0082-armoury-material-zones.md), [ADR 0083](0083-armoury-glowing-gems.md) and
  [ADR 0100](0100-armoury-sword-close-look-and-stage-rigs.md) (the bloom cap and its exceptions),
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

### The mix (ticket 23)

**Two liquid states on one path.** The liquid always carries its layers and, once three are in,
the one liquid they mix into (`setMixed`: `spec.mix`'s colour, its trait and its main ingredient).
One weight, `uMix` (0 the layers, 1 the mix), blends the bands' colour and every trait weight
towards the mix's, after `potionBand`. At rest the weight is the spec's (`mixDrawn`: 1 once `mixed`),
so the box stage, the picture and the close look draw a mixed potion with the same code. A mixed
bottle is not rebuilt as a one-band bottle: its three band tops, its level table and its volume
stay, and the swirl needs both states at once anyway. So `mixed` flipping asks for no new mesh,
and none is built: the build is keyed on everything in the spec but `mixed` (`sameBuild`), in the
mesh and in the close look's held item. Round 1 keyed it on the spec object, and the reveal rebuilt
an identical mesh, level table, mote pool and outline inside the cork's pop: two frames of 67 to
83 ms on a production build at 4x CPU throttle (phone size, 120 Hz), the longest 17 ms since. The
label still redraws as its name changes, once and not twice: the second draw waits for the label's
font only when it is not yet loaded. The liquid's `mixed` is then no longer the built spec's: it is read as
the liquid is drawn (`shownSpec`), from the latest spec while that asks for the built bottle and
otherwise as last shown, so a bottle that turns mixed is mixed in the next frame and one emptied or
poured again keeps its state until its new mesh is in. The box stage hands the mesh its latest spec
in a holder written as the page renders, since the canvas renders a task behind the page; without
it the box showed the layers for a frame after an early close. The mix's glow goes through the same soft cap as a band's; the brightest
glowing mix of the 729 recipes peaks at 0.84 before it, under the 1.288 cap.

**The vortex is a warp, not a simulation.** A second weight (`uVortex`; the ticket's `uSwirl` was
already the marbling trait's own uniform) shifts the height the bands are read at, never the
geometry. A point is twisted about the bottle's axis by `pitch * h + radial * r - spin` (`h` along
the sloshed surface's up, as the bands measure it), and the shift is the twisted point's sideways
place plus a churn of noise, times the swirl and the liquid's depth (`VORTEX`, `vortexShift`). A
level edge becomes a helix whose reach grows until the bands fold over one another into ribbons,
and `spin` turns the whole pattern two turns over the swirl. Only the colour lookup moves, so the
surface stays level and nothing can cross it or the glass at any lean. The liquid mixes unevenly
while it swirls: streaks of it turn to the mix before the rest (`spread`), so the mix grows through
the bands as ribbons, not as a fade; with no vortex (reduced motion) it is a plain cross-fade. On
a replay `uMix` stays 1 and thin streaks let up to `flare` of the wound bands show through, fading
with the vortex. A simulation was not weighed for long: it could not promise to end exactly on the
mixed look at the reveal, nor to draw the same frame twice for a shot, and the warp costs one noise
sample and a sine while it runs and nothing at rest.

**No page clock in it.** The rule ticket 11 learnt twice holds: the vortex reads no page time. The
turn is an added phase, and everything multiplied by a moving span is an envelope from 0 to 1.
`vortexShift` is the shader's twin (the numbers are injected into the GLSL from `VORTEX`), tested
to be the same an hour after the page opened as at its start, and continuous while the surface
sloshes 12 degrees.

**Motes.** Still one draw. As the liquid mixes each mote changes from its band's program to the
mix's (one band from the floor to the top) at its own moment between 0.2 and 0.8 of the mix
(`MOTE_TURN`), faded to nothing within 0.15 of it, so the two programs cross-fade as populations
and no mote is seen to switch. The mix's bubbles are timed on a full bottle's height, three bands,
so they rise at the designed 6 to 12 mm a second, not three times it. The motes are not carried
round by the vortex; the ribbons carry the motion.

**Murk.** A murky mix is milky (`cloud` 0.8) with pale specks (`speck`, the motes' fourth program)
sinking 1.2 to 2.6 mm a second on a fixed length, fading in under the surface and out above the
floor. A marbling under the milk was tried and dropped: it doubled the trait's noise for veins that
barely showed. At the gate the first mud (`#5b5533`, lightness 0.38 to 0.48) was a black bottle in
smoky glass and close to one in violet, and Puddle Jumper, a preset, was exactly that. Three
changes, judged on `shots/23/r2/sheets/01-murky.png`: the mud is lifted to `#706a3d`, chroma at
most 0.065, lightness 0.46 to 0.56 (ADR 0113), still duller and darker than every effect colour;
Puddle Jumper stands in sea glass, a mossy pond; and smoky glass lets 0.62 through, not 0.52 (ADR
0109), since the lifted mud alone was still near black behind it. No preset is in smoky glass now.

**The clock** (`stage/potionShow.ts`, pure). `potionShow(sinceStart, { firstMix, full,
reducedMotion })` gives every beat:

| Beat | Seconds | What moves |
|---|---|---|
| lift | 0 to 0.4 | the bottle rises 6 percent of its height, and holds |
| swirl | 0.4 to 1.6 | the vortex rises over the first 0.36 s and falls over the last 0.48 s; on a first mix `mix` runs 0 to 1 between 0.54 and 1.48 s |
| twist | 1.6 to 1.9 | the stopper turns a quarter turn and works 0.15 of its plug loose |
| pop | 1.9 (`MIX_REVEAL_SECONDS`) | the stopper is out, 1.3 plug depths in 0.2 s, and bobs; `popped` is true until the sink |
| live | to 4.4 | the effect ("The uncorking" below); the stopper hangs aside of the neck and is back above it by 4.4 |
| settle | 4.4 to 4.9 | the stopper goes back and turns back |
| sink | 4.9 to 5.2 | the bottle sinks back to the hold |

Fewer than three: the stopper rattles in its seat for 0.4 s and nothing else moves. Reduced motion:
no lift, no vortex and no turn; `mix` cross-fades in 0.3 s (`MIX_REVEAL_SECONDS_REDUCED`), the
stopper is then shown out without travelling for 0.3 + 1.2 + 0.5 s (the effect's fade, hold and
fade), and is back; 2.3 s in all, and no rattle.

**The player** (`PotionShowPlayer`) is the stage's only state for the show. Every flourish plays a
new one, timed from `flourishAt`, so the pop stays in step with the shell's reveal timer. A tap
mid-show restarts it from what was drawn, eased over 0.3 s: the mix never goes back towards the
layers and the vortex carries on from where it had turned. The params turning `mixed` at the reveal
change nothing in the close look's liquid, which reads the show (`mix` has been 1 since 1.48 s);
the label takes its new name, and the box stage's bottle behind the dialog turns mixed. A put-back eases the show to rest over 0.5 s,
mixed if three were in (the shell mixes the potion on closing), the vortex fading where it stands;
at once under reduced motion. Whether a show is a first mix is decided from the params when its
flourish starts.

**Closing during the lift.** Before the bottle arrives no flourish has started, so the shell has no
timer and the potion stays unmixed. That is kept: the child saw no swirl, and the next tap plays the
first mix.

**The stage.** `flourishSeconds` is the show's length, so the rig's upright hold lasts exactly the
show. The hold's 0.3 s eases fit inside the lift (0.4 s) and are the sink (0.3 s), so
`uprightFlourishWeight` keeps its shape and there is no second hold. The lift is a translation
along the bottle's axis of a group inside the held frame: it plays under a drag and cannot slosh the
liquid. The stopper's lift and turn and the liquid's mix reach the mesh through `{ current }`
holders written in `useFrame`, with no render. `Sloshing` is mounted beside the mesh, outside
anything that changes with `mixed`.

**Cost** (M3, 390x844 at DPR 3, the close look 0.45 to 1.55 s into the show, medians of five; the
machine was under other load). Frame interval with vsync off, ticket 14's method: 1.97 to 2.12 ms
for the first-visit potion and 2.33 to 2.28 ms for a murky round flask, before to after, beside the
wand's 5.9 to 6.2 ms. With a pixel read back each frame, which the wand's post pass stalls under:
5.0 to 5.7 ms before and 6.1 to 6.3 ms after for the first visit, 7.4 before and 7.8 to 8.6 ms
after for the murky flask. The swirl costs about 1 ms at most.

**The shots script** reads the show's length from the stage's probe (`flourishSeconds`) before the
first drag. A full potion mixes 1.9 s into its arrival show whatever the script does (the `--face`
touch was measured: it starts no flourish), so a close frame of three layers is one taken before
the pop; held frames stop the stage's clock but not the shell's timer, so a held frame's label and
shade can show the reveal early.

### The uncorking (ticket 15)

**The window.** The effect lives from the pop (1.9 s, the reveal) until the stopper sets off back
(4.4 s): 2.5 s, `EFFECT_SECONDS`. The clock gives it three numbers. `age` is the seconds since the
pop, from 0 at every pop. `emit` is how much of it shows: up over 0.8 s, fast at first (a third
after 0.1 s), and down over the last 0.35 s. `cap` is the brightest a particle may be. Outside the
window they rest at 0, 0 and the resting cap, and fewer than three ingredients never leave rest.

**Seven kinds, one system** (`stage/effectKinds.ts`, pure and three-free). A kind is a program
`(seed, i, age, strength)` that writes one particle: its place in the neck's frame, its size, its
alpha, a shape code, which of the effect's colours it takes, and whether it has left the neck yet.
The stage has no branch per kind; it draws whatever comes back, and a shape is only how one sprite
is shaded. The seed is the recipe's, so each mix has its own arrangement and a replay repeats it.

| Kind | What its particles do | Particles at strength 1, 2, 3 |
|---|---|---|
| floating | see-through bubbles swell out, drift up and to the sides, wobble, and pop one by one | 7, 11, 15 |
| sparkling | four-pointed glitter on arcs: up, over and down to the lip, twinkling | 110, 190, 280 |
| dreamy | soft five-pointed stars rise slowly, sway, twinkle and fade | 6, 9, 12 |
| glowing | motes spiral out of the neck, slow, and hover, pulsing | 14, 22, 30 |
| whirling | one ribbon: points a few milliseconds apart on one widening helix, longer with strength | 120, 200, 280 |
| whiffy | one puff of 4, 5 or 6 smoke sprites that swells and fades, with 5, 8 or 11 small wisps above it | 9, 13, 17 |
| murky | one fat bubble, then 7 droplets | 8 |

Strength changes the count (and the ribbon's length), nothing else. Colours are the effect's own
(`potionEffect` of the potion as mixed: the mixed colour first, then its carriers'), cycled by
particle; the ribbon takes them in bands along its length.

**Murky's blorp.** One fat bubble squeezes out of the neck over 0.6 s, wobbling (a squash of up to
a quarter, dying away), rises lazily, hangs at full size above the lip from about 1.5 s, and at
1.7 s pops into seven droplets that fall and are gone by 2.2 s. It is not a failure because it is
played as fully as any effect: the same pop, the same system, in the potion's own mud colour, with
a start, a hang and a punchline. A failed effect would be nothing, or less of something; this is
one big deliberate thing, the joke the name and the lore already tell (E13, E16).

**Bounds**, all asserted over every kind, strength and frame of the show. At most 300 points (the
buffers hold exactly that; the most a kind asks for is 280) and at most six smoke sprites. A
sprite is at most 64 CSS px across on a phone 844 px tall, and the same share of other screens.
Every particle stays in a box in the neck's frame (1 to each side, 1 up, 0.25 down, in units of
the reach below). Every alpha is 0 from 2.45 s after the pop, before the stopper moves.

**In the frame** (`effectReach`, `placeParticle`, pure). The box reaches 0.42 bottle heights up
and 0.46 to each side of the neck, or as far as the frame's edge less a margin of 1.2 percent of
its height, whichever is less. A particle is placed so its whole sprite is inside that reach and
inside the frame. On desk the lip of a tall or teardrop bottle is about 130 px under the top of
the window, so the box there is low and wide, and the programs are written for that: they spread
sideways as much as up. A side with less than 0.4 of the other side's room is not used; its
particles go out the other way instead. Squeezing them was tried first and drew a bright column
against the edge at a full lean on a 360 px phone.

**Straight up, whatever the bottle does.** The points are drawn in the scene's frame, not the
bottle's. A particle takes the neck's place, and the reach the frame allowed there, at the moment
it leaves the neck, and keeps both. So the effect rises straight up at any lean; a drag during
the effect moves only what has not left yet, and the hold bringing the bottle upright afterwards
moves nothing that is out. Depth only orders the particles against the stopper: each is slid
along its line of sight, so it stays where it was placed on screen. The rule ticket 11 learnt
holds: a position is a function of `age` and of what was fixed as the particle left, and `age`
restarts at each pop.

**The stopper is moved aside.** Ticket 23 left the popped stopper hanging 1.3 plug depths straight
above the lip, on the effect's axis, and on desk its top is 20 px from the top of the window. So
one of ticket 23's beats changes: from 0.06 s after the pop (the plug is clear of the lip by
0.07 s) the stopper swings aside over 0.4 s, hangs there leaning out, and swings back over the
last 0.4 s before 4.4 s, so the settle and the sink are as ticket 23 left them (`stopperAside`
in the clock; shown aside without travelling under reduced motion). The stage swings it across
the screen by 2.6 neck radii and 3 mm, to the right, or to the upper side of a bottle leaning
more than about 7 degrees, decided at the pop. Weighed and not taken: emitting round the stopper
(the plume's axis is inside a cork, and nothing fits above it on desk) and framing lower (the
held position is the rig's, shared with the wand and the sword, and the lift is ticket 23's).
The stage reaches the stopper's group in the mesh by its name, as the pose probe reaches the
glass, because the mesh takes only a lift and a turn; a prop on the mesh would say it better.
At a full lean on a 360 px phone the popped stopper is partly past the screen's edge, as it was
before it swung (the pop takes it along the bottle's axis); the swing brings it in, not all the way.

**The bloom route: no composer.** The effect is its own capped sprites, each adding its light
with its own soft falloff, and no post pass is ever mounted. A composer only while the show runs
was the other option, and it fails the one test set for the choice: ADR 0109 found that through a
composer over a transparent canvas the glass goes dull, so mounting one at the pop and removing it
at the end would change the glass at exactly those two moments. It would also compile its passes
and allocate its targets in the frame of the pop, and run full-screen passes on a phone for the
length of the effect. With no pass, the canvas before, during and after the show is drawn by the
same pipeline. Sprites blend as the liquid's motes do (added, premultiplied), each shape covering
what is behind it by its own share: none for a light, most for smoke and the murky bubble's skin.
A light (glitter, a star, the ribbon) takes its colour at full strength, so a dark potion's lights
are as bright as a pale one's, and keeps its body under about 0.6 before the tone map: ACES washes
anything much brighter towards white, and the first sheets' glitter and stars were white whatever
the potion. Only their small cores go past it.

**The bloom exception** (against ADRs 0082, 0083 and 0100).

- **What and where:** only the effect's sprites, inside the box above the neck. Their cap is the
  resting cap plus `emit` times the way to `EFFECT_CAP`, twice the threshold, the sword glint's
  ceiling. It is the effect material's own uniform: the glass, the liquid, its motes, the stopper
  and the label keep `0.92 * BLOOM_THRESHOLD` throughout.
- **How long:** 2.5 s from the pop (2 s under reduced motion), and only in the close look.
- With no pass that reads brightness, nothing blooms in the sword's sense: past the resting cap a
  sprite is only nearer white under ACES. So the worry ticket 11 left (a fleck's flash and the
  clinging beads' glint can sum above the resting cap) has nothing to trip.

**Reduced motion.** `age` is held at one still moment (`EFFECT_STILL_AGE`, 1.2 s, when every kind
is in full show and the murky bubble hangs) and `emit` fades it in over 0.3 s, holds 1.2 s and
fades out over 0.5 s, from the reveal at 0.3 s, inside the stopper's window. Nothing travels; the
twinkles are functions of `age`, so they are still too.

**Nothing is acted out.** The bottle, the room and the shell do nothing for an effect: no lean,
no shake, no flash, no sound. What differs between kinds is the program and the sprite's shading.

**A tap and a put-back.** A tap during the effect fades the old one over 0.3 s where it is, its
`age` running on, and the new show lets out its own at its pop. A put-back after the pop fades
the effect in place over 0.5 s while the bottle flies down. A put-back before the pop can still
pop the stopper on the way (ticket 23), and nothing comes out.

**Cost.** One geometry (three attributes of 300) and one material, built when the close look
mounts and drawn from its first frame with every point clipped away, so the program is compiled
with the stage and the pop compiles and builds nothing. During the effect a frame runs at most
280 programs and uploads three small buffers, with no allocation; at rest it is one comparison.

- The frame of the pop (production build under `vite preview`, phone 390x844 at DPR 3, 4x CPU
  throttle, ticket 23's `flip-prod.mjs`: the longest frame from the reveal to 300 ms after it).
  The display is 120 Hz, so the figure moves in steps of 8.3 ms. Before, on the day's machine:
  two refreshes (15.8 to 17.5 ms) in 11 of 14 runs and three (24.1 to 25.8 ms) in 3. After: two
  (15.6 to 17.9 ms) in 28 of 30 runs and three (24.7 and 24.9 ms) in 2, over first mixes into
  dreamy, sparkling (280 points), whirling (280) and floating. No frame over 25 ms anywhere in
  the effect.
- Frame interval with vsync off (ticket 14's method, phone size, medians of five): during the
  effect 1.83 to 2.29 ms across the seven kinds, against 1.82 to 2.23 ms for the same bottles at
  rest after it: under 0.1 ms.

**The shots script** takes `--popleans=59,-59 --popat=2.4,3.1`: for each lean it replays the
show, drags the bottle to the lean a second in, holds it through the pop and shoots the held
stage at each moment.

## Consequences

- A child's first drag always moves the bottle, even in the first second of the show.
- **For ticket 23 (the mix, the swirl, the show's clock):** the show is timed from `flourishAt`
  (the rig's clock time of the latest flourish). The rig's upright weight is the one place the show
  holds the bottle; a lift beat (rise a little more) is a position offset on top and can play under
  a drag. A show longer than 4 s sets `flourishSeconds` in `potionHeldItem` to match. The swirl is
  a shading change and needs nothing from the slosh: the surface normal stays the one seam.
- **For ticket 15 (the uncorking and its effects):** a child holding a drag during the pop leans
  the neck the effect leaves by; let go, the hold brings the bottle upright within 0.3 s. The
  effect rises straight up in the scene from wherever the neck is ("The uncorking").
- **For ticket 15, from the mix:** `potionShow` already returns `emit`, `age` and `cap` at rest
  values and `popped` from the pop to the sink; fill them in the clock, and read them from the
  `PotionShow` the stage's `Show` writes each frame (`drawn.show.current`). The neck is 6 percent of
  the bottle's height higher from 0.4 to 4.9 s (the lifted group), and the stopper hangs 1.3 plug
  depths out, bobbing, above it. A restart blends `emit` and `cap` over 0.3 s and jumps `age`.
- **For ticket 12 (the pour):** the mix needs three layers, so a pour never meets `uMix` above 0;
  `setMixed(null)` clears the mix's traits for a bottle with fewer than three.
- The wand and the sword give no outline and no upright hold, so none of this reaches them; their
  pixels are re-diffed against the ticket 04 baseline.
