# 06 - The bottle generator: lathe profiles, meshes, volumes, outline

**Status:** done (merged into `armoury-potions`; reviews 06-r1, 06-r2)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 03
**Parallel with:** 05 (and 01, 02, 04 if still running)
**Model:** opus
**Gate:** code review only (the form is judged on a real GPU at ticket 09's form gate)
**ADR:** 0107 (write it; ticket 09 adds the form gate's tuning and cuts)

## Goal

Turn a `PotionSpec` into a bottle: a lathe radius field per shape, closed mesh arrays for the
glass, the liquid cavity, each stopper and each label, exact volumes so each pour adds the same
amount, the band levels when the bottle is tipped, and a 2D outline for the shelf. Pure and
three-free, like the sword generator; only `stage/` will build three.js meshes from it.

## Read first

- `spec.md`: "The item" (bottle and finish tables), "The look and the scene, in words" (glass,
  liquid, framing), "The close look" (free play, tipped levels), "Testing" (generator bullets and
  budgets), "Rules for the team" (9, 10).
- `research/experience-options.md` (absolute path): "Rendering" (the liquid-fill bullet: a lathe
  profile has an analytic volume).
- `apps/armoury/CLAUDE.md`, "The sword" rules (pure generator, exact normals, vertex budgets,
  no wall-clock assertions, a chosen catalogue).
- ADR 0098 (the sword generator) as the pattern.
- Source: ticket 03's `src/potion/bottles.ts`, `compile.ts`, `framing.ts`, `potionSchema.ts`;
  `src/sword/sweep.ts`, `src/sword/curve.ts` (monotone curves), `src/sword/outline.ts`,
  `src/sword/geometry.ts` and their tests (closed-mesh and budget tests to copy);
  `src/wand/geometry.ts` (a radius field round an axis); `src/stage/HeldRig.tsx` (`HeldItem`:
  points in the item's own space along z).

Paths are relative to `apps/armoury/`.

## Files you own

New, under `src/potion/`, each with a test: `profile.ts`, `geometry.ts`, `tipped.ts`,
`outline.ts`. `src/potion/bottles.ts` (tuning its numbers, from ticket 03). New
`docs/adr/0107-armoury-bottle-generator.md`. After you, all five pass to ticket 09 for form-gate
tuning and cuts.

## Scope

Millimetres throughout; the bottle's axis is z, its foot at `z = 0`, the top of its stopper at
`heightMm`.

1. **`profile.ts`** (light, main-chunk safe): from a `PotionSpec`, the outer radius
   `outerR(z)` (foot with a small chamfer, body through the `BottleRow` control points with a
   monotone cubic, shoulder, neck of `neckMm`, a rolled lip), the inner radius (a 2.5 mm wall, a
   5 mm base, the neck's bore), `shoulderZ` (where the body ends), `fullZ` (the liquid's top at
   four pours: just under the shoulder), `cavityVolume(zTop)` integrated from the inner profile,
   and `uprightLevels(spec): number[]` (the heights of each band's top when upright, so each pour
   adds a quarter of the volume to `fullZ`). Export `widthMm` (the widest outer diameter) and
   `stopperSeat` (the z and radius where a stopper sits).
2. **`geometry.ts`**: `buildPotionMesh(spec)` returning separate closed parts as typed arrays
   (`positions`, `normals`, `uvs`, `indices`, plus a per-vertex `aHeight` in mm for the liquid):
   - `glass`: the outer and inner surfaces joined at the lip and through the base, one closed
     shell, 64 segments round, rings by curvature; normals exact from the profile's slope (never
     recomputed);
   - `liquid`: the cavity 0.3 mm inside the inner wall from the base up to the bottom of the
     bore (the shader discards above the surface, so the mesh reaches high enough for any tilt);
   - `stopper`, by `stopper`: `cork` (a slightly tapered plug, 60 percent in the bore, a
     chamfered top), `glass` (a ground plug and a teardrop knob above the lip), `wax` (the cork
     with a wax cap over the lip and four short drips down the neck);
   - `label`, by `label`: `round` (a patch on the body's widest band, conforming 0.3 mm outside
     the glass, about 40 percent of the body's height across), `banner` (a band 140 degrees
     round, 22 mm high, with notched ends), `tag` (a flat card 26 by 18 mm hanging from the neck
     on a thin loop of string; the string a closed tube); `none` is no part. Label UVs are in
     millimetres across the paper so a name texture lays on it.
   Fit the label to every shape and neck (a tall bottle's round label is smaller).
3. **`tipped.ts`** (not main chunk): `levelTable(spec)` precomputes, for tilts 0-90 degrees in
   5-degree steps, the height along world up of each band boundary and of the surface such that
   each band keeps its volume (integrate the cavity in slices against a tilted plane);
   `levelsAt(table, tiltRadians)` interpolates. This is what ticket 14's slosh reads.
4. **`outline.ts`** (main-chunk safe): `potionOutline(spec)`: the glass's outer silhouette, the
   stopper's, and one polygon per band clipped to the cavity at the upright levels, each with its
   layer colour, in millimetres (x across, y up from the foot), plus `widthMm` and `heightMm`. For
   the shelf and anything else drawn in 2D.
5. **Tune `bottles.ts`** so the five shapes read as five different bottles in outline, each
   believable (lip, shoulder, foot), and the tallest fits `TALLEST_MM`. Write
   `shots/06/outlines.svg` (absolute path, spec rule 3): every shape at neck 0, 0.5 and 1, every
   stopper and label on the teardrop, with bands drawn, so the reviewer can look before 09.
6. **ADR 0107**: lathe profiles as data rows; why a lathe (exact volumes, the outline is the
   profile); the wall and base; equal-volume pours to `fullZ`; the tipped table and its error;
   stopper and label parts; budgets; what the main chunk may import. Status Accepted (09 adds a
   "Form gate" section).

## Acceptance

- Every part of every catalogue potion is a closed, consistently wound mesh with outward exact
  normals; the liquid lies inside the glass's inner wall everywhere; the stopper fits the bore
  and the label sits outside the glass without crossing it.
- Each pour adds the same volume within 1 percent, on every shape and neck.
- Tipped levels keep every band's volume within 2 percent from 0 to 60 degrees, within 5 to 90.
- Budgets hold on vertex counts: glass 20k, liquid 10k, stopper and label together 8k, total 40k.
- `potion/profile.ts` and `outline.ts` import nothing heavier than `bottles.ts` and `compile.ts`.

## Tests to write first

Unit only, on a chosen catalogue built once each (every shape at neck 0, 0.5 and 1; every
stopper; every label; 0 to 4 pours): never hundreds of random potions; no wall-clock assertions.

- `profile.test.ts`: radii positive and continuous; inner inside outer by the wall; `fullZ` below
  the shoulder; `cavityVolume` monotone; `uprightLevels` equal volumes within 1 percent.
- `geometry.test.ts`: closed (every edge used twice), positive signed volume, normals unit and
  outward, liquid inside cavity (sample 200 points per part), stopper within the seat, label
  outside the glass by 0.2-0.5 mm, budgets.
- `tipped.test.ts`: volume preserved per band at 0, 15, 30, 45, 60, 90 degrees within the
  bounds above; levels monotone in fill; 0 degrees equals `uprightLevels`.
- `outline.test.ts`: the glass outline's half-widths match `outerR` at sampled heights; band
  polygons inside the cavity outline; one band per pour, in order, with its colour.

## Verify

```bash
pnpm --filter armoury exec vitest run src/potion
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
```

The potion suite stays under a few seconds locally (spec rule 18).

## Out of scope

- Any three.js, material, light or stage (09, 10). The pour animation (12), the slosh dynamics
  (14), the stopper's lift (15).
- Charms (cut, spec "Out of scope").

## Comments
- 2026-11-13 orchestrator, from the review of ticket 03: the `shoulder` row in `bottles.ts` does not yet give a flat shoulder (its points drop 18 mm of radius over about 18 mm of height, a 45 degree slope); make it read as "Square shoulders". The last body radius disagrees with `neckRadiusMm` for `tall` (16 against 7) and `shoulder` (12 against 8); settle where the body ends and the neck begins, close both to the neck, and say the convention in the `body` doc comment. `BottleRow.neckMm` is a `[min, max]` range and `PotionSpec.neckMm` a single length; the names stay as they are.
- 2026-11-13 orchestrator: built (six commits ending 277823dc), independent review r1 found the geometry correct and asked for two documentation fixes, fixed with the wax seal reshaped, the plug shortened on short necks and the shelf drawing from the real silhouette (eleven commits ending 8e086b9c), review r2 passed (pours equal within 0.14 percent and tipped bands within 0.28 percent by the reviewer's own arithmetic). Merged into the epic branch. Pictures in `shots/06/r2/`.
