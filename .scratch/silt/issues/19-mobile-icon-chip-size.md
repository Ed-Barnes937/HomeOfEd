# 19 — Mobile icon chips sit at the touch-target floor, not the comfortable size

**What's wrong:** The square icon chips on the bottom bar are exactly 44×44 —
the accessibility minimum rather than the size spec §9 asks for. Spec §9:
*"44–48px targets"*.

`apps/silt/src/pages/HomePage.module.scss:322-357` (`.brushButton`,
`.swatchRow`), and the assertion in
`apps/silt/src/testing/SiltPagePom.ts:220-226`.

Measured at a 390×844 touch viewport:

| Control | Size |
| --- | --- |
| `brush-0` | 44.0 × 44.0 |
| swatch rows | 44.0 min, content-driven |

44px clears the floor (Apple HIG 44pt, Material 48dp) but 48px is the more
comfortable target on a phone, and these chips are square with no content
constraint — the size is a free choice, so it may as well be the better one.

**What to build:** Take the square icon chips (`.brushButton`, `.swatchRow`) to
48×48. Leave the text-labelled buttons alone — see below.

**Status:** claimed

- [ ] Square icon chips are 48×48 on mobile
- [ ] `mobile.iwft.tsx` still green; desktop layout unaffected
- [ ] Bottom bar still fits at 390px wide without the palette row overflowing
      unexpectedly (it scrolls sideways by design, but check it doesn't now
      scroll when it previously didn't)

**Severity:** low — comfort, not correctness. The accessibility floor is
already met everywhere.

## Why the text buttons are excluded

The original drift-review finding (2026-08-06) read §9's "44–48px" as a hard
**ceiling** and flagged every text-labelled control for exceeding it. Measured,
those are:

| Control | Width | Over 48 by |
| --- | --- | --- |
| `erase` | 48.8 | 0.8 |
| `paint` / `spawner` | 49.9 / 51.9 | 2–4 |
| `play` | 56.2 | 8 |
| `reset` | 62.0 | 14 |
| `scenes` | 67.9 | 20 |
| `reset` armed (`confirm?`) | 79.6 | 32 |

Heights are all exactly 44 — the overflow is width-only, and it is structural:
`0.9rem` padding each side plus a 2px border each side is **32.8px of chrome
before any text**, so any label past ~2 characters clears 48px on its own.
`confirm?` is 8 characters of Silkscreen at 9px with `0.05em` tracking ≈ 47px of
text, hence ~80px total.

Fitting `confirm?` into 48px would need ~15px for 8 characters — meaning
near-zero padding, a sub-legible font size, or replacing the word with a glyph.
All three are worse than a wide button.

**So the ceiling reading is rejected.** "44–48px targets" is a minimum-size
instruction in the sense every touch-target guideline uses it: at least 44,
prefer 48. A control wider than 48px is not a defect; one narrower than 44 is.
`docs/adr/0028`/`0029` need no change, but if spec §9 is ever revised the phrase
is worth making explicit so this doesn't get re-flagged.

## Comments

- 2026-08-07: Implemented — `.brushButton`/`.swatchRow` now 48×48 in
  `apps/silt/src/pages/HomePage.module.scss`; `SiltPagePom.verifySquareChipSize`
  (exact 48×48, `toBeCloseTo(48, 0)`) added alongside the unchanged
  `verifyTouchTargetSize` (44px floor, still used for the text buttons).
  `mobile.iwft.tsx` now asserts both `element-sand` (swatch) and `brush-0`
  (brush square). Red-before-green verified for both.
- AC3 (bottom bar still fits at 390px): measured directly against a real
  browser (not the CT harness, which sizes its mount iframe independently of
  `test.use({viewport})` and gave misleading numbers — a gotcha worth knowing
  if anyone else tries to assert on `.rail` width in an `.iwft` test). At
  390×844 with touch: `.rail` clientWidth 374px, scrollWidth was 607px before
  this change and 639px after — it already needed the sideways scroll before
  the fix (by design, spec §9), and still does after; the fix adds ~32px
  (8 square chips × 4px) to an already-overflowing row, not a new overflow.
  No regression from "fits" to "needs scroll."
- Code-review pass (Standards + Spec axes vs `origin/basic-cellular-automaton`)
  ran twice. First pass found: (a) the 48×48 assertion only covered
  `.swatchRow`, not `.brushButton` — fixed by adding a `brush-0` assertion;
  (b) minor `boundingBox`-or-throw duplication between the two POM helpers —
  extracted into a private `boundingBoxOrThrow`. One Standards-axis finding
  (claiming `.modeButton`'s 44px min was changed) was a misread of unified-diff
  context lines — verified against the actual diff that `.modeButton` and
  `.eraseButton` are untouched, still 44px, as intended. Second pass: clean.
