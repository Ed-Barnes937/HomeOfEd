# 23 - Close look II: the mix in the glass

**Status:** done
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
- 2026-11-14 orchestrator, from the review of ticket 14 (`reviews/14-r1.md`): (a) change `flourishSeconds` (`PotionCloseUpStage.tsx`, still 4) together with `FLOURISH_OVER_SECONDS = 4.3` in `scripts/gpu-shots.mjs`; better, have the dev probe publish the value so the script reads it. (b) The lift is a translation, so it will not slosh, and that is right. (c) The swirl's warp should measure heights along the sloshed surface up, as the bands do. (d) Keep `Sloshing` outside anything keyed on `mixed`. (e) Reshape `uprightFlourishWeight` rather than adding a second hold. (f) Close the one untested wiring gap while you are in there: the take-from-hold call site in `HeldRig.tsx` can be disabled without a test failing; move the hold-back transitions into a pure function in `hold.ts` and test it. (g) Frame cost after ticket 14: potion close look 1.85 ms idle, 1.55 ms dragging, at 390x844 DPR 3 on the M3.
- 2026-11-14 orchestrator, from the reviews of ticket 11 (`reviews/11-r1.md`, `reviews/11-r2.md`): (a) blend `PotionTraits` (it now carries `cling` too) towards the mix's in `potionBand` by `uMix`, as the colour blends; the motes have no per-band blend (`uKind` is a step), so cross-fade two programs' alphas, never a switch mid-swirl. (b) `liquid.setLayers([{ colour, trait, ingredient: main }])` already fills a bottle with one trait, motes included. (c) A one-band bottle gives bubbles three times the span, so 18 to 36 mm a second: check it reads as fizz, not a jet; if not, set `uRise` to the liquid's height when the mix is one band. (d) Add `speck` to `MoteKind` and `MOTE_PROGRAMS` (code 4) and give `murk` a look in `TRAIT_LOOKS`; it draws as cloud today. (e) The rule ticket 11 learnt twice: nothing may be a growing clock times something that changes (a span, the sloshed up); test the swirl's maths for continuity late on the page. (f) Watch the swirl's level-frame shear under the vortex. (g) The shots script's `--face` touch and the 65 s motion run both land as a tap and mix the potion; fix that before this ticket's gate, or its layered frames will show the mixed liquid. (h) Scope 1's "wax seal" is gone (O25): stoppers are cork and glass. (i) Reviewer's lean, a taste call still with Ed: Snailshine could get a sparser "snail trail" swirl shape of its own; do not build it unless Ed says so.
- 2026-11-16 orchestrator: done, merged. Built by two implementers (Opus cut off by the spend limit after two commits, then Fable). The review (`reviews/23-r1.md`, Fable) passed the swirl and asked for three fixes: the mesh rebuild at the reveal stuttered the pop on slower devices, the box flashed layers after an early close, and murky in smoky glass was a black bottle. Fix round (fresh Fable, ending e3e57e9c): no rebuild when only `mixed` changes (longest frame after the reveal at 4x throttle 75 ms before, 16.7 ms after; first mixed frame after an early close +4 before, +1 after), the mud lifted (`#706a3d`, chroma cap 0.065, lightness 0.46 to 0.56), Puddle Jumper in sea glass, smoky glass's `through` raised from 0.52 to 0.62. Per O27 the orchestrator checked the fix round against the reviewer's two scripts' output and the murky sheet (`shots/23/r2/`); no second review. Checks on the merged tree: lint, typecheck, vitest 2069, CT 182, build. Deviations kept: the vortex uniform is `uVortex`; the motes are not carried round by the vortex (left for after the first version); `FlourishProbe.tsx` publishes `flourishSeconds` for the shots script. The spec's Puddle Jumper row and its murky bounds were brought in line by the orchestrator.
