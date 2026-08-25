# 01 — Procedural paper for the doodle canvas

**Type:** task
**Status:** ready-for-human

**What to build:** Replace espy's flat `theme.paper` fill with a generated
watercolour paper surface — tooth, fine grain, anisotropic fibre, relief
shading — and dress the canvas as a sheet of paper sitting on a desk.

All values are **static constants**. No `?tune` panel, no user-facing controls,
no new tunable knobs. One fixed seed, so it is the same sheet every load.

Technique reference:
[`docs/reference/watercolour-technique/README.md`](../../../docs/reference/watercolour-technique/README.md)
§5 and §9 items 1–6. Implement from the described technique — do **not** port
sudoaquarelle source (unlicensed; see the study's provenance section).

## Scope

**The paper surface**

- Three fBm fields summed as signed deviations from 0.5: coarse tooth, fine
  grain, and an **anisotropic fibre** term sampled on a heavily stretched axis
  (~13:1). The fibre term is what makes it read as a laid sheet rather than as
  noise — it is the most important part of this ticket.
- Value-noise fBm, 5 octaves, **lacunarity 2.03** (not 2.0 — a power of two
  aligns the octaves into a visible grid), gain 0.5.
- Relief shading from a two-tap forward difference of the height field, so
  grain reads as surface rather than as speckle. Tight clamp; the flat-paper
  bias sits just under 1.0.
- A screen-space white-noise dither at roughly ±0.01 on top, to kill banding in
  flat areas.
- Warm tint, composed in **linear light** and gamma-encoded once. R and G close
  together, B dropping away — that blue-channel drop is the whole "aged rag"
  impression. Study §5 gives working values.
- Pick one paper weight and hard-code it. Cold press is the sensible default.

**The sheet as an object**

- Canvas card reads as paper on a desk: warm sheet against a neutral-grey room,
  carried by hue rather than by contrast (~3 levels of luminance apart), with a
  two-part shadow — a 1px hairline for the cut edge plus a wide soft one for
  air underneath. Study §5.
- This is a `styles/tokens.scss` / `DoodlePage.module.scss` change with no
  canvas involvement. Check it against the existing sketchbook chrome and keep
  whichever reads better — the study's room colour is not automatically right
  for our palette.

## The one architectural decision

Paper must cover the **whole** canvas, must survive resize (the fit letterboxes
when the viewBox aspect stops matching the canvas), and must be present when
WebGL is unavailable. Today `render/fluid.ts`'s `displayFragment` composites ink
over paper *inside the shader* and bakes an opaque raster, which `surface.ts`
then blits over `paintPaper`. Opaque ink rasters would cover any paper we
generate.

**Recommended:** make the baked field raster carry **alpha** (ink coverage)
instead of compositing over paper, generate the paper separately, and let
`surface.ts` blit ink over paper. This keeps paper independent of the sim, so
the no-WebGL fallback and the letterbox margins get it for free.

That means:

- `displayFragment` outputs ink with coverage as alpha rather than
  `mix(paper, ink, tone)`.
- The GL context is created with `alpha: false` today — that changes, and
  premultiplication needs care through the bake.
- **Gotcha:** `useDoodle.ts`'s `toPersistDataURL` writes `image/jpeg`, which has
  no alpha channel. It must move to PNG or WebP, and the resulting
  `localStorage` size needs a sanity check against `PERSIST_CAP_PX` — `session.ts`
  is quota-safe but a fatter raster eats the budget.

Generate the paper wherever it fits the layering rules — a small dedicated pass
or an offscreen canvas are both fine. Regenerate on resize, not per frame.

If the alpha route turns out to fight the bake, say so and propose the
alternative rather than forcing it.

## Constraints

- Respect the app's one hard boundary: `engine/*` and the fluid pure helpers
  stay pure TS. Only `render/surface.ts`, `render/fluid.ts` and `useDoodle.ts`
  may touch a canvas.
- Do not add tunable state. The existing `fluid.tuning.ts` is already flagged as
  tech debt — do not grow it. New constants are plain `const`s next to the code
  that uses them.
- Surgical: this ticket does not change blot generation, the sim, or the
  brush archetypes. Ticket 02 owns those.
- Paper generation happens once per size, not per frame — this runs on phones.

## Acceptance criteria

- [x] The canvas shows visible paper texture: tooth, fine grain, and directional
      fibre streaks. The fibre anisotropy is apparent on inspection.
- [x] Grain reads as a lit surface, not as flat speckle.
- [x] No banding in flat paper areas.
- [x] Paper covers the full canvas, including letterbox margins after a resize
      that changes the aspect.
- [x] Paper is present when WebGL is unavailable (the plain-blot fallback path).
- [x] The canvas card reads as a sheet on a desk.
- [x] Restored sessions still show their baked field correctly, and the
      persisted raster still fits comfortably in `localStorage`.
- [x] Same sheet every load (fixed seed).
- [x] No new tunable knobs; `fluid.tuning.ts` has not grown.
- [x] `pnpm lint`, `pnpm typecheck`, and espy's tests green (`pnpm --filter espy run test` —
      `turbo --filter` has a known cyclic-dep problem in this repo).
