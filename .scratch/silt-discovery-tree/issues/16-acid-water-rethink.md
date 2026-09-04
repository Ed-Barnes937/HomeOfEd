# 16 - Acid + water = water reads wrong

**Status:** needs-info
**Type:** task
**Source:** PR #128 review feedback (Ed, 2026-09-04) - "acid + water = water
doesn't make a huge amount of sense". No direction given, so this needs Ed's
feel ruling; options below with a recommendation.
**Spec:** sim content - the row is `elements.ts:748`
(`{ a: 'acid', b: 'water', p: 1, aBecomes: 'water', bBecomes: 'water' }`, "water
wins: the acid ends up as more water rather than as a hole").

The row was written so water neutralises acid on contact (p 1). In the field
notes it charts as `acid + water -> water`, which is where it reads oddest: two
things go in, one of them comes out unchanged. Gameplay-wise it also makes
water a total, instant counter to acid - a single drip erases a pool.

## Options

1. **Remove the row** (recommended). Acid and water simply coexist; density
   decides who sits where (acid at 35 sinks or floats per the liquid table).
   Water stops being a magic eraser - stone stays the one acid-proof answer,
   which is stone's whole job (`elements.ts:224`). One fewer edge; the
   denominators are derived, so nothing migrates, and any stored
   `react:acid+water` key is carried-but-ignored exactly as the store already
   promises for unknown keys.
2. **Dilution with a residue**: `acid + water -> water + smoke` (or steam) -
   keeps "water beats acid" but gives the entry a visible product so the chart
   reads as an event. Cheapest change that keeps the counter mechanic.
3. **Acid taints water**: `acid + water -> acid`. Chemically honest-ish and
   dramatic (a spill spreads through a pond, contained only by stone), but it
   makes acid self-multiplying - a real balance change that deserves its own
   play-test, not a footnote here.

Whichever wins: regenerate the graph doc in the same change (drift test), keep
`acid.test.ts` green with a row-order regression if a row remains, and note the
ruling in this file's Comments.

## Tests

- Per the chosen option: acid.test.ts pins the new pair behaviour;
  determinism test green; graph drift test green after regen.
