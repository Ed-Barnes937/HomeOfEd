# 09 - The clay stage and the form gate

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 04, 06, 07
**Parallel with:** 08
**Model:** opus
**Gate:** form
**ADR:** none of its own; add a "Form gate" section (tuning and cuts) to 0107
**Dev port:** 3032

## Goal

Put the bottle on screen in plain grey and judge its form on a real GPU before any material
exists (`apps/armoury/CLAUDE.md`, build order: "the generator first, judged in plain grey"). Build
the potion's box stage on the front-framed `boxRig`, a minimal close look on the upright
`HeldRig`, and the mesh component whose props later tickets drive, then take it through the form
gate. This is the last ticket before the stop line.

## Read first

- `spec.md`: "The look and the scene, in words" (framing, render order), "The close look" (the
  hold), "Testing" (gates), "Rules for the team" (3, 9, 12, 13, 15).
- `apps/armoury/CLAUDE.md` (the stage seam, uniforms through the material, motion, gates).
- ADRs 0077, 0099, 0100, 0105 (ticket 04), 0107 (ticket 06).
- Source: `src/stage/SwordStage.tsx`, `SwordCloseUpStage.tsx`, `SwordMesh.tsx` (building from
  generated arrays once, then the latest spec once per frame, reusing buffers), `smithyScene.tsx`
  (`boxScale`, half width), `boxRig.tsx`, `HeldRig.tsx`, `hold.ts`, `FlourishProbe.tsx`,
  `stage.ts`; `src/App.tsx`; `scripts/gpu-shots.mjs`; tickets 06 and 07's `src/potion/*` and
  `src/apothecary/BrewingTable.tsx`.

Paths are relative to `apps/armoury/`.

## Files you own

