# 06 — Renderer: a packed 32-bit palette, and stop redrawing an unchanged world

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)

Two independent wins in `apps/silt/src/features/render/`.

## 1. Four stores per pixel become one

`SimRenderer.draw` walks all 60,000 cells and writes four `Uint8ClampedArray`
slots each, with an `?? 0` guard on every one:

```ts
pixels[p]     = palette[c] ?? 0
pixels[p + 1] = palette[c + 1] ?? 0
pixels[p + 2] = palette[c + 2] ?? 0
pixels[p + 3] = 255
```

`Uint8ClampedArray` stores are clamped on write, and the `??` guards are dead —
`palette` is a fixed 768-byte table and `c` is always in range.

**What to change:** have `buildSpeciesPalette` (in `speciesPalette.ts`) also
produce a `Uint32Array(256)` of packed pixels, take a `Uint32Array` view over
`this.imageData.data.buffer`, and write one word per cell.

**Endianness.** A packed `0xAABBGGRR` word is correct on little-endian and
wrong on big-endian. Every browser silt runs in is little-endian, but write the
packing so it is *detected*, not assumed — build the word once through a
`DataView` probe or a one-off `Uint8Array`/`Uint32Array` overlay check at
palette-build time, and pack accordingly. It costs nothing at boot and it means
the code is not quietly lying.

Measured in isolation, 300×200, 2000 frames: **0.0957 ms → 0.0301 ms per
frame**. Small on a fast Mac, roughly 0.4 ms → 0.12 ms on the reference
machine, and it is free.

Keep `SpeciesPalette` usable by anything that still wants bytes, or replace it
outright — it has one other caller path (the rail reads colours off the
registry, not off this table), so check with a search before deciding.

## 2. A static world is rasterised sixty times a second

`useSimLoop`'s `frame()` calls `renderer.draw(sim)` on **every** rAF, whether or
not anything changed. While the sim is paused — which is the *default state*,
and the whole of setup mode — that is a full 60k-cell rasterise, a
`putImageData` and a scaled `drawImage` per frame, drawing a world identical to
the last one.

**What to change:** give `Sim` a monotonically increasing `revision` that bumps
on anything which changes the world — `tick`, `paint`, `clear`, `restore` — and
have the loop skip `draw` when the revision is unchanged **and** the fit is
unchanged.

The fit part matters: a resize or a DPR change replaces the canvas backing
store, which clears it, so a refit must force the next frame to draw even
though the world did not move. `SimRenderer.resize` should mark itself dirty.

**Watch out for:**

- **The FPS readout.** `onFps` counts rAF callbacks. If frames stop drawing,
  the number it reports stops meaning "how fast is silt drawing" — a paused
  silt would still read 60. Decide what the status bar should say and make it
  honest: either keep counting frames (and accept it means "rAF rate"), or
  count *drawn* frames and let a paused world read 0. Say which you chose and
  why in the PR. Do not leave it ambiguous.
- **`snapshot()` reads the buffer the last `draw` filled.** If a scene is saved
  after paints that were never drawn, the thumbnail is stale. Either force a
  draw before snapshotting or make `snapshot` rasterise on demand. There is an
  `.iwft` scene test that will catch this if you get it wrong — check it does.
- The `.iwft` tests drive the canvas and read the test seam. Frame-skipping can
  change the timing they see; run the Playwright CT suite, not just Vitest.

**Expected:** part 1 is a straight 3× on the rasterise loop. Part 2 takes the
paused-state render cost to nearly zero, which is where a user spends the whole
of setup.

- [ ] One 32-bit store per pixel; endianness detected, not assumed
- [ ] No redraw when neither the world nor the fit changed
- [ ] A resize or DPR change forces a redraw
- [ ] The FPS readout still means something, and the PR says what
- [ ] Scene thumbnails are not stale
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green (Vitest **and** Playwright CT)
