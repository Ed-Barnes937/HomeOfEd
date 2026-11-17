# 16 - Ingredient pictures: the sheet layout, the cutter, placeholders and the picker

**Status:** done (merged into `armoury-potions` as 3f545fcc; reviews 16-r1, 16-r2; the last small fix 3f5d5b7e read by the orchestrator, no third reviewer)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 22
**Parallel with:** 11, 14
**Model:** sonnet (a script and a widget change, proven by running the script and the iwft)
**Gate:** code review only (plus a record sheet of the placeholders in the picker)
**ADR:** 0112 (write it; ticket 25 adds Ed's art)
**Dev port:** 3039

## Goal

Ed picked P3, the ingredient itself (E8), and will make the nine pictures as one sprite sheet with
Gemini's image model near the end of the epic; an agent then cuts it up. Build that path now,
end to end, with placeholders: the exact sheet layout the cutter expects, the cutter script, a
placeholder sheet made to the same layout, the nine cut placeholders, and the picker showing
them. Ticket 24 writes Ed's prompt to this layout; ticket 25 runs this cutter on his sheet.

## What Ed's pick fills in

P3 with a sprite sheet from Gemini (E8). The swatch stays in the "In the bottle" rows and as the
fallback when a picture fails to load.

## The sheet layout (the cutter's contract; ticket 24's prompt states it to Gemini)

- One square image, PNG or JPEG, at least 1024 px on a side (2048 or more preferred); square
  within 2 percent, or the cutter refuses it with the reason.
- A three by three grid of equal square cells, read row by row, left to right, in wheel order:
  Emberroot, Starpetal, Frogfizz / Snailshine, Bluebell dew, Thundercloud / Moonmilk, Rosehip
  syrup, Puffcap. No grid lines, borders, frames, labels, numbers or text.
- One flat background across the whole sheet: the jar tile's ground colour from the
  `[data-shop='apothecary']` palette (read it from `tokens.scss`; write the hex into the ADR).
  No table, no floor, no per-cell vignette, no shadow reaching a neighbouring cell.
- Each ingredient centred in its cell, about 70 percent of the cell's width, wholly inside the
  cell's central 80 percent (an empty 10 percent margin on every side).
- The cutter crops each cell inset by 6 percent of the cell size on every side, resizes it to 256
  x 256 and writes `public/ingredients/<id>.webp` with `/opt/homebrew/bin/cwebp` (`-crop x y w h
  -resize 256 256 -q 85`). Each file under 30 KB.

## Read first

- `spec.md`: "The ingredients" (wheel order), "The look and the scene, in words" (ingredient
  pictures), "Accessibility and reduced motion" (names always shown).
- `decisions.md` (absolute path): E2, E8; `shots/02/contact-sheet.png` (P3, absolute path).
- Source: `src/shop/controls/wandWidgets.tsx` (how handle thumbnails are shown: `alt=""`, not
  draggable); ticket 22's `src/apothecary/pourPicker.tsx` (`IngredientPicture`, the one place a
  picture is drawn); `src/styles/tokens.scss` (`[data-shop='apothecary']`);
  `src/potion/ingredients.ts`; `playwright-ct.config.ts` (the installed Chromium the placeholder
  renderer may reuse; never `playwright install`).

Paths are relative to `apps/armoury/`.

## Files you own

New `scripts/ingredient-pictures.mjs` (the cutter) and `scripts/ingredient-placeholder-sheet.mjs`
(draws the placeholder sheet), new `src/apothecary/ingredientPictures.test.ts` (imports the
cutter's pure parts), new `public/ingredients/<id>.webp` (nine),
`src/apothecary/pourPicker.tsx` (+ `.module.scss`), `src/testing/ApothecaryPom.ts` (only if a
locator changes), `docs/adr/0112-armoury-ingredient-pictures.md`.

## Scope

1. **The cutter** (`scripts/ingredient-pictures.mjs <sheet>`): checks the layout above, cuts the
   nine cells in wheel order, writes the webps, prints each file's size, and exits non-zero on
   any breach. Its header says how to run it. It exports its id list so a unit test can compare
   it with `INGREDIENTS` in order.
2. **The placeholder sheet** (`scripts/ingredient-placeholder-sheet.mjs <out.png>`): draws a
   2048 px sheet to the layout, each cell a soft lit orb in the ingredient's colour with a small
   hint of its trait (a glint, a few bubbles, a swirl), on the background colour, by rendering an
   inline SVG in the installed Chromium. The PNG is a build input, written outside the repo (the
   session scratchpad or `.scratch/`), never committed.
3. **The placeholders**: run 2 then 1; commit the nine webps. They must look intentional and
   calm in the dark panel, not broken; they are replaced in ticket 25.
4. **The picker**: each jar shows its picture (`<img alt="" draggable="false">`, the button keeps
   its name "Pour in {Label}") at 56 px on the phone and 64 px on desk, its label beneath; a
   soft round mask (CSS `mask-image`, a radial gradient feathered over the outer 30 percent) melts
   the sheet's background into the jar tile; a picture that fails to load falls back to the
   swatch. The "In the bottle" rows keep the small swatch.
5. **ADR 0112**: P3 and the sprite-sheet route (E8); the layout contract; the cutter and its
   checks; the mask; sizes and budget; placeholders now, Ed's art in ticket 25.

## Acceptance

- Running 2 then 1 reproduces the nine committed webps byte for byte (or within cwebp's
  determinism; say which in Comments).
- The cutter refuses a non-square sheet and a sheet under 1024 px, with a clear message.
- `src/pours.iwft.tsx` passes unchanged (names and buttons are the same); a picture's broken URL
  shows the swatch (one iwft, or a unit test of `IngredientPicture`).
- Record sheet: the picker open on desk and phone with the placeholders
  (`shots/16/record/`, absolute path), for ticket 25 to compare against.

## Tests to write first

- Unit: the cutter's id order equals `INGREDIENTS`; its crop rectangles for a 2048 and a 1024
  sheet (a pure function the script exports).
- iwft: the fallback to the swatch.

## Verify

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
pnpm --filter armoury exec vitest run src/apothecary
pnpm --filter armoury exec playwright test -c playwright-ct.config.ts src/pours.iwft.tsx   # ask the orchestrator first
du -ch apps/armoury/public/ingredients/*.webp | tail -1
```

## Out of scope

- Ed's art (25) and the prompt (24). Animated pictures, pictures in the "In the bottle" rows, a
  drag-to-pour gesture.

## Comments
- 2026-11-13 planner (re-plan): O6's rendered-jar route is replaced by Ed's pick P3 with a sprite
  sheet (E8). The old scope (`scripts/ingredient-thumbs.mjs`, `public/thumbs/ingredient-*.webp`)
  is dropped.
