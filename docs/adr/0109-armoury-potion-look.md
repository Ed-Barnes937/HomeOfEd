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
The far half's light is backed off to 0.15 of the near half's (`FAR_LIGHT`, about a seventh),
and the cavity's lining reflects 0.06 of the outside's (`INNER_LIGHT`, about a seventeenth),
so the candle shows once in the glass rather than as two flames side by side (the spike's
"two candles"). The glass takes no specular from the lamps either: the candle's point light
and the environment's flame would land in different places and read as two candles too, so
the environment's flame is the one reflection. The light passes merge their `NEAR_PASS`
define into `MeshPhysicalMaterial`'s own `STANDARD` and `PHYSICAL` defines rather than replace
them; with the glass's specular and IOR at three's defaults that changes no pixel.

**Glass tints.** Clear is G1. Sea, amber and violet lean what the glass lets through towards
their `GLASS_TINTS` colour (about 40 percent), take that colour into the edge and the rim, and
add a faint body colour at the edges, so the tint shows over the dark room as well as over the
liquid; smoky's factor is about half. None is cut. The tint pass multiplies the framebuffer,
which holds sRGB-encoded colour, so its factors are not linear multipliers of light: smoky's
half of the encoded value is about a quarter of the light, and the tints come out a little more
saturated than their hex. The factors were tuned by eye on that basis and stay as they are.

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
Every band is drawn as its trait's base: `cloud` and `murk` are a slow milky noise, the rest
`clear`; the traits themselves are ticket 11's. The lighting terms are the spike's L2 (depth of
colour where the eye looks through more liquid, darker at the silhouette, the candle's light out
of the far side, the cool light through it from behind, a pearly sheen on milk), plus a gentle
darkening towards the floor and a slow 5 percent variation in a clear liquid, so a clear band
has volume instead of reading as paint. The level surface (which round 1 never drew: its look
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
dark above. The spike's dim studio map under them was dropped: its softboxes showed as stray
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

**The picture (P2).** `capture()` clears to `PICTURE_GROUND` opaque, renders the bare scene at
2000 px wide and restores the clear colour. Ticket 13's painter lifts that ground back to clear
and keeps the glass's added light, so the glass does not wash out or dark-edge on the card.

**Colours.** Under M1 and every tint the nine ingredients keep the wheel's rainbow order of hue
(OKLCH): Emberroot `#f0892a` (h 57), Starpetal `#f8d14f` (h 92), Frogfizz 136, Snailshine 183, Bluebell 263,
Thundercloud `#5a4ab8` (h 285), Moonmilk `#c7b2f0` (h 300), Rosehip `#e0479a` (h 351), Puffcap
`#d42c2c` (h 27). Rosehip, Puffcap and Emberroot were 19 and 29 degrees apart and are now 36 and
30; Moonmilk was near white (chroma 0.02) and read as pale lavender milk, the spike's weakest
layer, and is now a pearly lilac (chroma 0.09); Thundercloud went near black through the
liquid's depth and every tint, so it is lighter (L 0.42 to 0.49) at the same hue. Those moves
left Emberroot and Starpetal the closest neighbours (28 degrees, OKLab 0.131), so Starpetal is a
lighter, yellower gold (`#f2c14e` to `#f8d14f`, L 0.83 to 0.87, h 85 to 92): the pair is now 35
degrees and 0.171 apart, Starpetal and Frogfizz 44 degrees and 0.161, and the closest pair is
Rosehip and Puffcap at 0.143. A unit test pins the rainbow order. `MURK_REACH` is untouched, and
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
