# 23 - Close look II: the mix in the glass

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 11, 14, 21 (and 20 through them)
**Parallel with:** 24, 13
**Model:** opus (shader work and timing judged by eye)
**Gate:** close look (the mix: the mixed potion at rest, the lift and the swirl)
**ADR:** none of its own; add "The mix" section to 0111 (after 14's, before 15's)
**Dev port:** 3042

## Goal

The heart of Ed's new mechanic (E14, E15): the liquid's second state and the move between them.
A mixed potion rests as one jewel colour (or murky brown-green) with its trait; a tap lifts the
bottle a little more and swirls its layers into that colour; a replay swirls an already mixed
potion. Build the show's pure clock with every beat up to and including the cork's pop and
return, so ticket 15 only adds what comes out of the neck.

## What Ed's pick fills in

L2 (soft band edges) and the look tickets 10 and 11 settled. Nothing new is asked of Ed; his
taste calls on the swirl (too fast, too slow, too busy) go to ticket 18's list.

## Read first

- `spec.md`: "The mixing rule" (`PotionMix`, the colour), "The look and the scene, in words"
  (the liquid in two states), "The close look: lift, swirl, uncork" (the beats, the reveal,
  fewer than three), "Accessibility and reduced motion" (the cross-fade).
- `decisions.md` (absolute path): E13-E16.
- ADRs 0105, 0109 (10 and 11), 0111 (14), 0113 (20), 0108's "The tap that mixes" (21).
- Source: `src/stage/potionMaterials.ts` and `PotionMesh.tsx` (10, 11: the bands, `setSurface`,
  traits, `LiquidMotes`), `PotionStage.tsx`, `PotionCloseUpStage.tsx` (14: slosh, levels),
  `HeldRig.tsx` (`flourish: 'own'`, `flourishSeconds`, `uprightFlourishWeight`),
  `FlourishProbe.tsx`, `src/stage/swordGlow.ts` and its test (the pure clock to copy);
  `src/potion/mix.ts`, `compile.ts` (`mixed`, `mix`, `layers`), `mixBeats.ts` (21).

Paths are relative to `apps/armoury/`.

## Files you own

New `src/stage/potionShow.ts` (+ `potionShow.test.ts`), `src/stage/potionMaterials.ts` (+
test; the liquid's mix and swirl only), `src/stage/PotionMesh.tsx`, `src/stage/PotionStage.tsx`
(the mixed state at rest), `src/stage/PotionCloseUpStage.tsx`, `src/potion/mixBeats.ts`
(retiming only), `docs/adr/0111-armoury-potion-close-look.md` (one section).

## Scope

1. **The mixed state at rest** (box stage, close look, the picture): when `spec.mixed`, the
   liquid is one band of `spec.mix.colour`, full, with `spec.mix.trait` (11's trait programs).
   Build the `murk` trait here, on 11's motes: milky brown-green with slowly sinking specks (no
   ingredient has it, so 11 cannot show it). Glow under the cap at rest. The wax seal and the label read the mixed colour
   and gold from the spec as before.
2. **The liquid's mix uniforms**: `uMix` (0 layered, 1 mixed) and `uSwirl` (0-1, the vortex),
   written through the material: a domain warp twisting the band coordinate about the bottle's
   axis, strongest mid-swirl, so the bands wind into spirals and blend into the mixed colour as
   `uMix` reaches 1; on a replay `uMix` stays 1 and `uSwirl` alone runs, the ingredient colours
   flaring through the streaks and fading back. Traits cross-fade from the bands' to the mix's.
   The surface stays level; the warp never crosses the surface plane or the glass.
3. **`potionShow.ts`**, pure: `potionShow(sinceStart, { firstMix, full, reducedMotion })` returns
   `{ lift, mix, swirl, stopperLift, stopperTurn, popped, emit, age, cap }` with named beats as
   the spec's "The show" proposes; the pop exactly at `MIX_REVEAL_SECONDS` (reduced:
   `MIX_REVEAL_SECONDS_REDUCED`). `emit`, `age` and `cap` are placeholders at rest values here
   (15 fills them). Fewer than three (`full` false): a 0.4 s stopper rattle only. Reduced
   motion: no lift, `mix` cross-fades 0 to 1 over 0.3 s (or stays 1 on a replay), the stopper
   out without travel for the effect's hold, then back. `lift` is a small rise (about 6 percent
   of the bottle's height) and settle, in the rig's held frame.
