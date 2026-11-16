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

`scripts/ingredient-pictures.ts <sheet>` reads the format and size from the file
header, refuses a sheet that is not a PNG or JPEG, is under 1024 px, or is not square
within 2 percent, or is a JPEG with an EXIF orientation flag other than 1 (it would be cut
turned: re-save it upright, or as a PNG), or is over 16384 px a side (exit 1, the reason
on stderr). A sheet within 2 percent of square is cut from the centred square of its
short side, and the 2 percent is measured against the short side. It crops each cell inset 6 percent on
every side, resizes to 256 x 256 and encodes with `/opt/homebrew/bin/cwebp`
(`CWEBP` overrides) at quality 85. If cwebp fails on a cell (a CMYK JPEG, a truncated
file) the reason names the cell, says the sheet could not be read as a picture, and
keeps cwebp's own message after it. A missing cwebp says where it was expected and to run `brew install webp` or set `CWEBP`.
A JPEG's orientation is read from its EXIF segment only (the first one; 0 and above 8 count as 1).
It is a TypeScript file run directly by Node 22.6 or later with type stripping, through
`pnpm --filter armoury run ingredients:cut <sheet>` (the path is relative to `apps/armoury`);
Node 22.18 and later strip types without the flag the script passes. A picture over 30 KB refuses the whole sheet. Cells
are cut into a temporary folder and copied into `public/ingredients/<id>.webp` only
once all nine pass, so a refusal writes nothing. The output folder is fixed and
the file names come from the id list, so nothing is written outside it. The id list
is exported and a test compares it with `INGREDIENTS`.

### The mask

Each picture is drawn with `mask-image: radial-gradient(closest-side, #000 70%,
transparent 100%)`, so an art background that is not quite the ground colour melts
into the jar tile. The crop is 88 percent of the cell, so a subject 70 percent of the
cell wide fills about 79.5 percent of the picture, and the mask is solid only inside 70
percent of the picture's width. Compact, roughly round subjects survive it (a round
edge keeps about 68 percent opacity); the tips of tall or wide ones, such as a long
root or a drooping bell, fade. Ticket 24's prompt should ask for compact, roughly round
silhouettes, or ticket 25 may loosen the mask. A picture that fails to load falls back to the swatch. The "In the
bottle" rows keep the small swatch.

### Sizes and budget

Pictures are 256 px, each about 3 KB for the placeholders, 2.9 to 7.3 KB for Ed's art, and
under 30 KB by the cutter's check. They are only requested by the potion shop's picker, so a wand or
sword visit downloads none.

On desk a picture is 64 px. On a phone it is 48 px, not the 56 px first asked: 56 px needs
about 90 px more height than the sheet has. 48 px keeps all nine jars in view at 390 x 844
by the layout below (review 16-r1, ruling 3a).

### The phone layout

The sheet's summary row ("Three" and the lock) cost 42 px above the jars and the full or
mixed message 22 px. On the Pours tab of the phone sheet:

- The lock moves into the tab row, at its right end, so it stays on screen and a tap away.
  `GroupMeta.lockInTabRow` is the per-group switch; it is off by default, so the wand and
  sword groups and the potion's other tabs keep their summary row.
- The summary is not drawn but stays in the tab panel as visually hidden text, so a screen
  reader still reads it.
- The reason the jars are shut sits below the jars instead of above them (desk keeps it above,
  by CSS `order`). It is out of view at 390 x 844 at rest, so a tap on a shut jar scrolls it into view
  (nearest, smooth unless motion is reduced) while focus stays on the jar; the jars are still
  `aria-disabled` and described by it, and the stage line still says "Tap the bottle to mix it".
- Rows are the 48 px picture, the label, and a 4 px gap between jars: 71 px each, equal.

At 375 x 667 the body is 157 px tall, so two rows show and the third needs a scroll of about 72 px.

### Placeholders

`pnpm --filter armoury run ingredients:placeholders <out.png>` (`scripts/ingredient-placeholder-sheet.mjs`) draws a 2048 px sheet to this
layout in the installed Chromium: a lit orb in each ingredient's colour with a hint of
its trait (glow, glitter, bubbles, swirl, a droplet highlight, cloud puffs). The PNG
is a build input kept outside the repo. It is now only a way to make a test sheet to the
layout: the nine committed webps are Ed's art (below), cut by the same cutter, so the
generator's output matches nothing committed. (Before that it had already stopped
reproducing the committed placeholders byte for byte: six of them were cut before tickets 10
and 11 retuned those ingredients' colours.)

### Ed's art (ticket 25)

The nine committed pictures are Ed's painted ingredients (E8, E26), cut from one sheet he made
with Gemini's image model ("Nano Banana", E8) from ticket 24's prompt. Which tier and settings
he used were not recorded. No cell was re-done and nothing was repainted, recoloured or
re-centred: the sheet was cut as supplied.

