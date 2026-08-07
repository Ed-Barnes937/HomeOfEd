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
