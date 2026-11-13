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
- `widthMm`, the widest across, so an upright item is fitted to the screen by its height and its
  width.

`boxRig` gains `Framing({ view = 'above' })` and `Roller({ axis = 'x' })`. The level path's code
and numbers are kept; the new code branches only where an option is not its default.

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
  critically damped and never passes upright: righting is a pose returning, not a show.
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

### Front framing and the handoff

- `Framing({ view: 'front' })` puts the camera in front of the middle, pitched down by
  `FRONT_CAMERA_PITCH` (8 degrees, in `scene.tsx`), at the distance where `halfWidth` spans half
  the stage at the item. `Roller({ axis: 'y' })` turns about the vertical.
- With `boxView: 'front'` the box stage draws the item standing: its children lying along x as
  the held group's do, turned a quarter about z, inside a `Roller axis="y"` (a level item lies
  along x, rolled about x). The box's world is the close look's turned about x by the pitch, so
  the lift starts from that turn and eases it out, and the lights group is turned by the pitch
  (not `BOX_TO_CLOSE`) as the item rises. The first frame of the lift is drawn where and how the
  box drew the item, and the put-back lands it there: no jump either way.

### Proof the wand and the sword are unchanged

`shots/sets/baseline.json` (three wands: preset 0, a Branch, a gem preset; three swords:
preset 0, a Sabre, a Katana) was shot on the real GPU with `--picture --reduced-motion`, desk
and phone, before the change and after it, and every pair was compared pixel by pixel:
box, scene, picture, close and zoom frames. The result is recorded in the epic's
`shots/04/diff.md`; the after shots are the baseline every later potion gate shoots beside.
Every existing wand and sword test passes untouched.

The sword's flourish probe moved to `stage/FlourishProbe.tsx` unchanged, so the potion's close
look can reuse the shots script's `--flourish` hold.

## Consequences

- An upright kind gets a close look by writing a `HeldItem` with `hold: 'upright'`,
  `flourish: 'own'`, `boxView: 'front'` and its mesh, and a box stage on `Framing view="front"`
  and `Roller axis="y"`.
- The hold's numbers (limits, softness, spring) live in `hold.ts`; their feel is judged on a real
  GPU at the potion's form gate, as the tests prove bounds and timing, never the feel.
- `boxView: 'front'` assumes the box stage stands the item as described above; a box stage that
  poses it otherwise breaks the handoff.
