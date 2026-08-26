# 01 — WebGL renderer

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)

Replace the Canvas 2D frame path (CPU rasterise loop → `putImageData` → scaled
`drawImage`) with a WebGL2 one: upload the grid as a texture, draw one quad,
map species to colour in the fragment shader. This removes the one unmeasured
GPU-bound row on the frame path and the CPU rasterise loop with it, and it is
the frame path any later 120 Hz work builds on.

`renderer.ts` was written for this swap: "Canvas 2D today; WebGL is a drop-in
later behind the same shape." The seam is `RenderableSim`
(`{ width, height, cells }`) and it does not change.

## Design

- **New `WebGLSimRenderer`** in `features/render/`, same public surface as
  `SimRenderer` (`resize`, `getFit`, `gridToCanvasPoint`, `canvasPointToGrid`,
  `snapshot`, `draw`). `useSimLoop` picks WebGL when a `webgl2` context is
  available and falls back to the existing `SimRenderer` otherwise — the 2D
  renderer stays, it is the fallback, not dead code.
- **Zero repack.** `sim.cells` is interleaved `{ species, ra, rb, clock }`,
  4 bytes per cell — upload it *as is* to a `GRID_WIDTH × GRID_HEIGHT`
  `RGBA8UI` texture (`texSubImage2D` each frame, ~240 KB). The fragment shader
  reads the R channel (species) with `texelFetch` and looks the colour up in a
  256×1 palette texture built from `buildSpeciesPalette`. `rb` (colour variant)
  arrives in the B channel for free — not used in this ticket, but the door to
  per-cell variance shading opens here.
- **Letterbox** stays in `letterboxFit.ts` (pure, already tested): clear the
  full canvas to `WORLD_COLOUR`, then set the viewport to the fit rect scaled
  by DPR. `NEAREST` filtering for the crisp-pixel look
  (`imageSmoothingEnabled = false` equivalent).
- **`snapshot()`** (scene thumbnails) is user-initiated and off the frame path
  — keep the existing CPU rasterise + 2D buffer for it, used only on save. Do
  not `readPixels` on the frame path.
- **Context loss**: handle `webglcontextlost` (preventDefault) /
  `webglcontextrestored` (rebuild textures + program). A lost context must not
  take the sim down — the sim owns the world, the renderer owns nothing.

## Measurement (part of the ticket, not optional)

The audit's blit row is unmeasured. Before the swap, time the current
`putImageData` + `drawImage` path; after, time `texSubImage2D` + draw — same
harness style as `bench/sim.bench.ts` where it can run headless, an in-page
`performance.now()` capture where it can't. Record both in this file under
`## Answer`. If the 2D blit turns out to be ~0 ms on every machine we can
reach, say so — that result trims the spec's expectations for the whole epic.

## Tests

- The `.iwft` suites drive the sim through `TEST_SEAM_KEY` (`speciesAt`,
  `countSpecies`), not canvas pixels — they must pass unchanged on both
  renderers.
- Unit-test what is pure (palette-texture packing, renderer selection). Keep
  the browser surface thin per the repo's test split.
- The fallback path needs one test proving the app still renders when `webgl2`
  is unavailable.

## Constraints

- No sim changes. `RenderableSim` does not widen.
- Palette parity: same registry-derived colours as `buildSpeciesPalette` — the
  rail and the canvas must not drift (spec §9, materials ticket 16).
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green.
