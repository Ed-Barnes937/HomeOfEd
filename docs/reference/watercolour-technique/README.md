# Watercolour technique — background study

A study of how a high-fidelity watercolour renderer works, gathered so espy's
ink field (`apps/espy/src/features/doodle/render/`) can be iterated on with a
clear picture of what the state of the art actually does.

Subject: **Sudo Aquarelle** — <https://sudoaquarelle.com/> (Lionel Mora). The
site ships plain, unminified, commented ES modules, so this is a study of
first-party source rather than a reverse-engineered bundle.

## Provenance and licence

| | |
|---|---|
| Studied | 2026-08-16 |
| Files read | `/js/sim.js` (the engine), `/js/main.js`, `/js/pigments.js`, `/js/ui.js`, `/style.css`, `index.html` |
| Underlying model | Curtis et al. 1997, *Computer-Generated Watercolor* (SIGGRAPH) — credited by the site itself |
| Licence | **None served.** Legal status of the source is unknown. |

**Do not port their code.** The value here is the physical model, and that model
is a published paper. Anything we build is implemented from the paper and from
the understanding recorded below. Short excerpts are quoted in this document for
commentary and comparison only.

Everything below is confirmed from source unless a line says otherwise. Colour
hex values are arithmetic on confirmed linear constants, not sampled pixels.

---

## 1. Shape of their engine

Raw **WebGL2, zero dependencies** — no THREE, regl, pixi or p5, no bundler, no
import map. Fixed **848 × 1060** simulation grid regardless of window size.
`gl.disable(BLEND)` at init: nothing is ever alpha-composited.

Three-layer model, all textures `RGBA16F` and ping-ponged:

| Texture | Channel packing |
|---|---|
| `paper` (generated once) | `r` height/tooth, `g` absorbency, `b` fibre noise, `a` pore-entry threshold |
| `water` | `r` film height, `gb` velocity, `a` capillary saturation |
| `sus` / `dep` (×2 each) | 8 channels of **suspended** and **deposited** pigment |
| `ground` | rgb transmittance of dried, baked-in glazes |

Six programs (`PAPER`, `WATER`, `PIG`, `DISPLAY`, `MASK`, `BAKE`). Per frame:
two substeps of water-then-pigment, plus one display pass — five passes total.

The whole engine is ~940 lines. A reduced version — water pass, pigment pass,
Kubelka-Munk display, dropping salt/alcohol/backlight/x-ray — is estimated at
roughly 300 lines and three passes. (Estimate, not measured.)

---

## 2. Edge darkening is emergent, not drawn

The single most transferable idea in the study. They never draw a rim. They
model its physical cause: evaporation at the wet/dry boundary creates a
replacement current that carries pigment outward.

Three cheap ingredients combine:

**a. Outward velocity from the wetness gradient.** `wetAt()` is a soft wetness
indicator, `smoothstep(0.0004, 0.004, filmHeight)`. Its gradient points inward,
so subtracting it pushes water out:

```glsl
// evaporation at the wet-dry boundary drives outward flow (edge darkening)
vec2 sob = vec2(wetAt(t+vec2(1.7,0.)) - wetAt(t-vec2(1.7,0.)),
                wetAt(t+vec2(0.,1.7)) - wetAt(t-vec2(0.,1.7)))*0.5;
float em = length(sob);
if (em > 1e-4) vel -= (sob/em) * em * uEdgeFlow * hasW * (0.3 + 0.7*min(uEdgeDrive, 12.0)/12.0);
```

`uEdgeFlow = 0.22`. `uEdgeDrive` is the evaporation multiplier (1 normally, 12
during a forced dry) — so the ring only fully develops while the sheet is
actively drying, which is exactly how real paint behaves.

**b. Boosted evaporation at the rim.** `h -= uEvap*(1.0 + uEdgeEvap*em*8.0)`,
with `uEvap = 0.00018`, `uEdgeEvap = 2.5`.

**c. A settle rate that explodes as the film thins:**

```glsl
// pigment stays suspended while the film is deep; settles hard as it thins
float settleGate = 0.035 + uDryDep*pow(1.0-wet, 1.6);   // uDryDep = 9.0
```