- **The sheet.** 2048 x 2048 px, a baseline JPEG (the prompt asked for a PNG; the cutter takes
  both), with no EXIF segment, so no rotation flag. The original is Ed's copy, kept outside
  the repo at `.scratch/armoury-potions/art/ingredients-sheet.jpg`, beside `prompt.md`,
  `reference.png` and `layout-guide.png`. Its sha256 is
  `d841794b0477f5f1dc51f5d36a7366cf1614534e035c16406b2f2219360d18ce`.
- **The cut.** `pnpm --filter armoury run ingredients:cut <sheet>`, exit 0: Emberroot 5.3 KB,
  Starpetal 7.3, Frogfizz 5.7, Snailshine 5.2, Bluebell dew 5.6, Thundercloud 3.4, Moonmilk
  2.9, Rosehip syrup 3.9, Puffcap 5.7 (45 KB in all).
- **Moonmilk's moon** came back as a small crescent where the prompt asked for the reflection
  of a full moon. Ed saw it and supplied the sheet as it is, so it stands.
- **The ground** came back as about `#100b11`, six levels lighter than `#0a070b`, as ticket
  24's dry run expected. The mask turns that into a soft-edged disc about 1.2 L* lighter than
  the jar tile, which does not show at ordinary brightness.
- **Against the layout contract** (measured on the sheet; a pixel counts as painted when it
  is 28 levels off the ground). The top and middle rows keep to it but for stray tips:
  subjects 66 to 81 percent of a cell, centres within about 5 percent, the Bluebell's stem
  30 px past the central 80 percent and 3 px into the trimmed strip. The bottom row is painted
  about 9 percent of a cell high. The crop therefore trims 36 px off the tip of the Moonmilk
  drop, 24 px off the Rosehip's twig and the upper 110 px of the Puffcap's spores, and the
  spores cross 69 px into Thundercloud's cell (28 px into the foot of its picture). The mask
  is fully transparent along a picture's edge, so no trimmed edge shows and the tips fade as
  the mask section says they would. The stray spores survive only as a speck below the
  Thundercloud's bolt, in the last 5 percent of its picture and at most 23 levels over the
  jar tile: found under magnification, not at the picker's size.
- **The mask and the sizes are unchanged** (64 px on desk, 48 px on a phone): the gate's
  shots gave no reason to move either.

The prompt Ed was handed, the final block of ticket 24's `prompt.md` (any change he made to
it was not recorded):

