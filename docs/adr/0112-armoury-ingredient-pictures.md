# 0112 - armoury potion: ingredient pictures from a sprite sheet

- **Status:** Accepted
- **Date:** 2026-11-14
- **Related:** [ADR 0113](0113-armoury-three-ingredients-that-mix.md) (the picker's jars).

## Context

Ed wants pictures beside the ingredient names for children who read a little (E2),
and picked P3, the ingredient itself, over a rendered jar (E8). He will make all nine
as one sprite sheet with Gemini's image model near the end of the epic; an agent then
cuts it up. This builds that path now, end to end, with placeholders, so the real art
drops in with one command.

## Decision

### The sheet layout (the cutter's contract)

- One square PNG or JPEG, at least 1024 px on a side (2048 or more preferred), square
  within 2 percent.
- A 3 x 3 grid of equal square cells, read row by row, left to right, in wheel order:
  Emberroot, Starpetal, Frogfizz / Snailshine, Bluebell dew, Thundercloud / Moonmilk,
  Rosehip syrup, Puffcap. No grid lines, borders, frames, labels, numbers or text.
- One flat background across the whole sheet: `#0a070b`, the jar tile's ground
  (`--shop-black` in `[data-shop='apothecary']`, `tokens.scss`). No table, floor,
  per-cell vignette, or shadow reaching a neighbouring cell.
- Each ingredient centred in its cell, about 70 percent of the cell's width, wholly
  inside the cell's central 80 percent.

### The cutter

`scripts/ingredient-pictures.mjs <sheet>` reads the format and size from the file
header, refuses a sheet that is not a PNG or JPEG, is under 1024 px, or is not square
within 2 percent (exit 1, the reason on stderr), crops each cell inset 6 percent on
every side, resizes to 256 x 256 and encodes with `/opt/homebrew/bin/cwebp`
(`CWEBP` overrides) at quality 85. A picture over 30 KB refuses the whole sheet. Cells
are cut into a temporary folder and copied into `public/ingredients/<id>.webp` only
once all nine pass, so a refusal writes nothing. The output folder is fixed and
the file names come from the id list, so nothing is written outside it. The id list
is exported and a test compares it with `INGREDIENTS`.

### The mask

Each picture is drawn with `mask-image: radial-gradient(closest-side, #000 70%,
transparent 100%)`, so an art background that is not quite the ground colour melts
into the jar tile. A picture that fails to load falls back to the swatch. The "In the
bottle" rows keep the small swatch.

### Sizes and budget

Pictures are 256 px, each about 3 KB for the placeholders and under 30 KB by the
cutter's check. They are only requested by the potion shop's picker, so a wand or
sword visit downloads none.

On desk a picture is 64 px. On a phone it is 26 px, not the 56 px first asked:
the picker's settled rule is that all nine jars stay in view at 390 x 844 with no scrolling,
and that sheet has no slack, so the three rows of jars cannot grow. Raising the phone
size needs the jars to scroll or the sheet to gain height; recorded as a question for
the owner.

### Placeholders

`scripts/ingredient-placeholder-sheet.mjs <out.png>` draws a 2048 px sheet to this
layout in the installed Chromium: a lit orb in each ingredient's colour with a hint of
its trait (glow, glitter, bubbles, swirl, a droplet highlight, cloud puffs). The PNG
is a build input kept outside the repo. Running it then the cutter reproduces the nine
committed webps byte for byte. Ticket 25 replaces them with Ed's art through the same
cutter.