A **257× swing** between fully wet (0.035) and fully dry (9.035). Pigment
strands at the boundary because it has nowhere else to go.

Staining pigments additionally resist lifting (`liftA = uLiftBase*liftDyn*(1-uStainA)`),
which is what stops the centre of a wash donating all its colour to the rim.

---

## 3. Colour: Kubelka-Munk, not alpha

52 pigments, each defined by **two hex swatches** — how it looks over white and
over black — from which K (absorption) and S (scattering) are derived by the
classic two-constant inversion. Entries carry `gran`, `stain`, `dens` and a
family, e.g. Cerulean `gran 0.90` grains hard where Phthalo Blue `gran 0.05`
does not.

At display, all channels sum into one K and one S, then standard K-M
reflectance over the ground:

```glsl
vec3 a = 1.0 + K/S;
vec3 b = sqrt(max(a*a - 1.0, 1e-6));
R = (1.0 - Rg*(a - b*cothv(b*S))) / (a - Rg + b*cothv(b*S));
```

Two details that carry most of the visual payoff:

**Saturating dilution.** Optical thickness saturates, so a wash approaches
masstone but never black:

```glsl
vec4 dl(vec4 d){ vec4 g = pow(max(d, vec4(0.0)), vec4(1.35)); return 2.2*g/(g + 3.0); }
```

**Glazing by baked transmittance.** When a layer dries, its K-M transmittance is
folded permanently into a `ground` texture and the pigment buffers cleared.
Display then applies `Rg *= G*G` — squared, because light passes down through
the glaze and back up again. Later washes composite genuinely on top of the
dried layer instead of mixing into it. Physically correct and very cheap.

Plus a Saunderson correction for internal reflection at the paint–air interface,
gated by coverage so bare paper is untouched. All maths is in linear light;
`pow(1/2.2)` is applied exactly once, at the end.

**Wet vs dry appearance** falls out of the same model — water index-matches the
particles, so less light scatters back: `S *= 1.0 - 0.5*wetLook; K *= 1.0 + 0.2*wetLook`,
with `Rg *= 1.0 - 0.12*wetLook`. This is why their washes visibly lighten as
they dry.

---

## 4. Boundary feathering by invasion percolation

Not a displacement map. Each texel has its own noise-defined pore-entry
threshold and only drinks when a neighbour's saturation tops it:

```glsl
float P = 0.26 + 0.48*pap.a;            // per-texel threshold from noise
float drive = max(sx, max(sy*0.55, sd*0.75)) * 0.994;   // anisotropic; 0.6% loss per hop
float gate = smoothstep(P - 0.05, P + 0.03, drive);
s += uCap*2.6 * max(drive - s, 0.0) * gate * (0.7 + 0.6*pap.b);
```

Horizontal spread at full strength, vertical damped to 0.55, diagonal 0.75 — so
the front advances along the fibres in ragged jumps and then stalls. The
threshold field is itself anisotropic. Pigment rides the capillary current
toward the advancing dry front.

Two lesser deformation sources: divergence-free **curl-noise convection** in
standing water (`uSwirl = 1.6`, noise scale 46px, gated on film depth so it only
stirs actual puddles), and **paper relief steering the flow** (`uRelief = 0.45`,
paper height added into the free-surface gradient).

---

## 5. The paper

**Fully procedural, GPU-generated, deterministic.** Zero image assets — no grain
tile, no noise PNG, nothing. Zero CSS/SVG effects — no `feTurbulence`, no blend
modes, no `backdrop-filter`. One fragment shader writes an `RGBA16F` texture
once at startup with a fixed seed, so it is the same sheet every visit.

Their own `og:description` is candid: *"Real fluid dynamics, real pigment
optics, fake paper."*

### Three fBm fields, summed as signed deviations from 0.5

```glsl
float g     = fbm(p/uGrainScale + uSeed*11.3);            // tooth
float fine  = fbm(p/2.6 + uSeed*23.7);                    // fine grain
float fiber = fbm(vec2(p.x/46.0, p.y/3.4) + uSeed*31.1);  // ANISOTROPIC streaks
float height = clamp(0.5 + (g-0.5)*uGrainAmp + (fine-0.5)*uFineAmp + (fiber-0.5)*uFiberAmp, 0.02, 0.98);
```

