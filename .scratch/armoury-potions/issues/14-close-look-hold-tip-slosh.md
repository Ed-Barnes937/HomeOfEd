# 14 - Close look I: held upright, tipped, sloshing

**Status:** ready-for-agent (waits for Ed's pick via ticket 10)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 04, 10
**Parallel with:** 11, 13
**Model:** opus
**Gate:** close look (the hold and the slosh)
**ADR:** 0111 (write it; ticket 15 completes it)
**Dev port:** 3037

## Goal

The free play before the tap (O3): the lifted bottle stands upright, leans and tips under the
child's finger, and its liquid stays level and sloshes, every band keeping its place and volume,
then settles when the bottle rights itself. Pure, unit-tested dynamics; the look judged on a real
GPU.

## What Ed's pick fills in

The glass and liquid look from ticket 10. Nothing new is asked of Ed.

## Read first

- `spec.md`: "The close look" (the hold, free play), "Accessibility and reduced motion" (the
  liquid stays level under reduced motion but does not wobble), "Rules for the team".
- `research/experience-options.md` (absolute path): "Rendering", the liquid-fill bullet (slosh as
  a damped spring on the plane's tilt fed by angular velocity).
- ADRs 0105 (the upright hold), 0107 (the tipped table), 0109 (`setSurface`).
- Source: `src/stage/hold.ts`, `HeldRig.tsx`, `src/stage/PotionCloseUpStage.tsx`,
  `PotionMesh.tsx` (`levels`, `surfaceNormal` props), `potionMaterials.ts` (`setSurface`);
  `src/potion/tipped.ts`; `src/stage/swordGlow.ts` and its test (a pure clock's test style).

Paths are relative to `apps/armoury/`.

## Files you own

New `src/stage/slosh.ts` (+ `slosh.test.ts`), `src/stage/PotionCloseUpStage.tsx`,
`scripts/gpu-shots.mjs` (`--uncork`, after ticket 10; it passes to 12 after you),
`docs/adr/0111-armoury-potion-close-look.md`. You drive `PotionMesh`'s `levels` and
`surfaceNormal` props and do not edit `PotionMesh.tsx` or `potionMaterials.ts`; if a uniform is
missing, ask the orchestrator (ticket 11 or 12 holds those files).

## Scope

1. **`stage/slosh.ts`**, pure: `stepSlosh(state, bottleUp, angularVelocity, dt, reducedMotion)`:
   the surface's normal is world up plus a damped spring wobble driven by the bottle's angular
   velocity (a pendulum of about 0.6 s period, settling within about 2 s, the wobble capped at 12
   degrees so the surface never flips), plus a small travelling wave amplitude for the shader if
   ticket 10's material takes one. Under reduced motion the normal is world up exactly.
2. **Levels when tipped:** every frame, `levelsAt(levelTable(spec), tilt)` gives the band tops
   for the bottle's tilt from upright; the table is built once per spec (memoised, not per frame).
3. **`PotionCloseUpStage.tsx`**: reads its own world orientation each frame (no rig change), keeps
   the previous orientation to estimate angular velocity, steps the slosh, and passes `levels` and
   `surfaceNormal` to `PotionMesh`. Mount `FlourishProbe` so the shots script can hold frames.
4. **Script:** `--uncork=0.5,1.2,2.4` for kinds that do not flourish on arrival: once the
   bottle is held, tap it (trying a little either side of the middle, as `--glints` does), then
   hold and shoot the stage at each moment after the tap through `FlourishProbe`, and finally
   tap away and shoot the put-back. `--flourish` and `--glints` keep working for the sword.
   Ticket 15 uses it; check it here on the minimal close look (the tap is already recorded).
   Also `--settle=100,200,400,800,1600`: after each `--leans` or `--tips` release, shoot at those
   milliseconds so the slosh's settle can be judged.
5. **ADR 0111** (started here): the hold as ADR 0105 built it, the slosh model and its bounds,
   tipped levels from the table, reduced motion. Ticket 15 adds the uncorking.

## Acceptance

- Leaning and tipping the held bottle keeps the liquid's surface level (within the wobble) and the
  bands in order, each keeping its volume (by the table's 2 percent).
- Letting go, the bottle rights itself and the liquid sloshes once or twice and settles.
- Under reduced motion the liquid is level with no wobble.
- Frame cost on the M3 at phone size stays within the wand's close look plus 2 ms (measured by
  hand, recorded in Comments).

## Tests to write first

- Unit, `slosh.test.ts`: at rest the normal is world up; an impulse wobbles within 12 degrees and
  settles to within 0.5 degrees in 2.5 s at 60 Hz; no step larger than a small bound per frame;
  reduced motion is exactly up; continuous for a long random but seeded drag sequence.

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/stage
```

## Close look gate

Protocol: spec rule 15. Shots into `shots/14/r<N>/` with `--freeze=1.2 --leans=35,-50 --tips=25
--settle=100,200,400,800,1600`, so the reviewer sees the held pose and the settle after release:
the first-visit potion, a four-band potion with strong contrasts, the tall bottle, the gourd, a
one-pour bottle; desk and phone; a `--reduced-motion` pass.

The reviewer judges beside ticket 10's close frames: the liquid is level while the glass leans;
bands stay level and in order; the slosh reads as liquid, not jelly or a spinning plate; no
clipping through the glass or the stopper; the cap never shows a seam; reduced motion is level and
still.

## Out of scope

- The uncorking and effects (15). Pouring out of the bottle. Bubbles reacting to the slosh.

## Comments
- 2026-11-13 orchestrator, from the review of ticket 06: tipped levels are heights along world up from the foot's centre, in the bottle's millimetre frame (`tipped.ts`, ADR 0107), and feed the `levels` and `surfaceNormal` props together. Build the level table once per spec (it costs 6 to 10 ms), then look up by angle each frame; never rebuild it per frame.
