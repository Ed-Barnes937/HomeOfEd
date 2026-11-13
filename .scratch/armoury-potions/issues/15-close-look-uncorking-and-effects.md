# 15 - Close look II: the uncorking and its effect

**Status:** ready-for-agent (waits for Ed's pick via tickets 10 and 11)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 05, 11, 14
**Parallel with:** 12, 16
**Model:** opus
**Gate:** close look (the uncorking)
**ADR:** completes 0111
**Dev port:** 3038

## Goal

The potion's flourish (O3): a tap rights the bottle, twists the stopper out with a pop, and the
potion's effect comes out of the neck in its colours for about three seconds, then the stopper
goes back in. Six effect kinds, one parameterised particle system (O4), bounded in count, size,
place and time; the only moment anything on the potion may exceed the bloom cap.

## What Ed's pick fills in

The look and light from ticket 10 and the traits from 11, so the effects belong to the same
bottle. Nothing new is asked of Ed; his taste calls on the effects (does Whiffy amuse or put off,
is Dreamy too quiet) go in ticket 18's list.

## Read first

- `spec.md`: "The effect: what it does" (the six kinds, strength, colours), "The close look"
  (the uncorking, bounds), "Accessibility and reduced motion" (the still effect), "Rules for the
  team".
- `decisions.md` (absolute path): E3, O3, O4.
- ADRs 0100 (the bloom exception as the sword did it), 0105, 0111 (ticket 14).
- Source: `src/stage/swordGlow.ts` and `swordGlow.test.ts` (the pure clock to copy),
  `src/stage/Sparkles.tsx` and `SpellBurst.tsx` (bounded particles with a material built once),
  `glow.ts`, `HeldRig.tsx` (`flourish: 'own'`, `flourishSeconds`), `FlourishProbe.tsx`,
  `PotionCloseUpStage.tsx` (ticket 14), `PotionMesh.tsx` (`stopperLift`); `src/potion/effects.ts`,
  `profile.ts` (`stopperSeat`); `scripts/gpu-shots.mjs` (ticket 14's `--uncork`).

Paths are relative to `apps/armoury/`.

## Files you own

New `src/stage/potionShow.ts` (+ test), new `src/stage/effectKinds.ts` (+ test), new
`src/stage/EffectShow.tsx`, `src/stage/PotionCloseUpStage.tsx`,
`docs/adr/0111-armoury-potion-close-look.md`. No edits to `PotionMesh.tsx` (drive
`stopperLift`), `potionMaterials.ts` or `gpu-shots.mjs`; ask the orchestrator if one is needed.

## Scope

1. **`stage/potionShow.ts`**, pure: `potionShow(sinceTap, reducedMotion): { stopperLift: number;
   stopperTurn: number; emit: number; age: number; cap: number }` with named constants for the
   beats (proposed, settled at the gate): the bottle eases upright (0-0.3 s, the rig's
   `uprightFlourishWeight` does this), the stopper twists a quarter turn and rises 6 mm (0.3-0.7
   s), the pop (0.7 s), the effect emits (0.7-1.5 s) and lives on (to 3.5 s), the stopper
   settles back (3.5-4.0 s), rest. `cap` is `0.92 * BLOOM_THRESHOLD` at rest, lifted during the
   effect only. Reduced motion: the stopper lifts at once and stays out for the show, the effect
   is a still arrangement (`age` fixed) that fades in over 0.3 s, holds 1.2 s and fades out over
   0.5 s, then the stopper is back.
2. **`stage/effectKinds.ts`**, pure: for each `EffectKind`, a particle program
   `(seed, i, age, strength) => { position, size, alpha }` in the bottle's neck frame: floating
   (big slow see-through bubbles drifting up and sideways), sparkling (a fountain that rises and
   rains down), dreamy (a few soft stars rising, twinkling, fading), glowing (motes spiralling
   out and hovering), whirling (a ribbon of points spiralling up), whiffy (one small round puff
   of at most six soft sprites that swells and fades, plus a few wisps). Particle counts scale
   with `strength` within bounds: at most 300 points, at most six smoke sprites, sprites at most
   64 px at the phone's size, all inside a box above the neck that fits the close look's frame,
   all gone by 3.5 s. Colours: the effect's `colours`, cycled.
3. **`EffectShow.tsx`**: one instanced draw (plus at most six sprites for whiffy) with a material
   built once, uniforms written through it (`stage/glow.ts`), drawn after the liquid and before
   the glass front, positioned at the neck in world space so it rises straight up even if the
   bottle was leaning.
4. **`PotionCloseUpStage.tsx`**: `flourishSeconds` set to the show's length; on `flourishAt`,
   drive `stopperLift` and `EffectShow` from `potionShow` and `potionEffect(params)`; an empty
   bottle pops its stopper and shows nothing; a tap during a show restarts it.
5. **ADR 0111** (complete it): the uncorking's beats, the six kinds as one parameterised system,
   bounds, the bloom exception (what, where, how long, against ADRs 0082, 0083, 0100), reduced
   motion, why nothing is acted out. Status Accepted.

## Acceptance

- A tap (or "Uncork it") uncorks once; the effect matches the potion's kind and colours, is bigger
  with more of the same, and is gone with the stopper back by about 4 s.
- No flourish on arrival (ticket 07's iwft keeps passing); every tap repeats the show.
- Outside the show nothing exceeds the bloom cap; whiffy never fills the screen.
- Reduced motion: nothing flies or travels; the effect still shows, as a fade.

## Tests to write first

- Unit, `potionShow.test.ts`: rest values before and long after; beats in order; the stopper back
  by 4 s; `cap` lifted only inside the effect window; continuous at 60 Hz; reduced motion's fade
  shape and still `age`.
- Unit, `effectKinds.test.ts`: for every kind and strength 1-4 over the whole show, every particle
  inside the bounding box, counts and sizes within bounds, alpha 0 by 3.5 s, deterministic for a
  seed.
- iwft: none new; re-run `src/apothecary.iwft.tsx` (ask the orchestrator first).

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/stage
```

## Close look gate

Protocol: spec rule 15. Shots into `shots/15/r<N>/` with ticket 14's `--uncork=` hold (the probe
holds the stage at each moment after the tap; `FlourishProbe` is mounted by ticket 14): one potion per
effect kind at strength 1 and 4, a secret blend, an empty bottle; frames at the lift, the pop,
the effect's peak, its fade and rest; desk and phone; a `--reduced-motion` pass.

The reviewer judges: each kind reads as itself and as coming out of this bottle; colours match the
potion; bounded and on screen; the pop and the stopper look physical; no smear of bloom; the
effect does not hide the bottle for long; reduced motion is still and still shows the effect.

## Out of scope

- Bespoke per-effect animation, the bottle acting the effect out, drinking, sound, a shop flash.

## Comments
- 2026-11-13 orchestrator, from the look spike (ticket 01): the potion canvas has no post pass at rest, so the uncorking's bloom has no composer to use. Decide the route here and record it in ADR 0111: a composer mounted only while the show runs, or capped additive sprites with no composer. Prefer whichever keeps the glass looking the same at the moment the show starts and ends (no pop).
