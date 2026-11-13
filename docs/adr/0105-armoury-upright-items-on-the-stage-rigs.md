# 0105 - armoury upright items on the stage rigs

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR 0077](0077-armoury-close-look.md) (the close look, its rise and wave),
  [ADR 0100](0100-armoury-sword-close-look-and-stage-rigs.md) (the shared rigs, `HeldItem`).

## Context

ADR 0100 promised that a new kind gets a close look by writing a `HeldItem` and a mesh. That
held only for a long thin item lying down: `boxRig` frames the box from above and rolls the item
about x, and `HeldRig` holds it level (tilted in portrait), turns it like a pencil under a
finger, and flourishes with the figure of 8. The potion shop's bottle stands up, is seen from the
front on its table, must stay upright in landscape and portrait alike, and its flourish is its
own (the uncorking), not a wave.

## Decision

### Options with today's defaults

`HeldItem` gains optional fields; with none set, the rig is exactly what it was:

- `hold: 'level' | 'upright'` (default `'level'`);
- `flourish: 'wave' | 'own'` (default `'wave'`) and `flourishSeconds` (with `'own'`);
- `boxView: 'above' | 'front'` (default `'above'`);
- `boxCentreY`, how far above the box camera's look-at point the box stage stood the item's
  centre (default 0, on it, as the wand and the sword lie);
- `widthMm`, the widest across, so an upright item is fitted to the screen by its height and its
  width.

`boxRig` gains `Framing({ view = 'above' })`, `Roller({ axis = 'x' })` and `boxCameraPosition`,
the one place the box camera's position is worked out, which `Framing` and the rig's lift both
use. The level path's code and numbers are kept; the new code branches only where an option is not
its default.

### The upright hold (`stage/hold.ts`, pure and tested)

- The held item stands along screen y in both orientations (`heldTilt('upright') = PI / 2`; the
  level numbers, `PI * 0.4` portrait and `PI * 0.05` landscape, moved into `heldTilt` unchanged).
  It turns slowly about its length until first touched, as the wand does, and keeps any roll
  carried from its box.
- A drag across leans it in the screen plane, a drag along (down the screen) tips its top towards
  the viewer, 0.007 radians per pixel as the level turn, up to 60 and 45 degrees. Over the last
  10 degrees the drag gives way exponentially, so the limit is felt rather than hit; dragging
  back is never resisted.
- Let go, it rights itself: an exact damped spring step (stiffness 8 per second, damping ratio
  0.5), so the wobble is the same at any frame rate. It settles in about 0.8 s with one visible
  overshoot of about 16 percent (the next is under 3 percent). Under reduced motion it is
  critically damped and never passes upright: righting is a pose returning, not a show. The step
  writes into the pose in place, so the hold allocates nothing per frame.
- The spring runs only while no finger holds it, so a held lean stays put.
- **No spin in the upright hold.** A level item carries a flick on as roll and swing; an upright
  item's only motion after release is righting itself. A spinning bottle would be an
  acted-out behaviour the spec rules out, and a flicked lean would fight the spring.
- Tip and lean turn the item about its grip point, as the wave does, and the invisible hit box is
  a child of the held group, so it follows the pose. Pinch and wheel zoom as before.

### The item's own flourish (`flourish: 'own'`)

The rig plays no figure of 8 and no trail, but still records the flourish clock and passes
`flourishAt` to its children, which draw the show themselves (the potion's uncorking). For
`flourishSeconds` an upright item is eased upright by `uprightFlourishWeight` (in over 0.3 s,
held, out over the last 0.3 s): the tip and lean shown are scaled down by it while the spring
carries on underneath. The rig rights the bottle because the show comes out of its neck and
must stay in a box above it on screen; a bottle tipped 45 degrees towards the viewer would hide
its own effect.

Under reduced motion the weight is a step, with no ease: 1 for the whole of the flourish and 0
outside it, so the bottle is shown upright at once and its pose is shown again at once after.
The ease is motion the rule rules out ("no ... flourish"). The spring keeps running underneath,
critically damped, so by the end of the flourish the pose is at rest and the step back shows
nothing unless a finger is holding a lean.

### Front framing and the handoff

- `Framing({ view: 'front' })` puts the camera in front of the middle, pitched down by
  `FRONT_CAMERA_PITCH` (8 degrees, in `scene.tsx`), at the distance where `halfWidth` spans half
  the stage at the look-at point. `Roller({ axis: 'y' })` turns about the vertical.
- **The contract for an upright item** (`hold: 'upright'`, `boxView: 'front'`):
  1. Its mesh draws it standing along +y, centred on its own middle: the foot at
     `-lengthMm / 2` and the top at `+lengthMm / 2`, in mm times `MM`, the label facing +z. The
     same mesh, unchanged, goes in the box stage and in the held group; the mesh never places
     itself on a base line.
  2. The box stage draws it as `Roller axis="y"` > `group scale={boxScale}` >
     `group position={[0, boxCentreY, 0]}` > the mesh, with no other turn. `boxCentreY` is in
     the units inside the box's scale (the item's own scene units), the height that puts the foot
     on the stage's base line.
  3. Its `HeldItem` sets `boxHalfWidth` to the stage's half width divided by the box's scale (as
     the sword does) and `boxCentreY` to the same number the box stage used.
  4. The rig does the rest. It lays upright children along x in an inner group turned by
     `UPRIGHT_TO_LEVEL` (a quarter turn about z) so that its level arithmetic (`heldTilt`, the
     grip, the box's quarter turn back up in `liftTurn`) holds every item the same way; the hit
     box is a child of that group, so `hit` is in the children's frame (along y for an upright
     item).