New: `src/stage/PotionStage.tsx` (the lazy entry), `src/stage/PotionMesh.tsx`,
`src/stage/potionScene.tsx`, `src/stage/PotionCloseUpStage.tsx` (minimal), test
`src/stage/PotionMesh.test.ts`. `src/App.tsx` (two lazy imports), `scripts/gpu-shots.mjs`. For
gate tuning and cuts only: `src/potion/bottles.ts`, `profile.ts`, `geometry.ts`, `tipped.ts`,
`outline.ts`, `framing.ts` (`BASE_LINE`), `potionSchema.ts` and `presets.ts` (only to remove a
cut shape), and `src/stage/HeldRig.tsx`, `boxRig.tsx`, `hold.ts`
(front handoff and upright fixes, re-running ticket 04's pixel diff if you touch them). Also
`src/apothecary/BrewingTable.module.scss` (the stage slot's placement only).

## Scope

1. **`potionScene.tsx`**: `POTION_HALF_WIDTH` (the box stage's horizontal half span, chosen so the
   tallest bottle at `BASE_LINE` fits the stage's height with room above the stopper),
   `boxScale(spec)` from `heightFraction(spec)` (`potion/framing.ts`), `footY` and
   `boxCentreY(spec)` (below), and `ClayLights` (a soft key from the upper left, a fill, a rim
   from behind; neutral white) in the box's frame for the front view.
2. **`PotionMesh.tsx`**: from `buildPotionMesh(compilePotion(params))`, four groups (glass,
   liquid, stopper, label). The contract is ADR 0105, "Front framing and the handoff": the mesh
   stands along +y, **centred on its own middle**, label facing +z, and **never places itself on
   the base line**; the same component goes, unchanged, in the box stage and inside `HeldRig`,
   and no quarter turn is added anywhere (the rig lays the bottle down and stands it up itself).
   Ticket 06's parts are in mm, stand along +z with the foot at z = 0 and the top at
   `spec.heightMm`, and the label faces -y, so wrap the four parts in one group:
   `<group position={[0, (-spec.heightMm * MM) / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={MM}>`.
   That turn sends the axis to +y and the label to +z with no mirror. Build once at mount, then
   the latest spec once per animation frame, reusing GPU buffers when sizes match (as
   `SwordMesh.tsx`). Clay only for now: the glass a neutral grey at 0.35 opacity, back faces
   then front faces, `depthWrite: false`; the liquid opaque, each band a different grey (light
   at the bottom to darker at the top); stopper and label mid-grey. **Band the liquid by the
   plane, not by `aHeight`:** a level is the plane `dot(p, u) = h`, with `p` in the bottle's
   millimetre frame from the foot's centre and `u` the `surfaceNormal` expressed in that frame
   (ADR 0107, `tipped.ts`). `aHeight` equals `dot(p, u)` only when the bottle is upright, so a
   shader that bands by `aHeight` would tilt the bands with the glass. `renderOrder` glass back
   1, liquid 2, particles 3, glass front 4 (constants exported for ticket 10). Props, the seams
   later tickets drive without editing this file's structure: `spec`, `stopperLift` (mm along
   the axis, 0 seated; ticket 12's pour and ticket 15's uncorking), `levels` (the `h` of each
   band top in mm, default the upright levels; ticket 12's fill tween and ticket 14's slosh),
   `surfaceNormal` (`u`, default the bottle's own axis; ticket 14). In clay, `levels` and
   `surfaceNormal` only move the band boundaries. Build a level table once per spec, never per
   frame (it costs several milliseconds).
3. **`PotionStage.tsx`** (default export, re-exports `PotionCloseUpStage`): `Framing` with
   `view="front"`, then `Roller axis="y"` > `group scale={boxScale(spec)}` >
   `group position={[0, boxCentreY(spec), 0]}` > `PotionMesh`, with no other turn; `Bridge`,
   `captureScene`; `ClayLights`; no bloom yet. `boxCentreY` (in the units inside the scale) is
   the height that puts the foot on `BASE_LINE`: `boxCentreY = footY + spec.heightMm * MM / 2`,
   and with `H = boxHalfWidth / aspect` (the slot ticket 07 built is square, so
   `H = boxHalfWidth`), `d` the length of `boxCameraPosition('front', ...)`,
   `p = FRONT_CAMERA_PITCH` and `s = (1 - 2 * BASE_LINE) * H`:
   `footY = s * d / (d * cos(p) + s * sin(p))`. Work it out in one exported function (in
   `boxRig.tsx` beside `boxCameraPosition`, or `potionScene.tsx`) that the box stage and the
   `HeldItem` both call, so they cannot disagree; `boxCentreY` is a constant per spec, so the
   box stage must keep a fixed aspect (say so in ADR 0105). A dev-only `?clay` switch is
   recognised (everything is clay until ticket 10 adds the real look, which keeps `?clay` for
   later form checks).
4. **`PotionCloseUpStage.tsx`**, minimal: `HeldRig` with the potion's `HeldItem`: `hold:
   'upright'`, `flourish: 'own'`, `flourishSeconds: 4` (ticket 15 sets the real value),
   `boxView: 'front'`, `lengthMm: spec.heightMm`, `widthMm` from the outline, `grip` as a
   fraction from the foot (0.5), `flourishScale: 1`, `trailColour: null`, `hit` in the mesh's
   own frame (height along y) round the whole bottle,
   `boxHalfWidth: POTION_HALF_WIDTH / boxScale(spec)`, and `boxCentreY` the same value the box
   stage used. It lifts, stands upright, leans and tips under drags and rights itself, zooms
   and goes back; no slosh, no uncorking.
5. **`App.tsx`**: `potion: { Box, CloseUp }` as lazy imports of `./stage/PotionStage.tsx`. After
   `vite build`, check a wand-only or sword-only visit downloads no potion chunk.
6. **`scripts/gpu-shots.mjs`**: a potion item opens at `/potions#w=` (with `?clay` under
   `--clay`); new `--leans=30,-45` and `--tips=20,-30` take a close-look shot while the drag is
   still held (mouse down, move, wait, shoot, release), since the bottle rights itself on
   release. Update the file's header comment.
7. **Form gate** (below), tuning numbers in the files above between rounds.

## Acceptance

- Every shape, neck, stopper, label and pour count passes the form gate beside the wand and
  sword baseline, desk and phone.
- The bottle stands on the foot line, inside the frame, turns about its upright axis on the table,
  and the label faces the child at rest.
- Lift and put-back show no jump; the held bottle is upright in landscape and portrait; leans and
  tips right themselves.
- The wand and sword shots are unchanged (re-run ticket 04's pixel diff if you touched a rig).
- A wand-only visit downloads no potion code.

## Tests to write first

- Unit, `PotionMesh.test.ts`: the buffers built from a catalogue potion have the part counts and
  attribute names the shader will need (`aHeight` on the liquid), the render order constants are
  increasing, and a respec of the same sizes reuses buffers (count the allocations).
- Unit, beside the rig (`HeldRig.test.ts`), from the second review of ticket 04: the lift's
  start for a phone canvas and for the square slot ticket 07 built (today's tests use only a
  landscape canvas and a portrait-shaped box); and a test that the upright item's inner group
  really carries the `UPRIGHT_TO_LEVEL` turn (setting its rotation to zero in the JSX passes
  every test today).
- No new iwft: re-run `src/apothecary.iwft.tsx` with the fakes.

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run
pnpm --filter armoury exec playwright test -c playwright-ct.config.ts   # port 3111 is shared: check `lsof -i :3111`, wait if busy
pnpm --filter armoury run build
```

## Form gate

Protocol: spec rule 15 (fresh reviewer, `review.md` per round, your run ends at each hand-off,
at most three rounds). Shots into `shots/09/r<N>/` (absolute path). **Never `playwright
install`.**

```bash
pnpm --filter armoury exec vite --port 3032 --strictPort &
node apps/armoury/scripts/gpu-shots.mjs http://localhost:3032 <abs>/shots/09/r1 <abs>/shots/sets/forms.json --clay --leans=35 --tips=25
```

Write `shots/sets/forms.json`: every shape at neck 0, 0.5 and 1; every stopper and every label on
the teardrop; the round flask with 0, 1, 2, 3 and 4 pours; every preset. Desk and phone; box,
close frames (rise, held), a lean and a tip, put-back frames.

The reviewer judges beside `shots/04/baseline/`: five shapes that read as five different bottles;
believable proportions (foot, body, shoulder, neck, lip); the neck range; each stopper seated in
the bore; labels on the glass with no z-fighting or floating; pours that look equal; the bottle
on the foot line and in frame at every shape; upright in both orientations; lean and tip read as
holding a real bottle; no jump at lift or put-back; nothing about the form looks cheaper than the
wand or the sword. Fix numbers, never add features. A shape still failing after its second fix
round is cut (remove it from `bottles.ts` and the schema, fix presets, record it in ADR 0107).

## Out of scope

- Glass, liquid colour, traits, light and mood (10, 11). The pour (12). Slosh and uncorking (14,
  15). The scene art (13).

## Comments
- 2026-11-13 orchestrator, from the review of ticket 03: Scope 1 says "`boxScale(spec)` from `drawnHeightFraction`". `drawnHeightFraction` now takes params only; for a compiled spec use `heightFraction(spec)` from `potion/framing.ts`.
- 2026-11-13 orchestrator: Scope 2, 3 and 4 were rewritten after the reviews of tickets 04 and 06 (the mesh is centred and the box stage places it with `boxCentreY`; the liquid is banded by the plane `dot(p, u) = h`, not by `aHeight`). Follow the scope as it now reads.
- 2026-11-13 orchestrator, from the review of ticket 06, what the form gate should look at hardest: the wax seal (it read as a screw cap; reshaped in ticket 06's fix round); the default teardrop, where the round label and the banner cover the lower two pours from the front (also on the gourd); the cork at the shortest neck; the sharp inner corner where the cavity floor meets the wall; whether the shortest neck still reads "Short".
- 2026-11-13 orchestrator, from the second review of ticket 04: the `HeldItem` docs for `tip` and `grip` read as level-only; reword them for an upright item while you are in `HeldRig.tsx`.
- 2026-11-13 orchestrator, from the second review of ticket 06: the wax seal is sound geometry but still reads as a mushroom (a tall round dome over a narrower collar, with the 2 mm roll as a second ring; on the shelf a bun on a stalk). The change that would help most: flatten the dome to a near-flat top just over the cork with a 1.5 to 2 mm rounded edge and near-vertical sides down to the bead; second choice, halve how far the roll stands out. Two wax tests pin today's 2 mm roll (one only looks at points more than 1.8 mm out from the neck, so a smaller roll fails with a confusing NaN): fix those tests when you retune. Every seal wanders the same way round the neck; vary it per potion only if the gate asks.
- 2026-11-13 orchestrator: `framing.ts` still documents `TALLEST_MM` as foot to stopper top; it is the top of the stopper allowance (see `heightMm` in `compile.ts`). Reword that one comment. ADR 0107 says the cork sits 60 percent in the bore (54 percent on short necks now) and the wax is 1.1 mm at the lip corner (about 1.0): correct both in the form gate section.
- 2026-11-13 orchestrator: ticket 07's shelf already draws from `potionOutline` (the stand-in was swapped in ticket 06's fix round); there is nothing to swap here.
- 2026-11-13 implementer: form gate round 1 is shot, 770 shots of the 35 potions in `shots/sets/forms.json`, desk and phone, in `shots/09/r1/` (absolute: `/Users/edward.barnes@glean.co/Code/Worktrees/HomeOfEd/armoury-potions/.scratch/armoury-potions/shots/09/r1/`); the rig pixel diff after the `HeldRig.tsx` change is in `shots/09/rig-diff/`.
