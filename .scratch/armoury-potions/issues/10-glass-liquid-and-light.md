# 10 - Glass, layered liquid and light

**Status:** done (merged into `armoury-potions` as cf913f80; code reviews 10-r1, 10-r2, 10-r3; visual gate `shots/10/r2/review.md` then PASS in `shots/10/r3/review.md`; the wax seal cut, O25)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 09; scope 5 (colours and presets) waits until 20 is merged (the orchestrator
merges the epic branch into this ticket's branch first)
**Parallel with:** 13, 20, 21, 22
**Model:** opus
**Gate:** materials
**ADR:** 0109 (write it; 11 and 12 add sections)
**Dev port:** 3033

## Goal

Give the bottle the look Ed picked from the spike's contact sheet: fake glass (G1, thin clear),
layered level liquid with soft band edges (L2), the finish parts (stopper, label paper and ink,
wax), the shop's moody light (M1, one candle and a cool rim) and environment, tone mapping for
this canvas, a bounded resting glow, and the picture capture over the card's ground (P2). This
is the liquid's *layered* state (up to three bands, one per ingredient, each a third of the
volume); the *mixed* state and the swirl between them are ticket 23. Traits inside the liquid
are ticket 11; here every band is drawn `clear` or `cloud` as its trait's base.

## What Ed's pick fills in

E9-E12 in `decisions.md`: glass G1, liquid L2, light M1, share picture P2. Build exactly that
combination from the spike's tiles of those names. His picks record no objection to the spike's
ACES and no post pass at rest on this canvas (`for-ed.md` row X): keep them unless the
orchestrator says otherwise, and record why.

## Read first

- `spec.md`: "The look and the scene, in words", "Accessibility and reduced motion", "Testing",
  "Rules for the team".
- `decisions.md` (absolute path): E9-E17 (the picks, and the new mechanic this look must serve).
- `shots/01/contact-sheet.md` (absolute path), especially "What ticket 10 lifts".
- The spike branch `spike/potion-look-do-not-merge`: read its files with
  `git show spike/potion-look-do-not-merge:<path>`; lift code, never merge or cherry-pick the
  branch.
- `apps/armoury/CLAUDE.md` (uniforms through the material, the seam, tone mapping per canvas,
  glow under the cap).
- ADRs 0082, 0083, 0099 (the smithy's canvas settings and how its gate went), 0100.
- Source: ticket 09's `src/stage/PotionStage.tsx`, `PotionMesh.tsx`, `potionScene.tsx`,
  `PotionCloseUpStage.tsx`; `src/stage/Gems.tsx`, `glow.ts`, `smithyScene.tsx`,
  `swordMaterials.ts` (a material table with pure tests), `boxRig.tsx` (`captureScene`);
  `src/potion/compile.ts` (`layers`, `fill`; after 20 also `mixed`, `mix`), `ingredients.ts`;
  `src/share/shareCard.ts`; `scripts/gpu-shots.mjs`.

Paths are relative to `apps/armoury/`.

## Files you own

`src/stage/potionMaterials.ts` (new, + `potionMaterials.test.ts`), `src/stage/PotionMesh.tsx`,
`src/stage/PotionStage.tsx`, `src/stage/potionScene.tsx`, `src/stage/PotionCloseUpStage.tsx`
(lights and environment only), `scripts/gpu-shots.mjs` (`--freeze`), `README.md` (credits for
any asset), new files under `public/hdri/` or `public/textures/` only if the pick uses them,
`src/potion/ingredients.ts` (the colour column only) and `src/potion/presets.ts` (bottle and
finish retuning only; recipes stay), both only after 20 has merged,
`docs/adr/0109-armoury-potion-look.md`.

## Scope

1. **`potionMaterials.ts`**: pure tables (glass tints per `glass` value; stopper materials:
   cork, glass, wax; label paper, ink and gold paper for secret blends) and the material
   builders lifted from the spike: the glass (back pass and front pass), the liquid (level plane
   in world space, back-face cap in the surface colour, bands by `aHeight` between the `levels`
   uniform, the picked band edge, the `clear` and `cloud` bases), each with its uniforms written
   through the material. A `uTime` uniform, frozen under reduced motion and by the dev-only
   `?freeze=<seconds>`. The liquid exposes `setSurface(normal, levels)` for tickets 12 and 14.
   Leave room for ticket 23: the band colour lookup is one function of the band coordinate, so a
   mix uniform can later blend it to one colour without restructuring the shader.
2. **Label ink:** the label's name (the child's rename or the derived name) drawn on a canvas
   texture in the shop's display face (`IM Fell English`), redrawn when the name changes; gold
   paper and ink for a mixed secret blend (`isGold`). The name changes at the mix (it reads
   "Moonmilk, Rosehip and Starpetal" until then), so the texture redraws on change. Tier B (spec): if the gate finds it unreadable or cheap
   after its second fix round, the label becomes plain paper with a ruled ink line; record the
   cut.
