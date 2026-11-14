# 15 - Close look III: the uncorking and its effect

**Status:** ready-for-agent (waits for ticket 23)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 23 (and through it 11, 14, 20, 21)
**Parallel with:** 12, 24
**Model:** opus
**Gate:** close look (the uncorking)
**ADR:** completes 0111
**Dev port:** 3038

## Goal

What comes out when the cork pops (E13, O3, O4): the potion's effect rises out of the neck in its
colours for a few seconds, then fades; a murky potion lets out one fat, lazy bubble that goes
"blorp". Seven programs of one parameterised particle system, bounded in count, size, place and
time; the only moment anything on the potion may exceed the bloom cap. Ticket 23 built the
show's clock up to the pop and the stopper's return; you fill in the effect between them.

## What Ed's pick fills in

The look and light from ticket 10 (G1, L2, M1), the traits from 11 and the mix from 23, so the
effects belong to the same bottle. Nothing new is asked of Ed; his taste calls (does Whiffy amuse
or put off, is Dreamy too quiet, is the murky blorp charming) go in ticket 18's list.

## Read first

- `spec.md`: "The effect: what it does" (seven kinds, strength, colours), "The close look: lift,
  swirl, uncork" (the beats, bounds), "Accessibility and reduced motion" (the still effect).
- `decisions.md` (absolute path): E3, E13, E16, O3, O4.
- ADRs 0100 (the bloom exception as the sword did it), 0105, 0111 (14's and 23's sections),
  0113.
- Source: `src/stage/potionShow.ts` (23; its `emit`, `age` and `cap` are yours to fill),
  `src/stage/swordGlow.ts` and its test, `src/stage/Sparkles.tsx` and `SpellBurst.tsx` (bounded
  particles with a material built once), `glow.ts`, `HeldRig.tsx` (`flourishSeconds`),
  `FlourishProbe.tsx`, `PotionCloseUpStage.tsx` (23); `src/potion/effects.ts`, `mix.ts`,
  `profile.ts` (`stopperSeat`); `scripts/gpu-shots.mjs` (14's `--flourish` for potions and the
  replay).

Paths are relative to `apps/armoury/`.

## Files you own

New `src/stage/effectKinds.ts` (+ test), new `src/stage/EffectShow.tsx`,
`src/stage/potionShow.ts` (+ test; the effect's `emit`, `age` and `cap` only, not the beats 23
settled), `src/stage/PotionCloseUpStage.tsx`, `docs/adr/0111-armoury-potion-close-look.md`. No
edits to `PotionMesh.tsx`, `potionMaterials.ts` or `gpu-shots.mjs`; ask the orchestrator if one
is needed.

## Scope

1. **`potionShow.ts`**: from the pop at `MIX_REVEAL_SECONDS`, `emit` rises over about 0.8 s and
   the effect lives on to the stopper's return (23's beat); `age` runs from the pop; `cap` is
   `0.92 * BLOOM_THRESHOLD` at rest and lifted during the effect only. Reduced motion: `age`
   fixed, the effect fades in over 0.3 s, holds 1.2 s, fades out over 0.5 s, inside 23's stopper
   window.
2. **`effectKinds.ts`**, pure: for each `PotionEffect['kind']`, a particle program `(seed, i, age,
   strength) => { position, size, alpha }` in the bottle's neck frame: floating (big slow
   see-through bubbles drifting up and sideways), sparkling (a fountain that rises and rains
   down), dreamy (a few soft stars rising, twinkling, fading), glowing (motes spiralling out and
   hovering), whirling (a ribbon of points spiralling up), whiffy (one small round puff of at
   most six soft sprites that swells and fades, plus a few wisps), murky (one fat bubble that
   wobbles out of the neck, hangs, and pops into a few droplets). Counts scale with `strength`
   (1-3) within bounds: at most 300 points, at most six smoke sprites, sprites at most 64 px at
   the phone's size, all inside a box above the neck that fits the close look's frame, all gone
   before the stopper returns. Colours: the effect's `colours` (the mixed colour first), cycled.
