# 0109 - armoury potion look: fake glass either side of a layered liquid, by one candle and a cool rim

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
builders: the glass as four passes, the liquid as two, the cork, the wax and the label paper.
`stage/potionScene.tsx` holds M1's lamps, the environment and the canvas's tone mapping;
`PotionMesh.tsx` draws the bottle from them, and keeps the plain grey `?clay` drawing beside it
for form gates.

**Fake glass, no transmission.** Two WebGL contexts already run in the close look (ADR 0077),
and transmission would add a scene pass per frame. The glass is G1's two materials, each drawn
twice: a tint pass that multiplies what is already drawn (the glass lets the liquid through
nearly unchanged face on, darker and cooler edge on) and a light pass drawn premultiplied over
it (the reflections, a fine fresnel rim, and a little opacity at the edges). Ticket 09's glass
is a closed solid, so both its outer and its inner surface face the camera somewhere; facing
cannot say what is in front of the liquid. Each pass therefore keeps the half of the glass on
its side of the liquid: a fragment is near when `dot(p - c, eye - p) > 0`, with `p` the
fragment and `eye` the camera in the bottle's millimetre frame and `c` the middle of the
liquid on the axis. That holds as the bottle turns, leans and tips. The cavity's own surface
reflects a sixth as much as the outside, and the far half a seventh as much as the near half,
so the candle shows once in the glass rather than as two flames side by side (the spike's
"two candles"). The glass takes no specular from the lamps either: the candle's point light
and the environment's flame would land in different places and read as two candles too, so
the environment's flame is the one reflection.

**Glass tints.** Clear is G1. Sea, amber and violet lean what the glass lets through towards
their `GLASS_TINTS` colour (about 40 percent), take that colour into the edge and the rim, and
add a faint body colour at the edges, so the tint shows over the dark room as well as over the
liquid; smoky lets through about half of everything. None is cut.

**The liquid.** Ticket 09's level-plane cut, banding by the plane `dot(p, u) = h` in the
bottle's millimetre frame (never `aHeight`), kept. Front faces are the liquid's skin; back faces
are its level surface, coloured where the eye's ray crosses the plane. The cut fades over one
pixel (`fwidth`) instead of a hard discard, which smooths the far rim's stair-step. Each band
blends into the next over 8 percent of the thinner of the two (between 0.4 and 4 mm): L2's soft
edge. The colour of the bands is one function of the height along the surface's up
(`potionBand`), so ticket 23's mix can blend it to one colour without restructuring the shader.
Every band is drawn as its trait's base: `cloud` and `murk` are a slow milky noise, the rest
`clear`; the traits themselves are ticket 11's. The lighting terms are the spike's L2 (depth of
colour where the eye looks through more liquid, darker at the silhouette, the candle's light out
of the far side, the cool light through it from behind, a pearly sheen on milk), plus a gentle
darkening towards the floor and a slow 5 percent variation in a clear liquid, so a clear band
has volume instead of reading as paint. The surface is darker than the liquid under it and
reflects little: a brighter, more reflective surface read as the rim of a cup.
`createLiquid().setSurface(normal, levels)` writes the surface's up and the band tops into the
uniforms (at most `MAX_POURS`) for tickets 12 and 14.

**Render order and depth.** Opaque first (the cork, the wax, the label), then the glass's far
half (tint 1, light 1.1), the liquid's surface (2) and body (2.1), particles (3, ticket 11), the
glass's near half (tint 4, light 4.1). Glass and liquid are transparent and write no depth;
the liquid's order only interleaves with the glass's because it is transparent. The glass
stopper is the same glass, a little more opaque, split about its own middle.

**Stoppers and paper.** Cork is a speckled canvas texture with a bump. The wax is a glossy
clear-coated material with a sheen in the stopper's wax colour; it and the cork under it are one
part of the mesh, split in the shader by position (inside the bore below the lip is cork). The
label is paper with its ink drawn on a canvas in IM Fell English: the child's name for it, or
the derived name (which reads "Moonmilk, Rosehip and Starpetal" until the mix and changes at it,
so the texture redraws when the name changes). The name is set in balanced lines in the largest
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

**Tone mapping and bloom.** ACES on the potion's two canvases only (`PotionToneMapping`); the
wand's canvas keeps none and the sword's keeps AgX. AgX turned the liquids pastel in the spike
(the ember glow salmon, the gold mustard); ACES keeps them jewel-like. There is no post pass at
rest: through the smithy's composer the glass goes dull, because over a transparent canvas the
post pass drops the light the glass adds. Every potion shader ends in the sword's soft knee under
`0.92 * BLOOM_THRESHOLD`; the paper, cork and wax give off far less than that. The uncorking's
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
(OKLCH): Emberroot `#f0892a` (h 57), Starpetal 85, Frogfizz 136, Snailshine 183, Bluebell 263,
Thundercloud `#5a4ab8` (h 285), Moonmilk `#c7b2f0` (h 300), Rosehip `#e0479a` (h 351), Puffcap
`#d42c2c` (h 27). Rosehip, Puffcap and Emberroot were 19 and 29 degrees apart and are now 36 and
30; Moonmilk was near white (chroma 0.02) and read as pale lavender milk, the spike's weakest
layer, and is now a pearly lilac (chroma 0.09); Thundercloud went near black through the
liquid's depth and every tint, so it is lighter (L 0.42 to 0.49) at the same hue. `MURK_REACH` is untouched, and the potion suite's
colour bounds hold. Presets keep their bottles and finishes.

**The wax seal (ticket 09's deferral).** Judged in the glossy wax on the round flask at neck 0
and 0.1: the sheen along the bell and the beaded runs read as dripped wax. The prescribed
reshape for short necks (the overhang at the lip ring plus 0.05 neck diameters, the coat at most
0.5 neck diameters below the lip) was tried: the overhang already is that, and the coat shortens
by 2 mm at most, which made no visible difference, so it was not kept. A thicker coat under the
bead on short necks (as thick as the lip, so the silhouette narrows less below the bead) was
tried too: it filled the waist a little but read as a cap, the first form gate's complaint, so it
was not kept either. The wax stays as ticket 09 shaped it; the gate
decides whether its bell still reads as a mushroom on the short round flask, and only then is it
cut (schema, `bottles.ts`, presets, recorded in ADR 0107).

**Cost.** Measured on the M3 MacBook, headless Chromium on ANGLE Metal, uncapped, each frame
forced to finish with a 1-pixel `readPixels`, median of 5 runs of 3 s, whole page: the close look
3.7 ms a frame on a desk (2880 x 1800 drawing buffer; clay 2.5) and 2.3 ms on a phone viewport
(780 x 1688; clay 1.1); the box stage 1.7 ms and 1.4 ms. The spike measured 3.05 and 1.90.

## Consequences

- A new glass tint, stopper or label is a row in `potionMaterials.ts`, judged by eye on the
  real GPU.
- The level plane, the soft edges and the near and far split all live in the bottle's
  millimetre frame, so the pour, the slosh and the swirl (tickets 12, 14, 23) drive the same
  uniforms without new sorting rules.
- The glass shows no refraction: the liquid's edge is not displaced and the room behind the
  empty neck is unbent. At box size and in this room it reads as glass; up close it is the one
  tell.
- The potion's look depends on the room's light: change the candle or the rim in `tableArt.ts`
  and the lamps follow, since they read its `CANDLE` and `FOOT`.