```text
Paint nine magical potion ingredients for a children's apothecary game, as nine separate painted pictures arranged in a three by three grid on one square image.

LAYOUT. The image is square and is divided into an invisible grid of three rows and three columns: nine equal square cells. Each cell holds exactly one ingredient, centred in its cell and drawn at the same scale in every cell. Everything that belongs to it, stems, drips, bubbles, sparkles and spores included, fits inside an imaginary circle about 70 percent as wide as the cell, centred in the cell, so there is an empty dark margin all round it, widest at the corners. The whole sheet is one flat, even, very dark plum-black background, hex #0a070b, from edge to edge, with no gradient, vignette, texture, floor, table or shadow on it. There are no lines, borders, frames, boxes, labels, numbers, letters or words anywhere. Nothing crosses from one cell into another.

STYLE. Match the art style, palette and lighting of the attached reference image, which shows the candlelit apothecary these ingredients belong to. Use the reference for style, colour and light only: do not draw anything that is in it (no bottles, jars, flasks, candle, toad, shelves, drawers, bowl or table). The row of nine colour squares along its bottom is the palette for the nine ingredients, in the same order as below; it is not a layout.

The look: a hand-painted storybook illustration in soft digital gouache, with gentle gradients and a fine paper grain on the ingredients (not on the background), simple chunky rounded shapes with a few well-chosen details, and no hard black outlines. Every ingredient is lit the same way: one warm golden candle light from the left, so its left side is warm and bright, and a thin cool silvery-blue moonlight rim from behind on the right that traces its right edge against the dark. Shadows inside the shapes are soft and deep plum-brown. Soft modelling inside each shape, but a clean, crisp outer edge against the background. No part of an ingredient sinks into the background's black: its darkest shadow stays clearly lighter than the background, and the rim light traces its right side. All nine are seen the same way: from the front, just a little above eye level, floating in the dark with no ground. The mood is moody but friendly: magical, cosy and inviting, never scary. Colours are rich and saturated, and each ingredient is clearly brighter than the background. Small light effects (a glow, sparkles, bubbles, a wisp of spores) stay close to the ingredient, inside its own cell.

These pictures will be shown very small, about 48 pixels across on a phone, inside a soft round frame that fades out the outer part of each cell. So each ingredient must be a compact, roughly round, bold silhouette that is recognisable as a tiny thumbnail, with the part that says what it is, and its glow, sparkles or bubbles, near the middle; only small, unimportant tips may reach the edge of its imaginary circle. And each of the nine must have a clearly different outline shape, not only a different colour.

THE NINE, read like a book: the top row from left to right, then the middle row from left to right, then the bottom row from left to right.

Top row, left: EMBERROOT, ember orange (#f0892a). A fat, knobbly root curled into a rough lumpy ball, like a chunky knot of ginger, a little wider than it is tall, with two or three very short stubby rootlets, tucked close underneath. Warm light glows out of deep cracks in its middle, as if it holds a small fire inside, brightest and yellowest at its heart, deeper orange at its edges. Its outline is lumpy and irregular, never pointed and never smooth.

Top row, centre: STARPETAL, honey gold (#f5bd3a). A flower seen face on, its five broad pointed petals making a bold five-pointed star, with a small darker amber centre. Fine glittering gold sparkles dust the petals and a few tiny star glints twinkle at its tips. A crisp, sharp star outline.

Top row, right: FROGFIZZ, spring green (#7ccf4f). One big round bead of clear green jelly you can see into, like a giant frogspawn egg: a perfectly smooth sphere with a tiny soft darker seed floating a little below its middle (no ring around it), a bright window highlight at its upper left from the candle, and many tiny clear bubbles with white rims clinging inside it. It fizzes: a few little clear, white-rimmed bubbles rise just above its top, close to it. A smooth round outline with no points, no petals and no lumps.

Middle row, left: SNAILSHINE, pearly teal (#7fd6c8). An empty curled snail shell (no snail), a clear spiral coil winding into its centre, its surface a pearly mother-of-pearl sheen with soft swirls of pale pink and silver catching the light. A short, shiny silver wet trail, no wider than the shell, curls beneath it. A coiled spiral outline.

Middle row, centre: BLUEBELL DEW, cornflower blue (#5b8def). A short green stem arching over like a shepherd's crook, with three cornflower-blue bell-shaped flowers hanging beneath it in a compact cluster, their rims curled back. One fat, perfectly clear, glass-like dewdrop hangs from the lowest bell, twinkling with a bright highlight. Hanging bells under an arch.

Middle row, right: THUNDERCLOUD, storm indigo (#5a4ab8). A small puffy storm cloud, round and billowy on top and flat underneath, deep blue-violet, sprinkled inside with tiny silver sparkles like a starry night sky, with one small bright pale silver-white zigzag of lightning just below it. Billowy bumps on top, flat below.

Bottom row, left: MOONMILK, soft lilac (#c7b2f0). One plump drop of milky lilac liquid, round at the bottom and coming to a soft point at the top, cloudy and misty inside like milk swirling into water, with the small round reflection of a pale full moon (a plain moon with no face) shining on its surface. A smooth teardrop outline, pointed at the top.

Bottom row, centre: ROSEHIP SYRUP, raspberry pink (#e0479a). Two glossy oval rosehip berries side by side, hanging from a short forked brown stem, each with a little dark crown of dry whiskery sepals at its bottom tip. Their skins shine with swirling streaks of lighter pink like stirred syrup, and one sticky drip of pink syrup hangs from the bottom of one berry. Two upright ovals side by side.

Bottom row, right: PUFFCAP, toadstool red (#d42c2c). A chunky little toadstool with a wide, round, dome-shaped red cap covered in pale cream spots, on a short stubby cream stalk. A soft little puff of pale peach-pink, faintly glowing spores hovers just above its cap like a tiny cloud. A dome on a short stalk.

LAYOUT AGAIN, in other words: nine separate ingredients, three across and three down, evenly spaced on a square sheet, each one alone in the centre of its own square with dark empty space around it, all nine at the same scale on the same flat #0a070b background. Top row: Emberroot, Starpetal, Frogfizz. Middle row: Snailshine, Bluebell dew, Thundercloud. Bottom row: Moonmilk, Rosehip syrup, Puffcap. The names are for you only: do not write them anywhere in the image.

AVOID: any text, letters, numbers, labels, signatures or watermarks; a white, light, grey or gradient background; grid lines, borders, frames or panels; bottles, jars, flasks, cauldrons, plates or bowls; a table, floor, cast shadow or reflection; glows or shadows spilling into a neighbouring cell; faces or eyes on the ingredients; flat vector icons, clip-art or emoji style; pixel art, game icons or app icons; photographic realism or a glossy 3D-render look; anything from an existing film, book or game.

Output: one square PNG image, as large as you can make it, at least 1024 by 1024 pixels.
```
