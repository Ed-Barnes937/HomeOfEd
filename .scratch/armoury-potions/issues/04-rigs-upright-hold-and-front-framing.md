# 04 - Rigs: an upright hold, the item's own flourish, front framing

**Status:** done (merged into `armoury-potions`; reviews 04-r1, 04-r2)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** none
**Parallel with:** 01, 02, 03
**Model:** opus
**Gate:** code review only, plus the wand and sword pixel diff below (checked by the orchestrator)
**ADR:** 0105 (write it)
**Dev port:** 3030

## Goal

The stage rigs assume a long thin item lying down: `boxRig` frames from above and rolls about
x, and `HeldRig` holds the item level (or tilted in portrait) and waves it in a figure of 8. A
bottle stands up, stays upright in both orientations, and its flourish is its own (the
uncorking). Generalise both rigs with options whose defaults are today's behaviour, and prove by
pixel diff that the wand and the sword are unchanged. ADR 0100 promised that "a new kind gets a
close look by writing a `HeldItem` and a mesh"; this makes that true for an upright item.

## Read first

- `spec.md`: "The close look" (the hold and free play), "Accessibility and reduced motion",
  "Rules for the team" (3, 12, 13, 17).
- `research/experience-options.md` (absolute path): section 1, "The rigs assume a long thin item
  lying down".
- ADRs 0077 (the close look), 0100 (the shared rigs, the bloom exception).
- Source: `src/stage/HeldRig.tsx` (all of it), `src/stage/boxRig.tsx`, `src/stage/scene.tsx`,
  `src/stage/wave.ts` and `wave.test.ts` (the pure-clock pattern), `src/stage/CloseUpStage.tsx`,
  `src/stage/SwordCloseUpStage.tsx` (its `FlourishProbe` and `Presented`),
  `src/stage/WandStage.tsx`, `src/stage/SwordStage.tsx`, `src/stage/stage.ts`,
  `src/shop/useDisplay.ts`, `scripts/gpu-shots.mjs`.

Paths are relative to `apps/armoury/`.

## Files you own

`src/stage/HeldRig.tsx`, `src/stage/boxRig.tsx`, `src/stage/scene.tsx` (one constant), new
`src/stage/hold.ts` (+ `hold.test.ts`), new `src/stage/FlourishProbe.tsx`,
`src/stage/SwordCloseUpStage.tsx` (the import of the moved probe only),
`docs/adr/0105-armoury-upright-items-on-the-stage-rigs.md`. After you, `HeldRig.tsx`,
`boxRig.tsx` and `hold.ts` pass to ticket 09 for front-handoff and upright fixes found at the
form gate.

## Scope

1. **`stage/hold.ts`**, pure, like `wave.ts`:
   - `heldTilt(hold, portrait)`: `'level'` gives today's numbers (`PI * 0.4` portrait,
     `PI * 0.05` landscape, moved here unchanged); `'upright'` gives `PI / 2` in both.
   - `UprightPose { lean: number; tip: number; leanVelocity: number; tipVelocity: number }`.
   - `dragUpright(pose, dxPx, dyPx)`: a drag across leans it in the screen plane, a drag along
     tips its top towards or away; clamped to `LEAN_MAX` (60 degrees) and `TIP_MAX` (45
     degrees), with a soft limit over the last 10 degrees.
   - `rightUpright(pose, dt, reducedMotion)`: a damped spring back to upright (about 0.8 s, one
     visible overshoot of at most 25 percent); under reduced motion critically damped (no
     overshoot).
   - `uprightFlourishWeight(sinceFlourish, flourishSeconds)`: 0 to 1, how strongly a flourish
     holds the item upright (eases in over 0.3 s, holds, eases out over the last 0.3 s).
2. **`HeldItem`** gains optional fields whose defaults are today's behaviour:
   - `hold?: 'level' | 'upright'` (default `'level'`);
   - `flourish?: 'wave' | 'own'` (default `'wave'`): with `'own'` the rig plays no figure of 8 and
     no trail; it still records the flourish clock and passes `flourishAt` to its children, and
     an upright item is eased upright for `flourishSeconds`;
   - `flourishSeconds?: number` (with `'own'`);
   - `boxView?: 'above' | 'front'` (default `'above'`);
   - `widthMm?: number` (the widest across; an upright item is fitted to the screen by its
     height and its width).
   The level path's code and numbers do not change; branch only where `hold` or `boxView` is not
   the default.
