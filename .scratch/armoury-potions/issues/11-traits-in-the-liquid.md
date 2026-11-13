# 11 - What is in the liquid: the traits

**Status:** ready-for-agent (waits for Ed's pick via ticket 10)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 10
**Parallel with:** 13, 14
**Model:** opus
**Gate:** materials
**ADR:** none of its own; add a "Traits" section (and any cuts) to 0109
**Dev port:** 3034

## Goal

Each pour has one visible trait (spec "The ingredients"): `cloud` milky and soft-edged, `fizz`
small bubbles rising in the band, `glitter` flecks that drift and catch the light (silver on
Thundercloud), `glow` a soft light from inside under the cap, `swirl` a slow marbled swirl (a
pearly sheen on Snailshine), `clear` a clean jewel colour, and Bog murk's drifting specks. Make
every trait read at box size on a phone, stay inside its own band, and look good in every
neighbour, with motion that stops under reduced motion and for the gate shots.

## What Ed's pick fills in

The liquid style (L) and glitter density Ed picked from ticket 01's sheet, as recorded in
`decisions.md` and ticket 10's Comments. The spike's glitter is the starting point.

## Read first

- `spec.md`: "The ingredients" (traits, tiers), "The look and the scene, in words" (traits as
  shader features or a few hundred instanced points culled at the surface; no steam at rest),
  "Accessibility and reduced motion", "Rules for the team".
- `research/experience-options.md` (absolute path): "Rendering" (layers, swirl, glitter, fill
  rate).
- ADR 0109 (ticket 10), the spike's liquid and glitter code (ticket 01's "What ticket 10 lifts").
- Source: ticket 10's `src/stage/potionMaterials.ts`, `PotionMesh.tsx`; `src/stage/Sparkles.tsx`
  (instanced points with a material built once); `src/potion/ingredients.ts`, `compile.ts`,
  `tipped.ts` (the bands' heights).

Paths are relative to `apps/armoury/`.

## Files you own

`src/stage/potionMaterials.ts` (+ test), `src/stage/PotionMesh.tsx`, new
`src/stage/LiquidMotes.tsx` (instanced glitter, bubbles and specks), `src/potion/ingredients.ts`
(the trait column only, for a cut), `docs/adr/0109-armoury-potion-look.md` (one section).

## Scope

1. **Shader traits** in the liquid material, per band from the layer's trait: `cloud` (milky
   scattering, softer band edge), `swirl` (domain-warped noise in the band's colour, slow;
   Snailshine adds a pearly sheen), `glow` (emissive from inside, held under
   `0.92 * BLOOM_THRESHOLD`), `clear` (none). A band's trait never bleeds past its soft edge.
2. **`LiquidMotes.tsx`**: one instanced draw for every point-like trait: `glitter` flecks (drift,
   twinkle on a fixed seed), `fizz` bubbles (rise from the band's floor and vanish at its top or
   the surface), Bog murk's specks (sink slowly). At most 300 points in a full bottle, sprite size
   bounded, culled above the surface and outside their band, in the level frame `setSurface`
   gives. Material built once; uniforms written through it.
3. **Motion:** everything runs on `uTime`; under reduced motion and `?freeze` every trait holds a
   still frame that still shows what it is (glitter visible, bubbles visible).
4. **Tiers:** every trait is tier B on its own. A trait still failing after its second fix round
   is cut: its ingredients fall back to `clear` (or `cloud` for Moonmilk and Bog murk) in
   `ingredients.ts`; record it in ADR 0109.
5. **ADR 0109 "Traits" section**: how each trait is drawn, the point budget, reduced motion, cuts.

## Acceptance

- Each trait reads as itself at box size on a phone and up close, inside its own band, in every
  position (bottom, middle, top) and beside every other trait.
- At most 300 points; nothing blooms at rest; nothing smokes or steams.
- Under reduced motion and in frozen shots the bottle is still and every trait is still visible.

## Tests to write first

- Unit, extend `potionMaterials.test.ts`: every `Trait` has a shader branch or a motes program;
  the glow trait's emissive stays under the cap; the motes' counts per band sum to at most 300 for
  every four-pour potion in a chosen catalogue (each ingredient four times, the presets).
- Unit, a pure function for the motes' layout (positions inside a band's height range and inside
  the cavity radius at that height, from `profile.ts`) with its test.

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/stage src/potion
```

## Materials gate

Protocol: spec rule 15. Shots into `shots/11/r<N>/`, `--freeze=1.2` plus one unfrozen pair of
frames 0.5 s apart per potion so the reviewer can see the motion. Set `shots/sets/traits.json`:
each ingredient alone as four pours; each trait at the bottom, middle and top of a four-pour
bottle under a contrasting neighbour; the presets; desk and phone; box and zoom; one
`--reduced-motion` pass.

The reviewer judges beside ticket 10's last passing round: each trait is recognisable and pretty,
stays in its band, does not muddy its neighbours, reads on the phone; glitter catches the light;
fizz looks like fizz, not dust; the glow lights from inside without blooming; Bog murk is murky
but still looks like a nice thing to have in a bottle.

## Out of scope

- The pour (12), the slosh and its effect on the traits (14 may ask for one uniform), the
  uncorking (15).

## Comments
