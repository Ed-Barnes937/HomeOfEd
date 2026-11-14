# 0110 - armoury potion shop: the brewing table drawn in CSS and SVG, a recipe card on string, the picture over its own ground

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR 0101](0101-armoury-smithy-scene-tag-and-picture.md) (the smithy's
  scene, the pattern this follows), [ADR 0108](0108-armoury-potion-shop-on-the-shell.md)
  (the potion shop on the shell and its starting palette), [ADR 0105](0105-armoury-upright-items-on-the-stage-rigs.md)
  (the box stage's base line), ADR 0109 (the potion's look: glass, liquid, the M1
  light and the picture capture).

## Context

Ed picked scene A from the scene mock (E7): the brewing table, plain, without
B's window. The bottle stands front-on on a dark plank table, shelves sink into
the dark behind it, and a candle stands low on the left. The light is M1 (E11): a
warm candle low at the front left and a cool rim from behind on the right. The
picture is P2 (E12): the stage's capture drawn over the card's own ground. The
mock was flat stand-in art; the room has to reach the wand shop's and smithy's
standard and stay moody without making any word hard to read (E5).

## Decision

**Drawn, like the smithy.** `apothecary/tableArt.ts` makes one seeded SVG of the
whole room, front-on: a dark cabinet of boards and stiles, two shelves of jars,
bottles, books and scrolls, dried herbs hanging from the top shelf, a cobweb, a
lower bank of small labelled drawers, then the plank table with its grain,
joints, old rings and wax drips, a mortar and pestle, a spoon, a cork and spilled
petals, and the candle in its brass dish.

The bay behind the bottle is narrow and quiet: one plain panelled door (two would
put their meeting line behind the glass), and a lower shelf raised so the tallest
stopper clears its edge by 40 units or more (`LOWER_SHELF_UNDERSIDE`, tested),
holding only two low dark crocks. The bays either side keep their shelves lower,
so the shelf line steps at the stiles. Only about x 755 to 1490 of the board is in
every frame (desk, phone and picture), so what tells the story stands there, in
the bays either side of the bottle's: a fat toad asleep in a clay saucer on the
left (the shop sells Frogfizz and brews "Frog's Bathwater"), lit from the candle
below it and darker than any liquid; and the glowing jars, green beside the toad
and violet and green on the right, drawn in a pass over the room's darkness so
they read as small coloured lights, as in mock A. The drawers vary like the
smithy's bricks: label plates of different widths, some blank, one gone (its
nail holes and an unfaded patch), two chalked, rings and knobs, some two columns
wide, deeper rows lower down, and a few left standing open (a dark gap above,
a lit lip) with a sprig or a rolled paper poking out. Their light is unchanged:
detail for a second look, not more brightness. The light is in the drawing: the candle's warm
pool on the wall and the table, a faint cool wash from the high right, and the
room falling dark away from the candle and toward the top, where the header's
words sit. Grain comes from the smithy's noise tiles (`smithy/grain.ts`). The art
is built on the potion shop's first visit (`roomImage()`), never at module load,
so a wand-only visit builds none of it (`tableArt.test.ts`).