3. **`HeldRig.tsx`, upright:** the held quaternion is the item's length along screen y, its roll
   (the idle turn until first touched, as today, and any roll carried from the box) about that
   axis, then `tip` about screen x and `lean` about the view axis, pivoting about `grip`. Pointer
   drags call `dragUpright` instead of rolling and swinging; on release and every frame
   `rightUpright` runs; a flick carries no spin. Pinch and wheel zoom as today. `heldScale` fits
   height and `widthMm` (guard the `cos(PI / 2)` term). The hit box follows the pose.
4. **`HeldRig.tsx`, front box view:** with `boxView: 'front'` the first frame of the lift draws
   the item exactly where and how the front-framed box stage drew it (the box looked from the
   front, pitched down by `FRONT_CAMERA_PITCH`), the lights group is not turned by
   `BOX_TO_CLOSE`, and the put-back lands it back in place. No jump at lift or put-back.
5. **`boxRig.tsx`:** `Framing({ halfWidth, view = 'above' })`: `'front'` puts the camera in front
   of the middle, pitched down by `FRONT_CAMERA_PITCH`, with `halfWidth` the same horizontal half
   span as now. `Roller({ target, axis = 'x' })`: `'y'` turns about the vertical. `captureScene`
   unchanged.
6. **`scene.tsx`:** add `FRONT_CAMERA_PITCH` (start at 8 degrees, in radians); nothing else.
7. **`FlourishProbe`:** move it from `SwordCloseUpStage.tsx` to `src/stage/FlourishProbe.tsx`
   unchanged (a pure move; the sword imports it), so the potion's close look can reuse the shots
   script's `--flourish` hold.
8. **Baseline and proof** (absolute paths, spec rule 3):
   - Write `shots/sets/baseline.json`: three wands (wand preset 0, a Branch preset, a preset with
     gems) and three swords (sword preset 0, a Sabre, a Katana), params copied from
     `src/wand/presets.ts` and `src/sword/presets.ts` (a throwaway Node script; Node strips
     types).
   - Shoot it on the epic branch **before** your change into `shots/04/before/` and after it into
     `shots/04/baseline/`, both with `--picture --reduced-motion`, desk and phone, on port 3030.
   - Pixel diff every pair with a throwaway script in your scratchpad that loads both PNGs into a
     Playwright page and compares canvas pixels (no new dependency). Box, scene, picture and
     close frames: max difference 0. If a close frame differs, find out why; an animated light
     under reduced motion is a bug to report, not to accept.
   - Write `shots/04/diff.md`: one line per pair with its max difference. `shots/04/baseline/` is
     the bar every later gate in this epic shoots beside.
9. **ADR 0105**: the upright hold and its gestures (lean, tip, rights itself; the idle turn; why
   no spin in the hold), the item's own flourish (`'own'`) and why the rig rights an upright item
   during it, front framing and the handoff, the defaults that keep the wand and the sword
   unchanged and the pixel diff that proves it. Status Accepted.

## Acceptance

- With no new field set, `HeldRig` and `boxRig` behave exactly as before: the pixel diff is 0 on
  every pair, and every existing wand and sword test passes untouched.
- `hold.ts` is pure and unit-tested; the upright path uses it.
- `FlourishProbe` lives in its own file and the sword's close look still holds frames for
  `--flourish`.

## Tests to write first

- Unit, `hold.test.ts`: `heldTilt` for both holds and orientations (the level numbers equal
  today's); `dragUpright` clamps and its soft limit; `rightUpright` returns to within 0.5 degrees
  of upright within 1.5 s at 60 Hz, overshoots at most 25 percent, and under reduced motion never
  overshoots; `uprightFlourishWeight` is 0 outside the window, 1 in its middle, continuous.
- No iwft to write: re-run `src/shop.iwft.tsx` and `src/smithy.iwft.tsx` (ask the orchestrator
  first, port 3111).

## Verify

```bash
pnpm --filter armoury exec vitest run src/stage
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec playwright test -c playwright-ct.config.ts src/shop.iwft.tsx src/smithy.iwft.tsx   # ask the orchestrator first
```

## Out of scope

- Any potion code, mesh or stage (ticket 09 is the first upright user and checks the upright
  hold and front handoff by eye at the form gate).
- The slosh and the uncorking (14, 15).
- Changing `wave.ts`, the wand's or the sword's look, lights or framing.

## Comments
- 2026-11-13 orchestrator: built (0f174335, 029a9b04, aa471524), independent review r1 asked for three fixes (the front handoff contract, the soft limit's tests, a step under reduced motion), fixed (634f9ffc, 56ad137a), review r2 passed: the level path is the same arithmetic expression by expression, and every non-zero pixel pair is off the item and also appears between runs of unchanged code. Merged into the epic branch. The baseline later gates shoot beside is `shots/04/baseline/`.
