# 0109 - armoury potion look: fake glass either side of a layered liquid, by one candle and a cool rim

> Amended 2026-11-14: the wax seal is cut; see "The wax seal: cut" below.

- **Status:** Accepted
- **Date:** 2026-11-14
- **Related:** [ADR 0082](0082-armoury-material-zones.md) and [ADR 0083](0083-armoury-glowing-gems.md)
  (the bloom cap at rest), [ADR 0099](0099-armoury-smithy-stage.md) (the smithy's canvas
  settings), [ADR 0105](0105-armoury-upright-items-on-the-stage-rigs.md) (the rigs),
  [ADR 0107](0107-armoury-bottle-generator.md) (the bottle's form),
  [ADR 0110](0110-armoury-potion-shop-scene-card-and-picture.md) (the room, the card and its
  painter), [ADR 0113](0113-armoury-three-ingredients-that-mix.md) (the colour wheel). Tickets
  11 and 12 add sections here.

## Context

Ed picked from the look spike's contact sheet (ticket 01, E9-E12): glass G1 (thin clear),
liquid L2 (soft band edges), light M1 (one candle low on the left and a cool rim from behind on
the right), share picture P2 (the capture drawn over the card's own ground). The spike's tone
mapping (ACES) and its lack of a post pass at rest stood unless someone objected; nobody did.
The spike was a single hand-drawn bottle on a stand-in table; this is the look on ticket 09's
generated bottles, in ticket 13's room, for every shape, glass tint, stopper and label, with
the three-ingredient layered liquid of ticket 20. The mixed liquid and the swirl are ticket 23.

## Decision

**What is built.** `stage/potionMaterials.ts` holds the pure tables (a glass look per `glass`
value, a stopper look per `stopper`, a label layout per `label`, plain and gold paper) and the
builders: the glass as four passes, the liquid as two, the cork and the label paper.
`stage/potionScene.tsx` holds M1's lamps, the environment and the canvas's tone mapping;
`PotionMesh.tsx` draws the bottle from them, and keeps the plain grey `?clay` drawing beside it
for form gates.

**Fake glass, no transmission.** Two WebGL contexts already run in the close look (ADR 0077),
and transmission would add a scene pass per frame. The glass is G1's two materials, each drawn
twice: a tint pass that multiplies what is already drawn (the glass lets the liquid through
nearly unchanged face on, darker and cooler edge on) and a light pass drawn premultiplied over
it (the reflections, a fine fresnel rim, and a little opacity at the edges). Ticket 09's glass
is a closed solid, so both its outer and its inner surface face the camera somewhere, and
facing alone cannot say what is in front of the liquid. Facing with the surface can: the
outside faces the eye where it is in front of the liquid and faces away behind it, and the
cavity's lining does the opposite. The mesh marks every vertex on a surface that lines a
hollow (`aInner`: the lip's inner fillet, the bore, the cavity's wall and its floor; the profile
says how many of its points are outside, `glassOutside`), and a fragment is near when
`gl_FrontFacing != inner`. The far passes keep what is not near. It needs no eye or centre
uniform, and it is exact in any pose (turned, leaned, tipped, or both at once) wherever the
glass's cross-section along the view is convex. The glass stopper is solid: its `aInner` is all
0, so it splits by facing alone and shares the bottle's four programs. **Known limit:** the
gourd's waist is concave. Tipped towards the viewer, the lower bulb's top faces the eye
but lies behind the upper bulb's liquid, so it is drawn over it: a faint glass outline across
the upper band, no tinted patch. No two-pass split can order a concave body; it is accepted.
Every glass pass sets `forceSinglePass`. Without it three draws a transparent double-sided
material as a back-face pass and then a front-face pass, flipping the winding for the first,
so `gl_FrontFacing` read true on back faces: the far outer wall drew in the near pass at full
light (normals turned to face the eye), and the near lining drew in the far pass. That was
round 2's second candle, mirrored across the bottle with its own halo. The far half's light is
backed off to 0.15 of the near half's (`FAR_LIGHT`, about a seventh), and the cavity's lining
reflects 0.02 of the outside's (`INNER_LIGHT`, a fiftieth; it was 0.06, which drew a second
glint beside the first once the lining was in front), so the candle shows once in the glass
rather than as two flames side by side (the spike's "two candles"). The glass takes no specular from the lamps either: the candle's point light
and the environment's flame would land in different places and read as two candles too, so
the environment's flame is the one reflection. The light passes merge their `NEAR_PASS`
define into `MeshPhysicalMaterial`'s own `STANDARD` and `PHYSICAL` defines rather than replace
them; with the glass's specular and IOR at three's defaults that changes no pixel. The liquid's
two materials merge the same way, which made the body's `specularIntensity` 0.12 take effect (it
had been ignored): its reflections are fainter than round 1's.

**Glass tints.** Clear is G1. Sea, amber and violet lean what the glass lets through towards
their `GLASS_TINTS` colour (about 40 percent), take that colour into the edge and the rim, and
add a faint body colour at the edges, so the tint shows over the dark room as well as over the
liquid; smoky's factor is about 0.62. None is cut. The tint pass multiplies the framebuffer,
which holds sRGB-encoded colour, so its factors are not linear multipliers of light: smoky's
0.62 of the encoded value is about a third of the light, and the tints come out a little more
saturated than their hex. The factors were tuned by eye on that basis; smoky's was about half
until ticket 23's gate, where a murky mix behind it read as a black bottle (ADR 0111).

**The liquid.** Ticket 09's level-plane cut, banding by the plane `dot(p, u) = h` in the
bottle's millimetre frame (never `aHeight`), kept. Front faces are the liquid's skin; back faces
are its level surface, coloured where the eye's ray crosses the plane. The two are separate
materials (back side drawn first), and three draws a back side by flipping the winding, so its
faces are front facing: `gl_FrontFacing` cannot tell the surface, and a `LIQ_SURFACE` define
per material does (merged into three's own defines). The cut fades over one pixel (`fwidth`)
instead of a hard discard, which smooths the far rim's stair-step. Each band blends into the
next over 8 percent of the thinner of the two (between 0.4 and 4 mm): L2's soft edge. The
thinnest band below the first boundary is measured from the liquid's floor along the
surface's up, not the upright floor: the level table keeps that floor per row (`floors`,
`floorAt`), the mesh's own floor is used upright, and the shader's darkening towards the floor
reads the same tilted floor. Each thickness is clamped at 0 and each edge at 0.02 mm at least,
so no `smoothstep` is ever inverted or closed up; a unit test walks every shape at three necks,
two and three pours, 0 to 90 degrees in 1 degree steps, and holds every edge positive and every
band's window in order. Without it, leaned 60 and tipped 45 at once (69 degrees), the round
flask's bottom two bands swapped colour. The colour of the bands is one function of the height along the surface's up
(`potionBand`), so ticket 23's mix can blend it to one colour without restructuring the shader.
Each band carries its trait (see "Traits" below). The lighting terms are the spike's L2 (depth of
colour where the eye looks through more liquid, darker at the silhouette, the candle's light out
of the far side, the cool light through it from behind, a pearly sheen on milk), plus a gentle
darkening towards the floor and a slow 5 percent variation in a clear liquid, so a clear band
has volume instead of reading as paint. Round 2's gate found the liquid duller than its jar:
Starpetal read khaki (value 0.50, green 0.74 of red) where the panel's chip is bright yellow,
and every liquid was a darker, redder cousin of its chip. The deepening exponent is 1.25 (L2's
1.45 pushed each colour towards its strongest channel, yellow to orange, orange to red) and the
liquid's own glow is 0.4 of its deepened colour (was 0.12), so the candle's orange light no
longer sets the hue; all nine now read as their jars in the close look and the box. The body
is lit and shaded by its turn about the bottle's axis (its normal's part across the axis, three
quarters of the way from the true normal), so a shoulder or a foot reads as more of the same
liquid: tipped towards the viewer, the square-shouldered bottle's shoulder no longer shows as a
lighter crescent with a curved edge, a cup's rim. Seen from below, the surface pass takes no
reflection and mirrors its normal to the front's, so it carries on the band in front of it. The level surface (which round 1 never drew: its look
then came from the far wall's inside) is the top band at full depth, lit at 0.9 of the body's
diffuse with the body's own glow at 0.85, so its tone carries on from the liquid under it; a
crisp dark ellipse (0.4) read as the open mouth of a cup. Over that, a soft sheen: the cool
light from behind (`uBackColour`), weighted by Fresnel and a broad lobe about its mirror
direction (power 6, `LIQUID.surfaceSheen` 0.9), so the surface catches a little cool light
towards the back right, as the glass's rim does. The surface material is roughness 0.3,
specular intensity 1 and environment 1.6, but from the box's camera it mirrors the dark room
above, so the sheen is what shows. Cloudy bands keep their milky noise on the surface (the
ray-plane point drives it). `createLiquid().setSurface(up, levels, floor)` writes the surface's
up, the band tops (at most `MAX_POURS`), the floor along that up and the edges into the
uniforms in place, allocating nothing, for tickets 12 and 14.