**One board, placed by the bottle's foot.** The board is drawn at one unit per
CSS pixel when the box stage is 460 px tall. The scene sets `--slot` (the box
stage's size), `--u` (`--slot / 460`), `--bottle-x` and `--floor` (the foot's
place, in the scene's container units), and everything, the board, the bottle's
button, the card and its string, is placed from those. The foot stands at 0.70 of
the scene's height on desk and 0.62 on a phone (O17), at 56 and 60 percent of its
width, but rises on a short scene so the card that wraps most (found by setting
every generated name and tag line on the card) and the hint still fit: on desk
280 px and on a phone 176 px are kept below the foot. On desk the foot also
stands far enough right that the candle's dish is never cut. On a phone the box
stage shrinks with the foot so the tallest stopper stays below the header's
buttons, and the card takes the scene's width so the longest texts wrap to fewer
lines; at 360x640 the stage is about 148 px.

**The hint beside the card.** On desk the hint starts at the card's right edge
plus a gap and wraps short of the scene's right edge; the card narrows from 430
to 380 px to leave it room. A desk scene narrower than 600 px (a 900 to 999 px
window) has no room beside the card, so the hint goes under it as on a phone
(a container query on the scene; the scene's children take the values, as a
container can't query itself). `apothecary.iwft.tsx` holds the card and the hint
whole, apart and above the sheet at eight sizes from 360x640 to 1440x900. `BASE_LINE` (the foot's place inside the stage) is unchanged at 0.84: the
scene's line is a scene setting, not a stage one, so the stage's framing is
untouched.

**The bottle is about 11 percent bigger.** The box stage is 460 px on desk (was 414) and 224 px on a phone (was 200), Ed's open note on bottle size (for-ed
section 7). It is one CSS value each if the reviewer disagrees.

**Light directions shared with the stage.** The candle stands about 240 mm left
of the bottle and a little in front of it, its flame near the bottle's middle,
where M1's key light is. `bottleOnTable(spec)` casts the bottle's outline
(`potionOutline`) as its shadow: run right and slightly back across the table,
foreshortened, with its breadth across the run, drawn soft and fading with
distance, plus a tight contact shadow at the foot. The light through the liquid
pools inside the shadow in the potion's glow colour (CSS, `--glow-rgb`).

**Live parts: the candle only.** The flame sways and its light glimmers by a few
percent (CSS keyframes, about 4 and 5 seconds). Nothing else in the scene moves,
and under reduced motion neither does the candle.

**The recipe card.** The shared `Tag`, tied by drawn string from its hole to the
bottle's neck, where a small knot wraps the neck over the stage. The card says
what `recipeCard` says: the number, the name (the generator's until the player
renames it; before the mix that is the list of its layers, "Moonmilk, Rosehip and
Starpetal", and the revealed name after), the tag line, and `gold` when `isGold`
holds: a secret blend that has been mixed. A gold card swaps the
paper and ink tokens for gilt ones and draws a gilt edge round the clipped paper
(four hairline drop shadows). On desk the card lies on the table's front left,
below the candle; on a phone it lies below the bottle across the scene with the
hint under it.

**Palette and contrast.** `[data-shop='apothecary']` in `tokens.scss` adds the
gilt card's tokens and `--scene-lit`, the brightest the room gets behind the
scene's own words (measured from the art behind the hint: `#311f16` at most;
the token is set brighter, `#3a2a24`, for margin). `palette.test.ts` reads the
block and holds every pair the shop uses at WCAG AA: panel text, lore and
numerals on the panel, the Keep button, each card ink on the darker end of its
paper (cream and gilt), the hint and ink on the lit scene, and the focus ring (3:1).

**The picture (P2).** `paintApothecaryCard` draws the same room (preloaded as an
image on the shop's first visit, with the flame and without grain), the candle's
light, the bottle's shadow and caustic from `bottleOnTable`, then the capture on
the base line, and a vignette after. The capture is drawn over `PICTURE_GROUND`
(`potion/framing.ts`), so the glass's reflections keep their light;
`liftFromGround` turns that ground clear again before the capture is laid on the
room, keeping each faint reflection as the light it added, so the glass shows the
room through it with no flat-coloured box round the bottle. A capture that is
already clear (the clay stage's) is left as it is. The painter returns the card's
colours: cream, or gilt with a gilt edge (`TagColours.edge`, new and optional,
so the wand's and the sword's pictures are unchanged). `CardContent` now carries
the item's `params`, which the potion's painter needs for the shadow and the gilt.

**Shelf.** The potion's box on the shelf is a dark wooden crate with a glass
window the bottle stands in, lit faintly in its glow colour; the silhouette is
unchanged, and the wand's and sword's boxes are untouched. The window sits
between the label and a slightly smaller seal, so the label keeps right 80 px
(four less than the plain box), and the bottle is drawn foot-down in a box that
ends 2 px inside the window (`preserveAspectRatio` `xMidYMax`).

## Considered and rejected

- **A window (B) or an alcove (C):** Ed picked plain A.
- **Drawers behind the bottle:** their labels and rings showed through the clear
  glass and fought it; the bay behind the bottle has a plain door instead.
- **The story prop and glowing jars in the far bays:** beyond about x 1500 the
  board is out of the frame on most screens and in the picture; they stand in the
  bays next to the bottle's instead.
- **A brass scale or a carboy as the story prop:** the toad gives a child
  something to point at and ties to the shop's own ingredients.
- **Folding repeats in the mixed tag line:** the spec asks for "Mixed from
  Frogfizz, Frogfizz and Bluebell", the recipe in pour order, so it stays unfolded
  while the name before the mix folds.
- **Drawing the capture opaque on the card:** P2's ground would cover the room in
  a square round the bottle. Lifting the ground keeps P2's reflections and the room.
- **Moving `BASE_LINE` to 0.70 / 0.62:** it is the foot's place inside the stage
  and sizes the stage's framing; the scene's line is set by the scene instead.

## Consequences

- The stage must keep M1's key at the front left and its rim at the back right;
  if it moves, the candle, the shadow and the caustic must move with it.
- `capture()` must draw over `PICTURE_GROUND`, or return a clear background.
- The card is gold when `isGold` holds, a mixed secret blend; an unmixed bottle
  with a blend's ingredients shows its layers on a cream card until the mix.
- A new name or tag line that wraps to more lines than today's longest needs
  the room kept below the foot to grow, and `LONGEST_TEXTS` in the iwft to name it.