3. **`EffectShow.tsx`**: one instanced draw (plus at most six sprites for whiffy) with a material
   built once, uniforms written through it (`stage/glow.ts`), drawn after the liquid and before
   the glass front, at the neck in world space so it rises straight up even if the bottle leans.
   Decide the bloom route here (the spike left none: the potion canvas has no post pass at rest):
   a composer mounted only while the show runs, or capped additive sprites with no composer;
   prefer whichever keeps the glass looking the same at the moment the show starts and ends.
4. **`PotionCloseUpStage.tsx`**: drive `EffectShow` from the clock and `potionEffect` of the mix
   being shown (on a first mix the params are not yet mixed: use `spec.mix`, as 23 does); a
   bottle with fewer than three shows nothing (23's rattle only); a tap during a show restarts
   it.
5. **ADR 0111** (complete it): the effect window after the pop, the seven kinds as one
   parameterised system, murky's blorp and why it is not a failure, bounds, the bloom exception
   (what, where, how long, against ADRs 0082, 0083, 0100), reduced motion, why nothing is acted
   out. Status Accepted.

## Acceptance

- Each mix's pop releases its own effect in its colours, bigger with more of the same, gone by
  the stopper's return; a replay repeats it.
- A murky potion's blorp reads as a joke the potion is in on, not as a broken effect.
- Outside the show nothing exceeds the bloom cap; whiffy never fills the screen.
- Reduced motion: nothing flies or travels; the effect still shows, as a fade.

## Tests to write first

- Unit, extend `potionShow.test.ts`: `emit` zero before the pop and after the effect window;
  `cap` lifted only inside it; reduced motion's fade shape and still `age`; 23's beats unchanged.
- Unit, `effectKinds.test.ts`: for every kind and strength 1-3 over the whole show, every
  particle inside the bounding box, counts and sizes within bounds, alpha 0 by the end of the
  window, deterministic for a seed.
- iwft: none new; re-run `src/apothecary.iwft.tsx` (ask the orchestrator first).

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/stage
```

## Close look gate

Protocol: spec rule 15. Shots into `shots/15/r<N>/` with 14's `--flourish=` hold on the arrival
show and one tap replay: one recipe per outcome at strength 1 and 3 (murky at 1), a secret blend,
a two-ingredient bottle (nothing comes out); frames at the pop, the effect's peak, its fade and
rest; desk and phone; a `--reduced-motion` pass.

The reviewer judges: each kind reads as itself and as coming out of this bottle; colours match
the mixed potion; bounded and on screen; the pop and the stopper look physical; no smear of
bloom; the effect does not hide the bottle for long; murky's blorp is charming; reduced motion is
still and still shows the effect.

## Out of scope

- The lift, the swirl and the stopper's beats (23). Bespoke per-effect animation, the bottle
  acting the effect out, drinking, sound, a shop flash.

## Comments
- 2026-11-13 orchestrator, from the look spike (ticket 01): the potion canvas has no post pass at rest, so the uncorking's bloom has no composer to use. Decide the route here and record it in ADR 0111: a composer mounted only while the show runs, or capped additive sprites with no composer. Prefer whichever keeps the glass looking the same at the moment the show starts and ends (no pop).
- 2026-11-13 planner (re-plan, E13-E16): the clock, the lift, the swirl and the stopper's beats moved to ticket 23; this ticket fills the effect after the pop. Murky (one lazy bubble) joins the six kinds; strength is 1-3; an empty bottle can no longer be uncorked (fewer than three only rattles).
- 2026-11-13 orchestrator, from ticket 09: drive the stopper with a `{ current }` holder passed as `stopperLift`, read as the stopper is drawn, with no React render.
- 2026-11-14 orchestrator, from the review of ticket 14: a child can hold a drag through the pop, so the effect must come from the neck's world position and stay right at a lean; it must stay on screen at lean 59 either way on a 360 wide phone, where the cork is about 4 percent from the edge. Stoppers are cork and glass only (the wax seal is cut).
- 2026-11-14 orchestrator, from the reviews of ticket 11 (`reviews/11-r1.md`, `reviews/11-r2.md`): the motes add their light over the already capped liquid (premultiplied, cover 0.15 to 0.3), so a fleck's flash (3 times the candle) and the clinging beads' glint (1.2 times) can sum above `REST_CAP`; when the bloom pass comes on for the uncorking, check neither blooms.
