# 12 - The pour

**Status:** ready-for-agent (waits for Ed's pick via tickets 10 and 11)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 11, 14 (it takes `scripts/gpu-shots.mjs` after 14's `--uncork` lands)
**Parallel with:** 13, 15, 16
**Model:** opus
**Gate:** materials (the pour in the box stage)
**ADR:** none of its own; add a "The pour" section to 0109
**Dev port:** 3035

## Goal

Make every pour visible: when the child taps a jar, the stopper lifts aside, a thin stream in the
ingredient's colour pours into the neck, the new band rises from the old surface to its level and
its trait starts, and the stopper drops back. Try another and "Put the last one back" refill the
bottle with a quick cascade of pours, bottom first. This is the "process" of Option 2: the child
sees every step happen.

## What Ed's pick fills in

The look from tickets 10 and 11 (glass, liquid, light). The stream is drawn in the same liquid
style. Nothing new is asked of Ed here.

## Read first

- `spec.md`: "The experience, on a phone" (steps 3 and 6), "Accessibility and reduced motion"
  (no stream, no cascade), "Rules for the team".
- `research/experience-options.md` (absolute path): Option 2 "Fit" (the stage animates a pour by
  comparing previous and new params; stage-local).
- ADR 0109.
- Source: `src/stage/PotionStage.tsx`, `PotionMesh.tsx` (the `stopperLift` and `levels` props),
  `potionMaterials.ts` (`setSurface`), `LiquidMotes.tsx`; `src/potion/pours.ts`, `profile.ts`
  (`uprightLevels`, `stopperSeat`); `src/shop/ShopPage.tsx` and `src/shop/shopView.ts`
  (`arrivals`, which counts Try another, Put back and Load); `src/stage/wave.ts` (a pure clock and
  its tests).

Paths are relative to `apps/armoury/`.

## Files you own

New `src/stage/pour.ts` (+ `pour.test.ts`), new `src/stage/PourStream.tsx`;
`src/stage/PotionStage.tsx`, `src/stage/PotionMesh.tsx` (driving the props only),
`src/stage/potionMaterials.ts` (a stream material only), `scripts/gpu-shots.mjs` (`--pour=`),
`docs/adr/0109-armoury-potion-look.md` (one section).

## Scope

1. **`stage/pour.ts`**, pure: `pourChange(before, after): PourPlan | null` compares the pour lists
   of the previous and new params: one pour added on top is `{ kind: 'pour', ingredient, slot }`;
   anything else (a take-out, an empty, a shape change) is null (the bottle redraws at once).
   `pourClock(since, reducedMotion)`: stopper lifts and tips aside (0-0.25 s), the stream starts
   and the band rises with an ease-out (0.25-0.95 s), the stream thins and stops (0.95-1.1 s), the
   stopper drops back (1.1-1.35 s); returns `{ stopperLift, stream, rise }`. Under reduced motion
   it is at its end at once. `cascadeClock(since, count, reducedMotion)`: the same, about 0.3 s a
   pour, bottom first, at most 1.2 s for four.
2. **`PourStream.tsx`**: a thin tapered ribbon or cylinder from above the neck into the bottle,
   in the ingredient's colour and liquid look, with a slight wobble on `uTime`; drawn between the
   liquid and the glass front in render order; no splash particles (fill rate).
3. **`PotionStage.tsx`**: keeps the previous params; on a pour change plays `pourClock` (the
   rising band's top level interpolated from the old surface to its new level via `levels`, the
   stopper via `stopperLift`); on a change in `arrivals` with pours plays `cascadeClock`. A second
   tap during a pour finishes the first at once and starts the next.
4. **Script:** `--pour=<ingredient>` taps that jar in the panel and shoots frames at fixed times
   through the pour (stage held still at each moment, as `--flourish` does for the close look).
5. **ADR 0109 "The pour" section**: stage-local, from params; the beats; the cascade; reduced
   motion.

## Acceptance

- A tap on a jar plays the pour once, in about 1.35 s, ending on exactly the bottle the params
  describe; a quick second tap never leaves a half-poured band.
- Try another and Put the last one back cascade; reduced motion skips both.
- No splash, no steam; the stream reads at phone size.

## Tests to write first

- Unit, `pour.test.ts`: `pourChange` detects only an added top pour; `pourClock` starts and ends
  at the rest pose, `rise` monotone, the stopper back by 1.35 s, continuous at 60 Hz, at its end
  under reduced motion; `cascadeClock` bounded at 1.2 s.
- No new iwft (the fake stage does not animate; `src/pours.iwft.tsx` stays green).

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/stage
```

## Materials gate

Protocol: spec rule 15. Shots into `shots/12/r<N>/`: pours of four contrasting ingredients onto
the first-visit potion in three shapes, frames at the lift, mid-stream, the band half risen, the
stopper back; a Try another cascade; desk and phone; a `--reduced-motion` pass.

The reviewer judges: the pour reads as pouring (a stream, a rising band), the stopper's lift and
return look physical, nothing clips through the glass, the end state equals the static bottle,
reduced motion is instant.

## Out of scope

- Animated take-outs or draining (a take-out redraws at once). Sound. The close look.

## Comments
