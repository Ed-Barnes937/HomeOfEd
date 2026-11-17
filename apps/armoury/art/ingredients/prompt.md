# The ingredient sheet prompt (ticket 24)

What Ed gives Gemini's image model ("nano banana") to paint the potion shop's nine ingredients
as one three by three sheet. Attach `reference.png` (this folder) with the prompt: a square crop of
the scene's candle, table and drawers, with the nine colours beneath in grid order. The sheet Ed got back is `ingredients-sheet.jpg` in this
folder; ticket 25 cut it into `public/ingredients/` (ADR 0112).

## Style notes

Written from the brewing-table scene's last passing frames (`shots/10/r3/box/*-desk-scene.png`,
`shots/13/r2/*-scene.png`) and the street painting (`apps/armoury/public/street/street.webp`).
The scene is a dim apothecary at night drawn as simple, chunky, softly rounded shapes: a fat
sleeping toad, round-bellied flasks, a stubby candle, rows of drawers. Forms are modelled with
gentle gradients rather than lines, there are no black outlines, and a fine paper grain lies
over everything, so it reads as painted rather than vector. Values are low: walnut and umber
browns sinking into plum-black (`#0a070b` is the darkest), with the only bright notes being the
candle flame, a warm pool of light on the table, and jewel-coloured glows (a green flask, a
violet jar) that bloom softly into the dark around them. Light comes from one warm candle on the
left (golden highlights on left faces) and a cool moonlit rim from behind on the right (thin
blue-silver edges). The potion itself is the most saturated thing in the frame: clean, rich,
glossy colour against muted surroundings. The street painting is the same world at a larger
scale: a storybook illustration with visible soft brushwork, warm lamplight against cool blue
dusk, glowing jewel windows, cosy rather than spooky. The ingredients should sit between the
two: the scene's simple chunky shapes, soft gradients and grain, with the street's painterly
richness, lit by the scene's candle-and-moon light, saturated enough to be the brightest things
on a near-black tile. Moody but friendly (E5): mysterious light, never anything scary.

## The prompt (paste as is, with `reference.png` attached)

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

## Notes for Ed

### Model and settings

- Use Gemini's image model: Nano Banana Pro if your plan offers it (better at following a long
  layout), otherwise Nano Banana. Google AI Studio and the Gemini app both work; AI Studio lets
  you set the size directly.
- In AI Studio, set **Aspect ratio** to **1:1** and the largest **Resolution** (2K or 4K) in the
  settings panel. The Gemini app may have no such settings: there the prompt's "square" and the
  square `reference.png` do the job. Either way, check the download is square and at least
  1024 px (Preview: Tools > Show Inspector). If it is not square, ask again; do not crop it
  yourself (a hand crop shifts the grid). 1K gives exactly 1024 px, which the cutter accepts;
  anything under 1024 on either side is refused.
- Attach `reference.png` (always). Attach `layout-guide.png` only for plan B below.
- Download the full-size original, as PNG. If you only get a JPEG it still cuts, unless the file
  is marked as rotated; re-save it upright as PNG from Preview if so.
- The Gemini app may stamp a small sparkle mark in the bottom-right corner. That corner is
  outside the round frame the picker draws, so it never shows, but check it does not touch the
  toadstool. AI Studio adds no visible mark.

### About the reference

Image models tend to copy what is in a reference picture as well as its style, so the reference
holds only a candle, the table and drawers, and the nine colour squares. The prompt says to take
only style, palette and light from it. If a candle, drawers, bottles or jars still turn up, reply: "Remove every bottle, jar, candle, animal and piece of furniture; keep only the
nine ingredients on the flat dark background, in the same places."

### Plan B: when the grid drifts

If two tries come back with the wrong number of objects, uneven spacing, or things straddling
cells, start a new chat, attach `reference.png` **and** `layout-guide.png`, paste the prompt,
and add this sentence at the end:

```text
The second attached image is a layout guide: paint one ingredient centred inside each of its nine faint dashed circles, in the order above, and paint the flat #0a070b background over every guide line and circle so that none of them shows.
```

(Faint leftovers of the guide are harmless: its cell lines fall in the strip the cutter trims
off, and its circles are near-black.)

### Fixing one cell

Ask for an edit in the same chat, naming the cell by its place and its name, and tell it to keep
the rest. For example:

```text
Edit only the middle cell of the top row, the Starpetal. Keep the other eight cells, their positions, the background and the size of the image exactly as they are. In that cell, make the star's five petals broader and add more gold sparkle.
```

Cells: top row left Emberroot, centre Starpetal, right Frogfizz; middle row left Snailshine,
centre Bluebell dew, right Thundercloud; bottom row left Moonmilk, centre Rosehip syrup, right
Puffcap. After an edit, check the other eight did not shift or change; if they did, keep the
earlier sheet and try the edit again. Edits can come back smaller or a different shape: check the
size again after every edit.

### Checklist before handing it back

1. Nine ingredients, three by three, in the order above (top row Emberroot, Starpetal,
   Frogfizz; middle Snailshine, Bluebell dew, Thundercloud; bottom Moonmilk, Rosehip syrup,
   Puffcap).
2. Each one centred in its cell with clear dark space around it; nothing touches or crosses into
   a neighbour; all nine about the same size.
3. Square, at least 1024 px, PNG.
4. One flat near-black background everywhere: no grid lines, frames, vignette, floor or shadows.
5. No text, letters, numbers or labels anywhere (look closely at the corners and under each
   ingredient).
6. No bottles, jars, candle, toad or furniture.
7. The small-size test: shrink the image until each cell is about the size of a fingertip. You
   can still tell all nine apart, and these pairs differ by **shape**, not just colour:
   Starpetal and Frogfizz, Emberroot and Starpetal, Emberroot and Frogfizz, Bluebell dew and
   Thundercloud, Snailshine and Moonmilk, Rosehip syrup and Puffcap. (Optional: in Preview,
   Tools > Adjust Color, drag Saturation to the left to see it in grey, then close without
   saving.)
8. Colours close to the nine squares in `reference.png`, and it looks like it belongs beside the
   reference scene.

### Where to save it

`apps/armoury/art/ingredients/` (the sheet in use is `ingredients-sheet.jpg`)

### The command that cuts it (ticket 25 runs it; ADR 0112)

From the repo root (the sheet path is relative to `apps/armoury`):

```bash
pnpm --filter armoury run ingredients:cut art/ingredients/ingredients-sheet.jpg
```

It writes the nine `apps/armoury/public/ingredients/<id>.webp` files, or refuses the whole
sheet with the reason and writes nothing. Checked in a dry run on a mock sheet before Ed painted his.
