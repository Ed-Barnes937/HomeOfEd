# 10 - Glass, liquid and light

**Status:** ready-for-agent (waits for Ed's pick from ticket 01)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 01 (Ed's pick), 09
**Parallel with:** 13
**Model:** opus
**Gate:** materials
**ADR:** 0109 (write it; 11 and 12 add sections)
**Dev port:** 3033

## Goal

Give the bottle the look Ed picked from the spike's contact sheet: fake glass, layered level
liquid with clear band edges, the finish parts (stopper, label paper and ink, wax), the shop's
moody light and environment, tone mapping for this canvas, a bounded resting glow, and the
picture capture method he picked. Traits inside the liquid (fizz, glitter, swirl, cloud, glow)
are ticket 11; here every band is drawn `clear` or `cloud` as its trait's base.

## What Ed's pick fills in

Before starting, the orchestrator writes Ed's answer into `decisions.md` (one letter per row of
`shots/01/contact-sheet.md`: glass G, liquid L, light M, capture P) and into this ticket's
Comments. Build exactly that combination; any row Ed left open takes the spike's recommendation.
If Ed asked for changes to the look, they are listed there too.

## Read first

- `spec.md`: "The look and the scene, in words", "Accessibility and reduced motion", "Testing",
  "Rules for the team".
- `decisions.md` (absolute path): Ed's pick (as above).
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
  `src/potion/compile.ts`, `ingredients.ts`; `src/share/shareCard.ts`; `scripts/gpu-shots.mjs`.

Paths are relative to `apps/armoury/`.

## Files you own

`src/stage/potionMaterials.ts` (new, + `potionMaterials.test.ts`), `src/stage/PotionMesh.tsx`,
`src/stage/PotionStage.tsx`, `src/stage/potionScene.tsx`, `src/stage/PotionCloseUpStage.tsx`
(lights and environment only), `scripts/gpu-shots.mjs` (`--freeze`), `README.md` (credits for
any asset), new files under `public/hdri/` or `public/textures/` only if the pick uses them,
`src/potion/ingredients.ts` (the colour column only) and `src/potion/presets.ts` (retuning),
`docs/adr/0109-armoury-potion-look.md`.

## Scope

1. **`potionMaterials.ts`**: pure tables (glass tints per `glass` value; stopper materials:
   cork, glass, wax; label paper, ink and gold paper for secret blends) and the material
   builders lifted from the spike: the glass (back pass and front pass), the liquid (level plane
   in world space, back-face cap in the surface colour, bands by `aHeight` between the `levels`
   uniform, the picked band edge, the `clear` and `cloud` bases), each with its uniforms written
   through the material. A `uTime` uniform, frozen under reduced motion and by the dev-only
   `?freeze=<seconds>`. The liquid exposes `setSurface(normal, levels)` for tickets 12 and 14.
2. **Label ink:** the label's name (the child's rename or the derived name) drawn on a canvas
   texture in the shop's display face (`IM Fell English`), redrawn when the name changes; gold
   paper and ink for a secret blend. Tier B (spec): if the gate finds it unreadable or cheap
   after its second fix round, the label becomes plain paper with a ruled ink line; record the
   cut.
3. **Light and environment:** the picked light (M) in the box's front frame and in the close
   look, the environment by lightformers (plus the spike's HDRI only if the pick used it), tone
   mapping on this canvas only, bloom at the wand's settings with nothing at rest above
   `0.92 * BLOOM_THRESHOLD`. The bottle's glow lights the table a little (a weak point light in
   the top pour's colour). A candle flicker of a few percent on the key, off under reduced
   motion.
4. **The picture:** `capture()` uses the picked method (P): over the card's own ground, or the
   bottle drawn opaque for the picture only. Ticket 13's card painter composes it.
5. **Colours and presets:** retune ingredient colours so every neighbouring pair reads as two
   layers under the picked light and glass tint (the "every combination must look good" rule),
   and retune presets. Ids never change.
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
Set `shots/sets/materials.json`: every preset; every glass tint over the first-visit pours;
every ingredient as a single pour and as four pours; every stopper; every label (with a long
rename and a secret blend's gold); desk and phone; box, close and zoom; `--picture`.

The reviewer judges beside `shots/04/baseline/` and `shots/01/contact-sheet.png` (the pick):
the glass reads as glass (rim, reflections, no milky fog, no black edges); the liquid sits inside
it with a level top and clean band edges; the layers' colours are distinct and jewel-like under
the candlelight; the scene is moody and the bottle is the brightest thing; nothing blooms at rest;
the label reads (tier B); the picture holds up on the card; it looks like the same quality of
object as the wand and the sword.

## Out of scope

- Traits in the liquid (11), the pour (12), the slosh and the uncorking (14, 15), the scene art and
  the card painter (13), ingredient pictures (16).

## Comments
- 2026-11-13 orchestrator, from the look spike (ticket 01): whichever tiles Ed picks, fix these named flaws: the liquid's top surface can read as the rim of a cup; Moonmilk reads pale lavender, the weakest layer; the candle flame reflects twice (front and back wall) and can read as two candles. The spike used ACES, not the smithy's AgX, and no post pass at rest (the composer dulls the glass over a transparent canvas); record that choice and its reason in ADR 0109 unless Ed objects. Frame cost was measured on the M3 only.
- 2026-11-13 orchestrator, from the review of ticket 06: band the liquid by the plane `dot(p, u) = h` (p in the bottle's millimetre frame from the foot's centre, u the surface normal in that frame), never by `aHeight`, which equals it only when the bottle is upright. Ticket 09's clay shader already does this; keep it. The tag hangs in a U of string across the top of its card: keep the ink off that strip.