3. **Light and environment:** the picked light (M) in the box's front frame and in the close
   look, the environment by lightformers (plus the spike's HDRI only if the pick used it), tone
   mapping on this canvas only, bloom at the wand's settings with nothing at rest above
   `0.92 * BLOOM_THRESHOLD`. The bottle's glow lights the table a little (a weak point light in
   the potion's glow colour: the top layer's, or the mixed colour). A candle flicker of a few percent on the key, off under reduced
   motion.
4. **The picture (P2):** `capture()` draws the stage over the card's own ground, not on a
   transparent background. Ticket 13's card painter composes it.
5. **Colours and presets (after 20 merges):** retune ingredient colours so every neighbouring
   pair of the nine (Puffcap included) reads as two layers under M1 and every glass tint, keeping
   the wheel's rainbow order of hues (the mix's colour is interpolated round it, ADR 0113);
   separate Rosehip, Puffcap and Emberroot clearly; lift Moonmilk (the spike's weakest layer).
   Retune presets' bottles and finishes; recipes and ids never change. Re-run `vitest run
   src/potion` (20's colour-bound tests must hold).
6. **Script:** `--freeze=<seconds>` adds `?freeze=` so every gate frame is drawn at the same
   liquid time.
7. **ADR 0109**: what Ed picked and why it holds; the fake glass and why no transmission; the
   liquid's level plane, cap and band edges; render order and depth writes; the light,
   environment and tone mapping for this canvas; the resting glow cap; the capture method; any
   asset with its CC0 source and size; what was cut. Status Accepted.

## Acceptance

- The materials gate passes beside the wand and sword baseline, desk and phone.
- At rest nothing blooms; glass never sorts in front of or behind the liquid wrongly as the
  bottle turns on the table or in the close look.
- Every glass tint over every ingredient reads (tier B tints may be cut after two fix rounds:
  remove the option, fix presets, record it).
- The picture of a potion on its card does not wash out or dark-edge.
- The wand's and the sword's canvases are unchanged.
- Asset budget: any HDRI 1024x512, any texture under 250 KB, loaded only by the potion stage.

## Tests to write first

- Unit, `potionMaterials.test.ts`: a row for every `glass`, `stopper` and `label` value; colours
  linear and in range; the resting emissive under `0.92 * BLOOM_THRESHOLD`; `setSurface` writes
  the uniforms (not props); `uTime` does not advance under reduced motion or `?freeze`.
- After colour retuning, `vitest run src/potion` stays green.

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/stage src/potion
pnpm --filter armoury run build
```

## Materials gate

Protocol: spec rule 15. Shots into `shots/10/r<N>/` (absolute path), `--freeze=1.2`.
Set `shots/sets/materials.json`: the first-visit potion (layered); every glass tint over it;
every ingredient as one layer and as three layers; all nine as neighbouring pairs (the wheel's
neighbours at least); every stopper; every label (with a long rename and the gold of a mixed
blend, shown here as the label only, since the mixed liquid is ticket 23's); desk and phone;
box, close and zoom; `--picture`. Presets that are mixed draw layered until 23: shoot them
with `mixed: no` for this gate.

The reviewer judges beside `shots/04/baseline/` and `shots/01/contact-sheet.png` (the pick):
the glass reads as glass (rim, reflections, no milky fog, no black edges); the liquid sits inside
it with a level top and clean band edges; the layers' colours are distinct and jewel-like under
the candlelight; the scene is moody and the bottle is the brightest thing; nothing blooms at rest;
the label reads (tier B); the picture holds up on the card; it looks like the same quality of
object as the wand and the sword.

## Out of scope

- Traits in the liquid (11), the mixed state and the swirl (23), the pour (12), the slosh and the
  uncorking (14, 15), the scene art and the card painter (13), ingredient pictures (16, 25).

## Comments
- 2026-11-13 orchestrator, from the look spike (ticket 01): whichever tiles Ed picks, fix these named flaws: the liquid's top surface can read as the rim of a cup; Moonmilk reads pale lavender, the weakest layer; the candle flame reflects twice (front and back wall) and can read as two candles. The spike used ACES, not the smithy's AgX, and no post pass at rest (the composer dulls the glass over a transparent canvas); record that choice and its reason in ADR 0109 unless Ed objects. Frame cost was measured on the M3 only.
- 2026-11-13 orchestrator, from the review of ticket 06: band the liquid by the plane `dot(p, u) = h` (p in the bottle's millimetre frame from the foot's centre, u the surface normal in that frame), never by `aHeight`, which equals it only when the bottle is upright. Ticket 09's clay shader already does this; keep it. The tag hangs in a U of string across the top of its card: keep the ink off that strip.
- 2026-11-13 planner (re-plan, E13-E17): this ticket now builds the layered state only (at most three bands); the mixed state and the swirl moved to ticket 23. Ed's picks are G1, L2, M1, P2. Colours and presets wait for ticket 20 (Puffcap replaces Bog murk; the hues must keep the wheel's rainbow order).
- 2026-11-13 orchestrator, from ticket 09's form gate and reviews (`shots/09/r2/review.md`, `reviews/09-r2.md`): (a) `HeldRig` hands the bottle its lights group as its children's second argument (`up`); the liquid keeps level by that group, so replace `ClayLights` freely. (b) The liquid's `renderOrder` only interleaves with the glass once the liquid is transparent. (c) `drawLiquid` writes `levels` without a bound check; keep `levels.length <= MAX_POURS`. (d) Smooth the liquid's jagged far rim. (e) **Wax seal, deferred to this ticket's gate:** judge `preset6-night-sky` and `round-wax-n0` (desk close 1200, phone close 4800, and the top-down `tip70`) in the real glossy wax. If it still reads as a mushroom on the short round flask, cap the overhang at the lip ring plus 0.05 neck diameters and the coat at 0.5 neck diameters below the lip on short necks; if that fails too, cut wax (schema, `bottles.ts`, presets) and record it in ADR 0107. (f) Check paper colour separates the round flask's banner from the liquid (else a 100 degree wrap on that shape only); judge the round label in paper and ink (in clay it reads as a hole); look for a dark smudge at the gourd's waist at `tip70`; check the tag does not look stuck on or floating.
- 2026-11-13 orchestrator, from ticket 13's build (branch `potions/13-scene`, 553ea8a9): the share picture's capture must draw over `PICTURE_GROUND` (`#1a1114`, exported from `src/potion/framing.ts` on that branch) or return a clear background; ticket 13's `liftFromGround` then makes that ground clear again and keeps the reflections. `framing.ts` there also exports `HEADROOM`; `potionScene.tsx` has its own private `HEADROOM = 0.1` that should import it once both are merged. The scene draws its candle on the left (M1's key) with the cool rim from the right: light the glass to agree with it. Tickets 13's gate protocol asks for a `--freeze=1.2` option in `scripts/gpu-shots.mjs` (the liquid's clock held at one moment, as the look spike did); the script has none yet. If your gate needs the liquid frozen, add it here and say so in your report.
- 2026-11-13 orchestrator, from the second review of ticket 20: ingredient colours may be retuned freely; the potion tests compare against `ingredient(id).colour` and bounds, not hex values. Keep the hues in the wheel's rainbow order and `MURK_REACH` (in `src/potion/wheel.ts`) untouched.
