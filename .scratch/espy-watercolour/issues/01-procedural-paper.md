# 01 — Procedural paper for the doodle canvas

**Type:** task
**Status:** ready-for-agent

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

- [ ] The canvas shows visible paper texture: tooth, fine grain, and directional
      fibre streaks. The fibre anisotropy is apparent on inspection.
- [ ] Grain reads as a lit surface, not as flat speckle.
- [ ] No banding in flat paper areas.
- [ ] Paper covers the full canvas, including letterbox margins after a resize
      that changes the aspect.
- [ ] Paper is present when WebGL is unavailable (the plain-blot fallback path).
- [ ] The canvas card reads as a sheet on a desk.
- [ ] Restored sessions still show their baked field correctly, and the
      persisted raster still fits comfortably in `localStorage`.
- [ ] Same sheet every load (fixed seed).
- [ ] No new tunable knobs; `fluid.tuning.ts` has not grown.
- [ ] `pnpm lint`, `pnpm typecheck`, and espy's tests green (`pnpm --filter espy run test` —
      `turbo --filter` has a known cyclic-dep problem in this repo).
- [ ] Screenshot in the ticket comments, phone width and desktop width.

## Comments

_(none yet)_