4. **`PotionCloseUpStage.tsx`**: `flourishSeconds` set to the show's length; on `flourishAt`
   decide `firstMix` from the params at that moment (not mixed and three in) and drive `uMix`,
   `uSwirl`, the lift and `stopperLift` from the clock; a tap during a show restarts it; the
   params turning mixed at the reveal (21's timer) must not jump the look (the clock already
   holds `mix` at 1 by then). Keep 14's slosh running throughout.
5. **ADR 0111 "The mix"**: the two liquid states, the vortex and why a warp (no simulation),
   the beats and the reveal at the pop, the replay, fewer than three, reduced motion.

## Acceptance

- A full unmixed potion picked up lifts, swirls into its mixed colour by the pop at
  `MIX_REVEAL_SECONDS`, and stays that colour; put back, the box shows the mixed potion.
- A mixed potion picked up again swirls and settles back to the same colour (no layered flash).
- A murky mix swirls into brown-green with sinking specks and still looks like a nice thing to
  have in a bottle.
- Fewer than three: only the stopper rattles; nothing swirls.
- Reduced motion: nothing travels or spins; the layers cross-fade to the mix in 0.3 s.
- Frame cost on the M3 at phone size during the swirl within the wand's close look plus 2 ms
  (measured by hand, recorded in Comments).

## Tests to write first

- Unit, `potionShow.test.ts`: rest before and after; beats in order; the pop exactly at the
  reveal constant (both modes); `mix` monotone 0 to 1 on a first mix and 1 throughout a replay;
  continuous at 60 Hz; the rattle for fewer than three; reduced motion's shape.
- Unit, `potionMaterials.test.ts`: `setMix(mix, swirl)` writes uniforms, not props; the mixed
  state's emissive under the cap.

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/stage src/potion
pnpm --filter armoury run build
```

## Close look gate (the mix)

Protocol: spec rule 15. Shots into `shots/23/r<N>/` with `--freeze=1.2` for rest frames and
`--flourish=0.2,0.6,1.0,1.4,1.8,2.0,5.4` for the arrival show (the potion flourishes on arrival
since 21; 14 made `--flourish` hold a potion), plus one tap replay. Set `shots/sets/mix.json`:
the first-visit potion (its first mix), the eight presets at rest mixed (box and close), a murky
recipe, a pure recipe, a secret blend (gold), a two-ingredient bottle (the rattle); desk and
phone; a `--reduced-motion` pass.

The reviewer judges beside ticket 11's last passing round: the layers visibly wind into one
colour, as liquid, not as a colour fade; the mixed colours are jewel-like and each reads as its
recipe; murky is muddy but charming; the lift is gentle; no clipping through glass, surface or
stopper; the mixed state at rest looks as good as the layered one; reduced motion is still.

## Out of scope

- What comes out of the neck and the bloom exception (15). The pour (12). Sound.

## Comments
- 2026-11-13 orchestrator, from ticket 09: the stopper's beats drive `stopperLift` through a `{ current }` holder written in `useFrame` (no React render); the swirl's surface goes through `surfaceNormal` in the rig's up frame, as ticket 14's slosh does.
- 2026-11-13 orchestrator, from the review of ticket 21 (`reviews/21-r1.md`): the stage receives `mixed: yes` at 1.9 s, mid-show, and must not restart or snap (have the swirl fully mixed by 1.6 s). An early close changes `mixed` during the put-back flight; that must look right too. Restart the stage's show on every flourish so it stays in step with the shell's timer. Decide what closing during the lift, before the bottle arrives, should do: today no timer exists yet, so the potion stays unmixed. `MURK_REACH` lives in `src/potion/wheel.ts` and must stay between 0.684 and 0.879 or the outcome counts change.
