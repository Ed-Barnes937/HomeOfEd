# 05 - `envMapIntensity` has no effect on any material in the armoury

**Status:** needs-triage
**Type:** bug
**Raised:** 2026-11-14, found in the third code review of armoury-potions
ticket 10 (`.scratch/armoury-potions/reviews/10-r3.md`)

## What happens

No material in the app has its own environment map, so three.js (0.170) takes
the reflection strength from the scene's environment intensity and ignores
each material's `envMapIntensity`. On screen: wand materials reflect at 0.45,
sword and potion materials at 1. The sword's per-steel shine values never
reach the screen.

## Why it matters

The smithy's metals were tuned with values that do nothing; the steels differ
less than their tables say. Fixing it changes the wand's and the sword's look,
so both would need their visual gates again.

## To decide

- Leave it and delete the dead values, or make them take effect (a per
  material environment map, or scaling in the shader) and re-gate the looks.

## Comments
- 2026-11-14: the potion shop's ADR 0109 records that its own materials do not rely on `envMapIntensity`.