The **fibre term is the detail most implementations miss** — fBm sampled on a
heavily non-uniform axis, ~13.5:1 stretch, giving long horizontal streaks. That
is what makes it read as a laid sheet rather than as noise. The `pore` channel
does the same at ~2.9:1.

Noise is plain hash-based value noise, **5 octaves, lacunarity 2.03, gain 0.5**.
The 2.03 rather than 2.0 is deliberate — it stops octaves aligning into a
visible grid.

Presets: hot press `grainScale 4.5 / amp 0.20`, cold press `9.0 / 0.55`
(default), rough `15.0 / 0.85`. Rougher means both coarser and deeper — all
amplitudes rise together.

### Grain becomes surface

Two-tap forward difference of the height field, each weighted 0.7, gain 5.0,
bias 0.985, clamped `[0.90, 1.05]` — a cheap fake normal map, light effectively
from top-right. Then a screen-space white-noise dither at ±0.01 on top of the
paper-space fBm, purely to kill banding in flat areas.

```glsl
float shade = clamp(0.985 + 5.0*(-(hR-pap.r)*0.7 - (hU-pap.r)*0.7), 0.9, 1.05);
vec3 Rg = uPaperTint * (shade + (hash12(gl_FragCoord.xy*0.71)-0.5)*0.02);
```

Note the bias sits *below* 1.0, so flat paper is marginally darker than raw tint.

### Colour

`paperTint = [0.93, 0.905, 0.845]` — **linear**, not sRGB, because it composites
before the single gamma encode. R and G sit close; B drops sharply. That
blue-channel drop is the entire "aged rag paper" impression.

| Condition | ≈ sRGB (computed, not sampled) |
|---|---|
| Flat paper (`shade = 0.985`) | `#F5F2EB` ← what you see |
| Deepest dimple (`0.90`) | `#EBE8E1` |
| Brightest peak (`1.05`) | `#FCF9F2` |
| Fully wet (`×0.88`) | ≈ `#E7E4DD` |

**No vignette, no gradient across the sheet.** It is optically flat.

### Granulation — two distinct effects

*Physical:* pigment preferentially settles into the hollows, weighted per
pigment, and this survives drying:

```glsl
float valley = (0.5 - pap.r)*2.0;                  // >0 in the hollows
vec4 granFA = clamp(1.0 + uGranA*valley*uGranStr, 0.05, 2.5);
```

*Optical:* a visibility modulation applied to K and S at display time,
`granVis = 1.1`, weighted by the granulation of the pigments actually present at
that texel — height at weight 1.4, fibre noise at 0.6.

### The sheet-as-object is pure CSS

The "sitting on a desk" read is not in the canvas at all:

```css
:root { --room: #f2f2f1; }
#sheet::after {
  box-shadow: 0 0 0 1px rgba(23,23,21,.07), 0 24px 80px rgba(23,23,21,.14);
}
```

Neutral grey room against warm cream paper — only ~3 levels of luminance apart,
so the read is carried by **hue, not contrast**. Shadow is two-part: a 1px
hairline at 7% for the crisp cut edge, plus a wide `0 24px 80px` at 14% for air
underneath.

---

## 6. No ambient wash

The sheet starts optically blank. The `ground` texture is cleared to white
(*"bare paper: the ground filters nothing"*) and there are no startup splats.
Every soft bloom visible in their screenshots is real deposited pigment from the
simulation.

**This gives us no precedent for faking ambient staining.** If espy wants an
ambient wash behind the marks, we are inventing it, not porting it.

---

## 7. Incidental finding worth keeping

Their stamp spacing gates on distance from the **last stamp position**, not path
length:

```js
// A stamp lands only when the pointer is a full spacing away from the LAST
// STAMP'S POSITION — spatial, not path-length, gating. A trackpad fingertip
// rolling in place as it lifts walks plenty of path but goes nowhere, and
// used to dump a pond of splats on that one spot.
const spacing = Math.max(cfg.r * 0.38, 1.5);
```

A real touch-input bug, already found and fixed by someone else. Relevant to any
future espy work that emits along a drag.

---

## 8. How this maps onto espy today

