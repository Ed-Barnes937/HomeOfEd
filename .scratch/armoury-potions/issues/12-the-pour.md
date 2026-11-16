# 12 - The pour

**Status:** ready-for-agent (waits for tickets 23 and 14)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 23 (it takes `potionMaterials.ts`, `PotionMesh.tsx` and `PotionStage.tsx` after
the mix), 14 (`scripts/gpu-shots.mjs`)
**Parallel with:** 15, 24
**Model:** opus
**Gate:** materials (the pour in the box stage)
**ADR:** none of its own; add a "The pour" section to 0109
**Dev port:** 3035

## Goal

Make every pour visible: when the child taps a jar, the stopper lifts aside, a thin stream in the
ingredient's colour pours into the neck, the new band rises from the old surface to its level and
its trait starts, and the stopper drops back. Try another refills the bottle with a quick cascade
of three pours, bottom first. The child sees each layer go in before the tap that mixes them.
("Put the last one back" is gone from the potion shop, E17.)

## What Ed's pick fills in

The look from tickets 10, 11 and 23 (glass, liquid, light, L2). The stream is drawn in the same
liquid style. Nothing new is asked of Ed here.

## Read first

- `spec.md`: "The experience, on a phone" (steps 3 and 8), "Accessibility and reduced motion"
  (no stream, no cascade), "Rules for the team".
- `research/experience-options.md` (absolute path): Option 2 "Fit" (the stage animates a pour by
  comparing previous and new params; stage-local).
- ADRs 0109, 0111 (23's "The mix"), 0113.
- Source: `src/stage/PotionStage.tsx`, `PotionMesh.tsx` (the `stopperLift` and `levels` props),
  `potionMaterials.ts` (`setSurface`), `LiquidMotes.tsx`; `src/potion/pours.ts`, `profile.ts`
  (`uprightLevels`, `stopperSeat`); `src/shop/ShopPage.tsx` and `src/shop/shopView.ts`
  (`arrivals`, which counts Try another and Load); `src/stage/wave.ts` (a pure clock and
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
   anything else (an empty, a shape change, the mix) is null (the bottle redraws at once).
   `pourClock(since, reducedMotion)`: stopper lifts and tips aside (0-0.25 s), the stream starts
   and the band rises with an ease-out (0.25-0.95 s), the stream thins and stops (0.95-1.1 s), the
   stopper drops back (1.1-1.35 s); returns `{ stopperLift, stream, rise }`. Under reduced motion
   it is at its end at once. `cascadeClock(since, count, reducedMotion)`: the same, about 0.3 s a
   pour, bottom first, at most 0.9 s for three.
2. **`PourStream.tsx`**: a thin tapered ribbon or cylinder from above the neck into the bottle,
   in the ingredient's colour and liquid look, with a slight wobble on `uTime`; drawn between the
   liquid and the glass front in render order; no splash particles (fill rate).
3. **`PotionStage.tsx`**: keeps the previous params; on a pour change plays `pourClock` (the
   rising band's top level interpolated from the old surface to its new level via `levels`, the
   stopper via `stopperLift`); on a change in `arrivals` that brings an unmixed potion plays `cascadeClock` (a mixed potion
   that arrives, from the shelf or a link, is drawn mixed at once). A second
   tap during a pour finishes the first at once and starts the next.
4. **Script:** `--pour=<ingredient>` taps that jar in the panel and shoots frames at fixed times
   through the pour (stage held still at each moment, as `--flourish` does for the close look).
5. **ADR 0109 "The pour" section**: stage-local, from params; the beats; the cascade; reduced
   motion.

## Acceptance

- A tap on a jar plays the pour once, in about 1.35 s, ending on exactly the bottle the params
  describe; a quick second tap never leaves a half-poured band.
- Try another cascades three pours; a mixed potion loaded from the shelf does not cascade;
  reduced motion skips the cascade.
- No splash, no steam; the stream reads at phone size.

## Tests to write first

- Unit, `pour.test.ts`: `pourChange` detects only an added top pour; `pourClock` starts and ends
  at the rest pose, `rise` monotone, the stopper back by 1.35 s, continuous at 60 Hz, at its end
  under reduced motion; `cascadeClock` bounded at 0.9 s for three.
- No new iwft (the fake stage does not animate; `src/pours.iwft.tsx` stays green).

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/stage
```

## Materials gate

Protocol: spec rule 15. Shots into `shots/12/r<N>/`: pours of four contrasting ingredients onto
a two-layer potion in three shapes (the third layer going in), frames at the lift, mid-stream, the band half risen, the
stopper back; a Try another cascade; desk and phone; a `--reduced-motion` pass.

The reviewer judges: the pour reads as pouring (a stream, a rising band), the stopper's lift and
return look physical, nothing clips through the glass, the end state equals the static bottle,
reduced motion is instant.

## Out of scope

- Animated emptying or draining ("Empty the bottle" redraws at once). Sound. The close look and
  the mix (23).

## Comments
- 2026-11-13 planner (re-plan, E13-E17): three slots, no take-out, no Put the last one back in this shop; the cascade is three pours; mixed arrivals draw at once. Blocked by 23 for the shared stage files.
- 2026-11-13 orchestrator, from ticket 09: `stopperLift` takes a number or a `{ current: number }` holder in mm along the axis (0 is seated); write the holder from a `useFrame`, never React state. `levels` (each band's top in mm, bottom first) is read every frame; leave it unset to get the volume-keeping levels at the current tilt.
- 2026-11-14 orchestrator, from the reviews of ticket 11 (`reviews/11-r1.md`, `reviews/11-r2.md`): the bubbles of a rising top band are continuous by construction (tested in `traits.test.ts`, "the bubbles' rise"). In an unfrozen pour, watch the edge fade of the motes' rest points as the top climbs past them, and the clinging beads appearing as the level passes them on the glass (it should look like liquid wetting the glass).
- 2026-11-16 orchestrator: built straight after the first version (E28, O28). From ticket 23 and its review: a pour never meets `uMix` above 0, and `setMixed(null)` covers fewer than three; a mote's band is still chosen by its rest height; the box draws from `built`, a frame or two behind the params, on every pour, and ticket 23's no-rebuild fix must be left as it is.