**Render order and depth.** Opaque first (the cork, the label), then the glass's far
half (tint 1, light 1.1), the liquid's surface (2) and body (2.1), particles (3, ticket 11), the
glass's near half (tint 4, light 4.1). Glass and liquid are transparent and write no depth;
the liquid's order only interleaves with the glass's because it is transparent. The glass
stopper is the same glass, a little more opaque, split by facing alone (above).

**Stoppers and paper.** Cork is a speckled canvas texture with a bump. The label is paper with
its ink drawn on a canvas in IM Fell English: the child's name for it, or the derived name
(which reads "Moonmilk, Rosehip and Starpetal" until the mix and changes at it, so the texture
redraws when the name changes). The name is set in balanced lines in the largest
size that fits the label's ink area: inside a double ring on a round label, between rules on a
banner, below the hole and the string's U on a tag. The face against the glass is plain paper.
A mixed secret blend (`isGold`) gets gilt paper with a bright edge. The tag's string is told
from its card by its vertices sitting at the uv origin (a unit test pins this). Tier B's cut
(plain paper with a ruled line) is not taken.

**Light and environment (M1).** The candle is a point light at the room art's flame
(`tableArt.ts`'s `CANDLE` relative to `FOOT`, a little in front of the bottle), warm, with a
flicker of a few percent driven by the liquid's clock; the cool rim is a directional light from
high behind on the right; a faint warm fill from the front. A weak point light in the potion's
glow colour sits low in front of the bottle so the paper and stopper pick up a trace of the
liquid's colour; the room art and the picture's painter draw the pool of that light on the table
(ticket 13). The environment is drei lightformers only: the candle's flame and its warm wash on
the left, a warm table bounce below, the dim room behind, cool panels high on the right and
dark above. The materials' `envMapIntensity` values (the glass's 1.5, the liquid's 1.6 and 0.5)
have no effect: three uses `scene.environmentIntensity` (1) for any material that has no
`envMap` of its own, so every potion material reflects the lightformers at 1, as the wand's and
the sword's materials do. The spike's dim studio map under them was dropped: its softboxes showed as stray
hexagons in the glass, and the shop no longer needs `studio.hdr`. No asset is added.

**Tone mapping and bloom.** The potion's canvases render with ACES. `@react-three/fiber` already
sets `ACESFilmicToneMapping` on every canvas that is not `flat`, so the wand's canvas renders
ACES too, and the sword's renderer is ACES under a composer that applies AgX
(`SWORD_TONE_MAPPING`; its capture renders AgX directly). `PotionToneMapping` sets ACES on the
potion's two canvases anyway, so the potion's choice does not hang on the library's default.
AgX turned the liquids pastel in the spike (the ember glow salmon, the gold mustard); ACES keeps
them jewel-like. There is no post pass at
rest: through the smithy's composer the glass goes dull, because over a transparent canvas the
post pass drops the light the glass adds. Every potion shader ends in the sword's soft knee under
`0.92 * BLOOM_THRESHOLD`; the paper and cork give off far less than that. The uncorking's
bloom is ticket 15's (ADR 0111): a composer only while the flare runs, or the flare drawn as its
own capped sprites.

**The clock.** `uTime` comes from a `LiquidClock` per stage: frame time, held still under
`prefers-reduced-motion`, and frozen at `?freeze=<seconds>` on a dev server so every gate frame
is drawn at the same moment (`scripts/gpu-shots.mjs --freeze=1.2`). Under reduced motion nothing
in the liquid or the light moves.

**Traits (ticket 11).** What each trait draws is data in `potion/traits.ts`: a set of shader
weights (`cloud`, `swirl`, `pearl`, `glow`, `fleck`, `cling`) and at most one kind of mote, plus three
ingredients' own variants (Thundercloud's flecks are silver, Snailshine's swirl is pearly,
Puffcap's cloud carries spores). A variant holds only while its ingredient keeps that trait, so a
cut to `clear` or `cloud` drops it. `createLiquid().setLayers` writes the weights into uniform
arrays of `MAX_POURS`, and `potionBand` blends them with the colour across the same soft edges,
so no trait reaches past its band's edge. Every term reads `uTime` and adds to the liquid's own
light before `potionCap`; every `fwidth` is taken before the discard and the trait branches.

- `cloud` (Moonmilk, Puffcap; `murk` until ticket 23): two slow noises, a darker mottle under
  lighter milky billows, so the band's mean stays on its jar. A cloudy band's edges blend over
  2.2 times as much (`CLOUD_EDGE`, `bandEdges`'s `soft`), still within 0.45 of the thinner band.
- `swirl` (Rosehip, Snailshine): L2's domain-warped marbling, with the noise squashed 1.9 times
  along the surface's up so its streaks lie level in any pose; light veins over a deeper body,
  laid on at 0.64. `pearl` keeps the veins' width and feathers their edge wider, lays them on at
  0.34 (about half Rosehip's contrast), and lets a thin-film shimmer carry the difference: half
  iridescent, on the veins, through the body and more at grazing angles, half as strong away from
  the candle. Narrowing the veins for `pearl` (round 1) drew thin bright contour lines that read
  as a pool's caustics; soft, low wisps under a pearly sheen are nearer L2.
- `glow` (Emberroot): the liquid's own light and its lit diffuse fall to 0.4 and 0.45 at the
  silhouette, and a light from inside, 0.55 of the deepened colour warmed towards yellow
  (`glowWarm`, 1, 1.7 and 1.4 by channel) times a calm, slowly rising noise (0.8 to 1) and the
  square of the thickness, fills the middle, so the middle glows yellower and brighter than the
  edges: a light from inside, not a mottled orange cloud (round 1's noise ran 0.5 to 1 and read as
  Puffcap's cloud in orange). At its brightest the red channel's self light and glow, 0.87 x (0.4
  + 0.55) = 0.83, is under `REST_CAP` though past the soft cap's knee (0.6 x `REST_CAP` = 0.77);
  the unit test checks only those two terms, and the soft cap holds the rest (the key, back and
  milk light).
- `glitter` (Starpetal gold `#ffe4a0`, Thundercloud silver `#e4eaff`): fine flecks in the skin
  (a 1.5 mm cell, three in four holding a fleck 0.15 to 0.5 mm, never under 0.6 px), each a facet
  turning slowly: a faint glimmer, and a flash of three times the candle's colour only where the
  skin faces the candle. The larger flecks are motes (below).
- `fizz` (Frogfizz): bubbles clinging to the glass, and the rising bubbles as motes (below). The
  clinging ones are in the skin and never move, so they show in a still frame and at box size: a
  3 mm cell lattice in the bottle's frame, 85 in 100 cells holding a seeded point; where that
  point lies within 0.7 of its radius of the skin, a disc 0.5 to 1.1 mm in radius shows on the
  skin around it: a pale rim (a little of the candle's colour) over slightly dimmed liquid, a
  lighter middle and a glint on the candle's side. The eight nearest cells are searched, so no
  bead is cut by a cell's edge. They make fizz "beads and rings on the glass", cool and white,
  where glitter is warm sparks.
- `clear` (Bluebell): nothing; the clean jewel colour.

**Depth.** The body under its widest point darkens by up to 0.42 times the fifth power of how
straight down it faces, so the darkening gathers at the foot and leaves a band's middle alone:
the round flask's bottom (Bluebell) band reads 0.61 of its centre's luminance at its foot (round
3 of ticket 10, 0.77; L2, 0.65) and its centre within 3 percent of round 3. The nine's centre
colours stay where round 3 put them or move towards their chips (Emberroot, Moonmilk and Puffcap
lighter from the glow and the milk).

**Motes.** `stage/LiquidMotes.tsx` draws every point-like trait in one `THREE.Points` draw at
render order 3, between the liquid and the glass's near half: depth tested and writing no depth,
so the label and the cork hide them and the near glass tints over them. Its material is built
once and shares the liquid's own uniforms (the clock, the bands, the eye and the candle), so
reduced motion and `--freeze` hold it with the liquid. The layout is `motePool`: at most 300
(`MAX_MOTES`) rest points spread evenly through the whole cavity, 1.2 mm off its wall, seeded,
built with the mesh. In the vertex shader each point joins the band its rest point lies in along
the surface's up (`moteBand` is the same rule in TypeScript), so in any pose, leaned or tipped,
each band holds its share of the pool (85 to 100 of a full bottle's points) and its motes stay
level with it. A mote fades out as its rest point comes within 1.5 mm (or a quarter of the band,
if less) of its band's floor or top (`moteEdgeFade`), so when the levels move under it (a lean,
the slosh, a pour) it is already gone when it changes band: nothing pops or jumps to another band
at full strength (a unit test sweeps the levels and checks every change of band happens unseen).
A band whose trait has motes shows its program's `density` of them. The programs are a table
keyed by kind (`MOTE_PROGRAMS`), open for ticket 23's sinking `speck`:

- `fleck`: drifts 0.7 mm about its rest point; a diamond flake 0.5 to 1.15 mm that tumbles and
  flashes towards the candle on the candle's side. About one in seven is instead a soft,
  out-of-focus flake 1.6 to 2.8 mm at under half strength, so the band has depth of sparkle.
- `bubble`: seven in ten rise in streams, the rest on their own, from the band's floor, growing a
  little, fading in at the floor and out at the band's top or the surface: a ring 0.7 to 2.3 mm
  with a bright rim and a glint at its upper left. Its rise is timed on a fixed length for the
  bottle (`cavityRadii`'s `rise`, a band's height in a full bottle, upright), not on the band's
  own span: the bubble is at `lo + span x fract(seed + t x v / rise)`, so a span that changes
  smoothly moves it smoothly however long the page has been open (round 1 divided by the span,
  and a minute in a 2 percent change of span threw every bubble half a rise). It climbs 6 to 12
  mm a second in a band of that height, faster in a taller band. A stream's site is on a 10 mm
  lattice in the bottle's own frame, carried across the surface's up by projection, so a turning
  up slides the streams smoothly and no bubble jumps to another stream; the projection also has
  no blind direction (round 1's cross product with the bottle's y was NaN tipped flat towards or
  away from the eye). `bubbleAt` is the TypeScript twin, and its tests pin a bubble's path as
  continuous a minute in, under a sloshing top, a climbing (pouring) top and a swinging up.
- `spore`: drifts 1.8 mm slowly; a soft round puff 1 to 2.8 mm, pale pink on Puffcap's red.

Each mote fades over its band's soft edges, at the liquid's floor and towards the wall (the
cavity's radius, sampled 48 times up its height), and dims and takes the band's colour through
the liquid between it and the eye (as far as the wall at its height or the surface, more through
milk). It is drawn premultiplied with a small cover (0.1 to 0.3), so it adds its light and hides
little of the
liquid: no mote reads as a dark hole. Its size is in millimetres, at least 1.4 device pixels and
at most 40.

**Still frames.** Everything moves on `uTime` alone, so under `prefers-reduced-motion` the clock's
moment 0 is the still form: bubbles caught at every height of their rise and beading the glass,
flecks turned at every angle (a few flashing), spores where they rest. Three of one ingredient draw one continuous
liquid: every noise is in the bottle's frame and the pool is one spread for the whole bottle, so
no band repeats another's pattern.

**Telling them apart.** Neighbouring ingredients on the wheel never share a texture: glow beside
glitter (Emberroot, Starpetal), glitter beside bubbles, bubbles beside a pearly swirl, the swirl
beside clear (Bluebell), clear beside silver flecks (Thundercloud), flecks beside milk (Moonmilk),
milk beside a swirl (Rosehip), the swirl beside spores (Puffcap), spores beside glow. For a
red-green colour-blind child (the chip colours simulated for protanopia and deuteranopia, Machado
2009, CIELAB delta E), the closest pairs are Starpetal and Frogfizz (protan 8.8, deutan 19.8; the
closest of all, near equal in lightness), Emberroot and Starpetal (deutan 12.1, protan 19.0),
Emberroot and Frogfizz (15 to 16, not neighbours but often in one bottle), Bluebell and
Thundercloud (19 to 22, with a large gap in lightness), Snailshine and Rosehip (deutan 19.8) and
Puffcap and Emberroot (deutan 24.9). Texture tells each apart: warm gold sparks against cool white
beads on the glass; a middle glowing yellower than its edges against sparks; that glow against
beads; a clean jewel against silver stars; a pearly sheen over faint wisps against Rosehip's
stronger veins (one marbling pattern, two contrasts); soft spores against a lit middle.

**The mixed liquid (ticket 23).** `setLayers` with one layer (the mix's colour, `trait` and main
ingredient) already fills a whole bottle with that trait, motes and all. For the swirl, the place
to carry a trait into the mix is `potionBand`'s `PotionTraits` (blend each band's towards the mix's
by `uMix`, as the colour) and the motes' per-band `uKind` and `uDensity`.

**Cuts.** None.

**The traits' cost.** Measured as below, before and after interleaved: the first visit's close
look 3.5 to 3.8 ms a frame on a desk and 2.1 to 2.3 ms on a phone viewport; the box stage 1.3 to
1.4 ms and 1.1 to 1.2 ms. The swirl is the dearest trait (a whole bottle of Snailshine: 4.1 and
2.5 ms); one draw of at most 300 motes measured within noise. Round 2 (the clinging bubbles,
the fixed rise, the softer swirl and glow) left the first visit within noise and added about 0.2
ms on a desk and 0.15 ms on a phone to a whole bottle of Frogfizz (3.7 and 2.2 ms), the cost of
searching the eight nearest cells for a bead.

**The picture (P2).** `capture()` clears to `PICTURE_GROUND` opaque, renders the bare scene at
2000 px wide and restores the clear colour. Ticket 13's painter lifts that ground back to clear
and keeps the glass's added light, so the glass does not wash out or dark-edge on the card.

**Colours.** Under M1 and every tint the nine ingredients keep the wheel's rainbow order of hue
(OKLCH): Emberroot `#f0892a` (h 57), Starpetal `#f5bd3a` (h 84), Frogfizz 136, Snailshine 183, Bluebell 263,
Thundercloud `#5a4ab8` (h 285), Moonmilk `#c7b2f0` (h 300), Rosehip `#e0479a` (h 351), Puffcap
`#d42c2c` (h 27). Rosehip, Puffcap and Emberroot were 19 and 29 degrees apart and are now 36 and
30; Moonmilk was near white (chroma 0.02) and read as pale lavender milk, the spike's weakest
layer, and is now a pearly lilac (chroma 0.09); Thundercloud went near black through the
liquid's depth and every tint, so it is lighter (L 0.42 to 0.49) at the same hue. Those moves
left Emberroot and Starpetal the closest neighbours (28 degrees, OKLab 0.131), so Starpetal is a
lighter, yellower gold (`#f2c14e` to `#f8d14f`, L 0.83 to 0.87, h 85 to 92): the pair is now 35
degrees and 0.171 apart, Starpetal and Frogfizz 44 degrees and 0.161, and the closest pair is
Rosehip and Puffcap at 0.143. Round 2's gate then asked for a honey gold, not a lemon one:
under ACES a bright yellow drifts greener, so with the brighter liquid `#f8d14f` rendered with
green 0.83 of red. Starpetal is `#f5bd3a` (L 0.83, h 84), which renders at value 0.70 and green
0.77 of red; it is 0.124 from Emberroot in OKLab, the closest pair now, and in the bottle the
two stay far apart (Emberroot renders at green 0.48 of red). A unit test pins the rainbow order. `MURK_REACH` is untouched, and
the potion suite's colour bounds hold. Presets keep their bottles and finishes.

**The wax seal: cut.** Ticket 09 deferred the wax seal's short-neck question to this gate. Two
reshapes for short necks were tried here (the prescribed shorter coat, then a thicker coat under
the bead); the first made no visible difference and the second read as a cap, so neither was
kept. On 2026-11-14 the gate (`shots/10/r2/review.md`) cut it: upright on the short round flask
it read as a muffin top or a mushroom cap, tipped towards the child as a plastic drawer pull, and
its even gloss as plastic or clay, worse in the mixed colours a child sees after the mix. Its material and the shader split
between it and its cork are gone; ADR 0107 records the rest of the cut.

**Cost.** Measured on the M3 MacBook, headless Chromium on ANGLE Metal, uncapped, each frame
forced to finish with a 1-pixel `readPixels`, median of 5 runs of 3 s, whole page: the close look
3.7 ms a frame on a desk (2880 x 1800 drawing buffer; clay 2.5) and 2.3 ms on a phone viewport
(780 x 1688; clay 1.1); the box stage 1.7 ms and 1.4 ms. The spike measured 3.05 and 1.90.

## Consequences

- A new glass tint, stopper or label is a row in `potionMaterials.ts`, judged by eye on the
  real GPU.
- The level plane, its floor and the soft edges live in the bottle's millimetre frame, and the
  near and far split in the mesh, so the pour, the slosh and the swirl (tickets 12, 14, 23)
  drive the same uniforms without new sorting rules. A sloshed, non-level surface changes the
  floor along its up too, so `setSurface` must be handed that floor.
- The glass shows no refraction: the liquid's edge is not displaced and the room behind the
  empty neck is unbent. At box size and in this room it reads as glass; up close it is the one
  tell.
- The potion's look depends on the room's light. Only the candle's point light follows
  `tableArt.ts` (it reads `CANDLE` and `FOOT`); the rim (`MOON_AT`) and the flame lightformer
  in the environment are fixed in `potionScene.tsx`, so a moved candle in the art needs them
  moved by hand.
- The near and far split depends on `aInner`: a new glass part, or a new piece in the glass's
  profile, must say which side of the hollow it is on.