- `liftStart` places the first frame of the lift. It finds the box camera with
  `boxCameraPosition`, projects the stood centre through it (the pitch, and how much nearer or
  further than the look-at point the centre is), and puts the item's centre on that pixel, at the
  scale the box drew it there, on the close look's plane. `liftTurn` turns it as the box stage
  did, seen by the close camera: the box's world turned about x by the pitch. The put-back lands
  on the same pose, read again from the box. With `boxCentreY` 0 the start is the look-at point at
  the look-at point's scale, the same arithmetic as before.
- `HeldRig.test.ts` proves the contract against real three.js cameras: the box camera framed as
  `Framing view="front"` draws the stood centre on the same pixel, and a short span there at the
  same length, as the close camera draws the lift's first frame, for a centre above, on and below
  the look-at point; and the upright children start turned as the box stood them and are held
  standing up and facing the viewer, in landscape and portrait.
- The lights group is turned by the pitch (not `BOX_TO_CLOSE`) as the item rises, matching the
  box at the start.

### Proof the wand and the sword are unchanged

`shots/sets/baseline.json` (three wands: preset 0, a Branch, a gem preset; three swords:
preset 0, a Sabre, a Katana) was shot on the real GPU with `--picture --reduced-motion`, desk
and phone, before the change and after it, and every pair was compared pixel by pixel:
box, scene, picture, close and zoom frames. Controls (re-shoots of unchanged code) were taken to
tell run-to-run differences from changes.

- Round 1: 100 of 108 pairs at 0. Round 2 (after the review fixes, which moved the lift's
  arithmetic into `liftStart`, `liftTurn` and `heldTurn` with the same expressions in the same
  order): 97 of 108 at 0.
- Every scene, picture and zoom pair is 0, and every box pair but one stray pixel (max 1) on one
  wand frame, which the controls show against the before shots too.
- The wand's close frames at 1200 ms differ between two runs of the unchanged code as much as
  before and after, because two lights still move then under reduced motion, both outside the
  rigs: the wand shop's screen flash and the tip glow's flare after the arrival cast.
- Every other non-zero pair is at most 3 levels, in the page behind the close look, never on the
  item: two sword frames (one at 1200 ms and one at 7000 ms, where the controls match the after
  shots exactly) and, in round 2, two wand desk frames at 2400 ms, where a control re-shoot of the
  same code is 0 against the before shots.

The numbers are in the epic's `shots/04/diff.md`; the after shots are the baseline every later
potion gate shoots beside. Every existing wand and sword test passes untouched.

**What the pixel proof does not cover.** Every shot is taken under reduced motion, so the rise
(the turn and the lights easing from the box), the idle roll and the figure of 8 are never drawn;
a non-reduced run cannot be pixel-proved, as the idle roll advances by real frame time and two
runs of the same code differ. Those paths rest on reading the change line by line: with no new
field set, the level path computes the same expressions in the same order.

The sword's flourish probe moved to `stage/FlourishProbe.tsx` unchanged, so the potion's close
look can reuse the shots script's `--flourish` hold.

## Consequences

- An upright kind gets a close look by writing a `HeldItem` with `hold: 'upright'`,
  `flourish: 'own'`, `boxView: 'front'` and `boxCentreY`, a mesh standing along +y centred on its
  middle, and a box stage on `Framing view="front"` and `Roller axis="y"` that stands it as the
  contract above says.
- The hold's numbers (limits, softness, spring) live in `hold.ts`; their feel is judged on a real
  GPU at the potion's form gate, as the tests prove bounds and timing, never the feel.
- A box stage that turns the item or places it any other way than the contract says breaks the
  handoff; the rig knows only the box's camera, the box's scale and `boxCentreY`.
- The lift is placed exactly at the item's centre; the item's ends carry the small perspective
  difference between the box camera and the close camera that the wand and the sword always had.