espy's field is **threshold-a-diffused-dye-buffer**; theirs is **simulate
pigment settling**. Both run a WebGL2 fluid sim, but the resemblance stops at
the solver.

| Aspect | espy today | Sudo Aquarelle |
|---|---|---|
| Silhouette | Gaussian lobe layout in `fluid.helpers.ts`, then thresholded | Emergent from water/pigment transport |
| Rim pooling | Explicit `smoothstep` band inside the threshold (`edgeGain 0.14`, `rimBand 0.08`) | Emergent from evaporation + settle gate |
| Granulation | Flat single-octave value noise over the whole wash (`grainScale 50`, `grainAmount 0.09`) | 3-field fBm, physical deposition bias + optical modulation |
| Colour | `mix(paper, ink, tone)` in sRGB, monochrome | Kubelka-Munk over ground, linear light, 52 pigments |
| Layering | None — one baked raster per field | Bake-to-ground glaze, transmittance squared |
| Paper | Flat `theme.paper` fill, no surface | 4-channel generated texture feeding the optics |
| Lifetime | Blooms ~1500ms, freezes, bakes to a bitmap | Runs continuously and interactively |

### The structural difference

In espy, paper is a **layer underneath** — `surface.ts` paints `theme.paper`
then blits the baked raster over it. In theirs, paper reflectance sits **inside**
the Kubelka-Munk equation, so granulation and wet-darkening fall out for free.

That is the line dividing what ports cheaply from what does not. Grain, relief
shading, colour space and the CSS sheet treatment all land in our current
architecture untouched. Granulation-that-responds-to-pigment and
wash-lightens-as-it-dries cannot be ported — they would have to be faked
separately, or bought by adopting the deposition model.

### Also worth noting

Our rim and granulation are both *painted on* at fixed magnitude rather than
emergent. That is precisely the failure `engine/layout.ts` documents as the
reason for `MIN_BLOBS = 3`: at phone scale a single large blot is
"proportionally too smooth to read as a funky mark", because the distortion is a
fixed magnitude while the mark is not. An emergent model would scale on its own
and that floor could go.

---

## 9. Candidate directions

Not decisions — decisions belong in an ADR. Ordered by payoff per line of change.

**Fits the current architecture, no restructuring:**

1. **Anisotropic fibre term** in the display grain. Ours is isotropic
   `vnoise(vUv * 50.0)`, single octave; theirs is three fields at three scales
   with one heavily stretched. Cheapest visible improvement available.
2. **Relief shading** from a two-tap height difference, so grain reads as tooth
   rather than as speckle.
3. **Work in linear light**, gamma-encode once. We currently mix `paper`/`ink`
   in sRGB.
4. **Paper-as-object CSS** — warm sheet against neutral room, two-part shadow.
   A `styles/tokens.scss` change with no canvas involvement.
5. **Screen-space ±0.01 dither** to kill banding in flat wash areas.
6. **Lacunarity 2.03** rather than a power of two in any multi-octave noise.

**Requires the deposition model — a rewrite of `fluid.ts`'s display half:**

7. Edge darkening from the wetness gradient plus a settle gate, replacing the
   explicit rim band.
8. Saturating dilution `2.2*d^1.35/(d^1.35+3)` in place of the linear
   `washMax + rim + gran` tone.
9. Invasion-percolation feathering instead of a smoothed threshold.
10. Bake-to-ground glazing, if espy ever grows a notion of a finished layer.

Items 7–10 would replace most of `displayFragment` and a good part of
`DEFAULT_TUNING`. Note that espy bakes and freezes after ~1500ms, so a
deposition model would need to reach a settled state within the bloom window
rather than running interactively — a real constraint their design does not have.

---

## 10. Gaps in this study

- Hex values in §5 are computed from the confirmed linear tint and the confirmed
  `pow(1/2.2)`. Nobody sampled rendered pixels. Spot-check with a colour picker
  if exact matching ever matters.
- No author write-up exists beyond an announcement post; the shipped source was
  the better primary source and was used instead.
- The ~300-line estimate for a reduced engine (§1) is a judgement call, not a
  measurement.
- Their source was read, not run. Behaviour under interaction is inferred from
  the code and from the site's visible output.
