# 11 - What is in the liquid: the traits

**Status:** done
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 10, 20
**Parallel with:** 13, 14, 16
**Model:** opus
**Gate:** materials
**ADR:** none of its own; add a "Traits" section (and any cuts) to 0109
**Dev port:** 3034

## Goal

Each layer has one visible trait (spec "The ingredients"): `cloud` milky and soft-edged (with
drifting spores on Puffcap), `fizz` small bubbles rising in the band, `glitter` flecks that drift
and catch the light (silver on Thundercloud), `glow` a soft light from inside under the cap,
`swirl` a slow marbled swirl (a pearly sheen on Snailshine), `clear` a clean jewel colour. Make
every trait read at box size on a phone, stay inside its own band, and look good in every
neighbour, with motion that stops under reduced motion and for the gate shots. Build each trait
so it can also fill a whole bottle on its own: ticket 23 uses the same programs for a mixed
potion's one trait (and adds `murk`).

## What Ed's pick fills in

L2 (soft band edges), as built by ticket 10. The spike's glitter is the starting point.

## Read first

- `spec.md`: "The ingredients" (traits, tiers), "The look and the scene, in words" (traits as
  shader features or a few hundred instanced points culled at the surface; no steam at rest),
  "Accessibility and reduced motion", "Rules for the team".
- `research/experience-options.md` (absolute path): "Rendering" (layers, swirl, glitter, fill
  rate).
- ADR 0109 (ticket 10), the spike's liquid and glitter code (ticket 01's "What ticket 10 lifts").
- Source: ticket 10's `src/stage/potionMaterials.ts`, `PotionMesh.tsx`; `src/stage/Sparkles.tsx`
  (instanced points with a material built once); `src/potion/ingredients.ts`, `compile.ts`,
  `tipped.ts` (the bands' heights); ADR 0113 (ticket 20).

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
   the surface), Puffcap's spores (drift slowly about the band). Leave the motes' program table
   open for one more kind (ticket 23's sinking murk specks). At most 300 points in a full bottle, sprite size
   bounded, culled above the surface and outside their band, in the level frame `setSurface`
   gives. Material built once; uniforms written through it.
3. **Motion:** everything runs on `uTime`; under reduced motion and `?freeze` every trait holds a
   still frame that still shows what it is (glitter visible, bubbles visible).
4. **Tiers:** every trait is tier B on its own. A trait still failing after its second fix round
   is cut: its ingredients fall back to `clear` (or `cloud` for Moonmilk and Puffcap) in
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
  every three-layer potion in a chosen catalogue (each ingredient three times, the presets
  unmixed), and for each trait filling a whole bottle alone.
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
each ingredient alone as three layers; each trait at the bottom, middle and top of a three-layer
bottle beside a contrasting neighbour; the presets unmixed; desk and phone; box and zoom; one
`--reduced-motion` pass.

The reviewer judges beside ticket 10's last passing round: each trait is recognisable and pretty,
stays in its band, does not muddy its neighbours, reads on the phone; glitter catches the light;
fizz looks like fizz, not dust; the glow lights from inside without blooming; Puffcap's spores
read as a soft red cloud, never as murk.

## Out of scope

- The mixed state, `murk` and the swirl (23), the pour (12), the slosh and its effect on the
  traits (14 may ask for one uniform), the uncorking (15).

## Comments
- 2026-11-13 planner (re-plan, E13-E17): three layers at most; Puffcap (spores) replaces Bog murk (specks); the `murk` trait and the mixed state belong to ticket 23, which reuses these trait programs for a whole bottle.
- 2026-11-14 orchestrator, from the final visual gate of tickets 10 and 13 (`shots/10/r3/review.md`): the liquids are now a step brighter and flatter (they match their jars; the round flask's bottom band reads 0.77 of centre brightness at its foot, was 0.65). Restore L2's depth here: darken towards the lower body and the edges (bottom band back to about 0.65) without changing the centre colour; glitter and swirl do the rest; keep sparkle on the candle's side. Thundercloud reads ink indigo in the bottle against a violet jar chip (a taste call left to Ed). Read the notes for this ticket in `reviews/10-r1.md`, `10-r2.md` and `10-r3.md` too.
- 2026-11-14 orchestrator: done, merged as ef362dd2. Round 1 (Opus, d2c38dd0, e2fb8274) built the traits and the motes; its review (`reviews/11-r1.md`) asked for changes: bubbles that raced and popped when the surface moved, fizz that did not read at rest, Snailshine as pool caustics, two wrong ADR claims. Round 2 (fresh Opus, fa15327a, edae50c2, on top of a merge of ticket 14's slosh) fixed them; its review (`reviews/11-r2.md`) passed code and look. Two of that review's should-fixes went in before the merge (Sonnet, 135b2f0e, read by the orchestrator): Emberroot's heat no longer rides the sloshed up, and the bubbles' numbers have one source for the shader and its TypeScript twin. Added outside the ticket's file list: `src/potion/traits.ts`. Checks on the merged tree: lint, typecheck, vitest 2020, CT 182 of 182, build. Frames: `shots/11/r1/`, `shots/11/r2/`. Taste calls for Ed are in `for-ed.md`.
