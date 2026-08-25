# 06 — Grid dimensions / world size

Type: grilling
Status: resolved

## Question

What grid dimensions / world size does v1 target, and how does the canvas map
to it (fixed logical grid vs viewport-derived, cell pixel size, resize
behaviour)? Prior art gives no consensus — chunk sizes vary two orders of
magnitude across implementations
([01 — Prior-art research](01-prior-art-research.md)) — so chunk size itself is
a tunable constant, not a spec commitment; but the *logical world size* and its
relationship to the viewport is a product decision the spec must state. Also
constrains the localStorage scene format (bytes per scene).

## Answer

Resolved by grilling session (2026-08-05).

1. **Fixed logical grid**, never viewport-derived. Determinism (seeded PRNG +
   fixed update order only reproduces on an identical grid shape), scene
   portability across devices, and a statable byte budget all require it.
2. **300×200 (3:2 landscape), a build-time constant.** 60,000 cells — ⅔ of
   Sandspiel's proven 60fps single-threaded load, keeping the headroom Bittker
   retrospectively wished he'd kept
   ([prior-art §6.2](../research/prior-art.md)). Landscape suits the
   desktop-first stance. Not user-configurable per scene.
3. **The constant may grow later** (e.g. 600×400) if 300×200 feels small.
   Everything scales sensibly: rendering is dimension-agnostic, storage is
   linear (~240KB type-only at 600×400 → still ~15 uncompressed scenes), and
   the sim-cost growth is exactly what the day-one chunk/dirty-rect
   architecture anticipates. The one rule making the bump safe: **the scene
   format must store grid dimensions in its header** (constraint handed to
   [07 — Scene serialisation format](07-scene-serialisation-format.md)), so
   old scenes stay loadable, centred/anchored as ticket 07 sees fit.
4. **Canvas mapping: scale-to-fit with smoothing off.** Sim renders into a
   300×200 backing buffer (one pixel per cell); the on-screen canvas scales it
   aspect-preserving into the play area, letterboxing the remainder, with
   image smoothing disabled (`image-rendering: pixelated`) for crisp cells.
   Fractional scale factors are fine; no integer-only scaling.
5. **Resize = refit only.** Window resize recomputes the canvas fit; the
   simulation is untouched (no cells added/removed, running sim keeps
   running). The canvas backing store is devicePixelRatio-aware (sized at
   `cssSize × dpr`, re-evaluated on resize/zoom) so cells stay sharp on HiDPI
   displays — entirely on the renderer side of the sim/renderer seam.
6. **localStorage budget: no compression requirement, no scene cap.** At
   300×200, worst case (full 4-byte cell) is 240KB/scene; type-only is ~60KB
   raw / ~80KB base64. Against the ~5MB origin budget that's dozens of scenes
   even lazily encoded. Compression (e.g. RLE — scenes are mostly empty) is an
   optimisation ticket 07 may take, not a requirement.