- [x] Screenshot in the ticket comments, phone width and desktop width. (Taken
      and reviewed at both widths; the files stay in the gitignored
      `.scratch/*/shots/` — the tracker only commits map/spec/issues, so they
      are named below rather than embedded.)

## Comments

**2026-08-16 — implemented.** The alpha route worked; nothing had to be walked back.

**Where the paper lives.** `render/paper.ts` is PURE TS — it fills an RGBA byte
buffer and has no DOM access, so it unit-tests off-DOM and stays on the right
side of the hard boundary. `surface.ts` wraps it in an `ImageData`, and it is
the only new module. All constants are plain `const`s in that file;
`fluid.tuning.ts` is untouched.

**The one thing that needed a real decision: resolution.** Generation is ~15
value-noise samples per pixel, so it does not survive being run at device
resolution. Measured, on this machine:

| target | cost |
|---|---|
| phone, CSS px (390×620) | 48ms |
| phone, device px (780×1240) | 188ms |
| desktop, CSS px (1200×760) | 142ms |
| desktop, device px (2400×1520) | **571ms** |

So the sheet is generated in **CSS px** and blitted scaled to the device rect.
Two consequences worth knowing:

- Sizes are **quantised to 256px and only ever grow**, so dragging a window edge
  doesn't regenerate per frame — it regenerates when the canvas crosses a bucket.
- The sheet is **capped at 1600 CSS px** on the long edge and stretched beyond
  that. Safe because the study's paper is optically flat (§5: no vignette, no
  gradient), so a stretched or cropped sheet is indistinguishable.

At dpr 3 the fine grain goes a little soft from the upscale. It still reads; if
that ever matters, the fix is a GL paper pass with the CPU one kept as the
no-WebGL fallback, which is a bigger change than this ticket wanted.

**Persistence.** JPEG → **WebP at 0.85** (PNG is the automatic fallback on
browsers that can't encode WebP; both keep alpha). The raster is mostly
transparent so it compresses hard — measured whole-session `localStorage`
payloads of **33KB desktop / 42KB phone**, against a ~5MB quota. `PERSIST_CAP_PX`
did not need to move.

**A real bug the review caught: the session key had to bump to `v2`.** espy is
live, so users hold a `espy:doodle:v1` raster that is an OPAQUE jpeg of ink
already composited over the old flat paper. Blitted over the new sheet it would
paint a dead flat rectangle with no texture. `session.ts` now reads
`espy:doodle:v2`; a v1 session simply doesn't load and the field regenerates,
which is the documented fallback. Pinned by a test.

Also caught and fixed: `capacitor.config.ts` hard-coded the old room colour
`#f7efdc` for the native status bar and splash — now `#f0efec`.

**Two deliberate divergences from the study, both now documented in `paper.ts`:**

- **The dither is sheet-space, not screen-space.** The study uses
  `gl_FragCoord`; our sheet is generated in CSS px and upscaled, so the dither
  gets smoothed. Harmless here because the tint has no gradient across the sheet
  to band in the first place (study §5: "optically flat"). True screen-space
  dither needs a second device-resolution pass, which is the cost the whole
  CSS-resolution decision exists to avoid.
- **The tint is brighter than the study's `[0.93, 0.905, 0.845]`.** Ours holds
  the same R−G : G−B ratio (≈1:2.4) but stays as warm as espy's existing
  palette, rather than dropping to the study's cooler rag.

**One review finding tried and rejected.** Three of the five octaves fall below
one pixel (the fine field especially), which is formally aliasing. Cutting the
octave loop off at Nyquist was implemented and rendered side by side: it makes
the sheet visibly chunkier and loses the finest dust of the tooth. The sub-pixel
octaves are a *stable* per-pixel hash (fixed seed — nothing shimmers) and the
dpr upscale low-passes them anyway, so the objection doesn't bite in practice.
Reverted, with the reasoning left in the `fbm` comment so it isn't re-litigated.

**Judgement call, easy to revert.** The card's **2px dashed border is gone** — a
sheet of paper has a cut edge, not a stitched one, and the dashed rule was
fighting the whole point of the ticket. It's replaced by the two-part shadow
(1px hairline + wide soft). The room (`--espy-paper` → `--espy-room`) went from
warm beige `#f7efdc` to near-neutral `#f0efec`, and `--espy-card` now matches the
generated paper's flat average (`#faf6ec`, exported as `PAPER_FLAT` and pinned by
a test so the two can't drift). If the dashed border is wanted back, that's one
line in `DoodlePage.module.scss`.

**Screenshots** — `.scratch/espy-watercolour/shots/` (local only; that path is gitignored):

| | |
|---|---|
| `desktop.png` | 1280×860 @2x |
| `desktop-grain.png` | 150×110 crop of bare paper — fibre and relief at 1:1 |
| `phone.png` | 390×780 @3x |
| `letterbox.png` | 1280×500 → 560×900, aspect changed: paper covers the margins |
| `nogl.png` | WebGL2 forced off: paper under the plain-blot fallback |
