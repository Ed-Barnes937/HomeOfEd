# 08 — Postcard export

**Type:** research
**Status:** resolved
**Blocked by:** 01

## Question

The postcard (design: `2d Postcard` — cream card, rotated, planet photo,
"GREETINGS FROM <NAME>", Blip stamp, telemetry strip) exports as
`[ SAVE PICTURE ]` / `[ PRINT ]`. Research the mechanics:

1. Capturing a frame from the WebGL canvas: `preserveDrawingBuffer` trade-offs
   vs an on-demand re-render into a capture, `toBlob`/`toDataURL` limits.
2. Compositing the card: 2D canvas composite (planet frame + text + stamp
   drawn in) vs DOM-to-image approaches — which is reliable cross-browser
   without new heavyweight deps?
3. Saving: anchor-download vs Web Share API (nice on tablets); printing via
   `window.print` + print CSS on a dedicated element.
4. Any interaction with the chosen rendering stack (ticket 01) that changes
   the answer.

## Answer

**Recommendation: no `preserveDrawingBuffer`. On export, do a one-off
`renderer.render()` and synchronously `drawImage` the renderer's canvas into an
offscreen 2D canvas, composite the whole card there in plain Canvas 2D (after
`document.fonts.load` for IBM Plex Mono), then `canvas.toBlob('image/png')`.
Save via `<a download>` from a blob URL, upgraded to `navigator.share({files})`
where `navigator.canShare` says yes. Print by putting the same PNG into a
dedicated print element shown only under `@media print`, then `window.print()`.
Zero new dependencies; fits the single persistent renderer from ticket 01.**

### 1. Capturing the planet frame

- By default the browser clears a WebGL canvas's drawing buffer after it is
  composited — capturing later gets a black image. Two fixes: render
  immediately before capture in the same task, or create the context with
  `preserveDrawingBuffer: true`
  ([three.js manual — Tips, "Taking a screenshot"](https://threejs.org/manual/en/tips.html);
  [MDN `getContext` context attributes](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)).
- **Render-on-demand wins.** The export handler calls
  `renderer.render(currentScene, camera)` then reads the canvas synchronously
  (`ctx2d.drawImage(renderer.domElement, …)` or `toBlob`) before yielding.
  This is the pattern the three.js manual itself recommends, and it avoids
  paying `preserveDrawingBuffer`'s costs (extra buffer copy every frame,
  forever) for a button pressed occasionally. It also composes cleanly with
  ticket 01's on-demand render loop — it's just one extra render call.
  `preserveDrawingBuffer: true` additionally isn't airtight: the buffer is
  still cleared on canvas resize ([three.js Tips](https://threejs.org/manual/en/tips.html)).
- Prefer `drawImage(renderer.domElement, …)` into the compositing canvas over
  `toDataURL` on the WebGL canvas: it's synchronous, skips a base64
  round-trip, and we need the pixels in a 2D canvas anyway. `toBlob` is used
  once, on the finished composite; it's async but snapshots at call time, PNG
  is guaranteed supported, and it's Baseline everywhere
  ([MDN `toBlob`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)).
- Size limits: no spec limit on `toBlob`, but the canvas itself must stay
  under per-platform dimension caps — iOS caps canvases at 4096×4096; exceeding
  the cap makes the canvas silently unusable
  ([MDN `<canvas>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas)).
  For a crisper export, render the planet one-off at 2× into the capture
  (temporary `renderer.setSize`, render, capture, restore) and keep the
  composite ≤ 4096px on the long edge.
- Tainting: orbi's textures are procedural (`CanvasTexture`) / same-origin, so
  the canvas stays origin-clean and `toBlob` won't throw `SecurityError`
  ([MDN `toBlob`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)).

### 2. Compositing the card — 2D canvas, not DOM-to-image

- **2D canvas composite.** Everything on the card is canvas-trivial: cream
  `#f0ead8` fill, `ctx.rotate(-1.5°)` if we bake the tilt into the image,
  `drawImage` for the planet photo, `fillText` in IBM Plex Mono for
  "GREETINGS FROM …" and the telemetry strip, `setLineDash` + `strokeRect`
  for the stamp border, and Blip drawn with the same path/primitive code the
  app already has. Deterministic, testable, zero deps.
- Fonts: wait on `document.fonts.load('16px "IBM Plex Mono"')` (Baseline
  since 2020) before `fillText`, or the first export falls back to a default
  font ([MDN `FontFaceSet.load`](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/load)).
  The woff2 is self-hosted, so no cross-origin wrinkles.
- **DOM-to-image rejected.** The only native route is serialising HTML into an
  SVG `<foreignObject>` blob and drawing that image into the canvas; it
  requires fully self-contained markup — external resources (our woff2
  included) don't load unless inlined as data URIs
  ([MDN — Drawing DOM objects into a canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Drawing_DOM_objects_into_a_canvas)).
  html2canvas / dom-to-image are userland re-implementations of browser
  rendering on top of the same trick — heavyweight new deps with known
  cross-browser font/layout gaps, for a card we can draw in ~100 lines.
- The on-screen postcard stays ordinary DOM/CSS (rotated card, `<img>` of the
  capture); the 2D-canvas composite is only for the exported/printed PNG.

### 3. Saving

- **Baseline path: `<a download="orbi-postcard-<name>.png">` on a
  `URL.createObjectURL(blob)`.** `download` works for `blob:` URLs and the
  attribute value controls the suggested filename
  ([MDN `<a>` download](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a)).
  Revoke the object URL afterwards.
- **Upgrade: Web Share API with files.** Where
  `navigator.canShare({ files: [file] })` is true, offer/use
  `navigator.share({ files: [pngFile], title })` — it opens the native share
  sheet, which is the right feel on iPads. Requires HTTPS + a user gesture
  (the button press qualifies). Support is *not* Baseline — Chrome/Edge and
  Safari (macOS/iOS since Safari 15) support file sharing; desktop Firefox
  does not — so it must be feature-detected with the anchor download as the
  always-present fallback
  ([MDN `navigator.share`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share);
  [WebKit — New WebKit Features in Safari 15](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/)).
  Note: shared files carry no filename guarantee; filename control is the
  anchor path's job.

### 4. Printing

- Print the **generated PNG**, not the live DOM/WebGL: WebGL canvases are
  exactly the thing that goes black in print flows (same cleared-buffer
  problem as capture), and the PNG is already the exact artefact.
- Mechanism: a dedicated `#postcard-print` element containing an `<img>` of
  the blob URL, hidden on screen and shown alone under `@media print` (hide
  the app shell with print CSS); set `@page` margins; wait for the image's
  `load` event, then call `window.print()`. Print stylesheets + `@page` +
  `window.print()` is MDN's recommended approach
  ([MDN — CSS media queries: Printing](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Printing)).
  A hidden-iframe variant exists for isolating print content, but a
  print-only element in the SPA is simpler and sufficient.

### 5. Interaction with the ticket-01 stack

Nothing in ticket 01 needs to change. The single persistent `WebGLRenderer` is
created **without** `preserveDrawingBuffer`; export is: ensure fonts loaded →
one-off `renderer.render()` of whichever scene is active (orbit or surface) →
synchronous `drawImage` into the offscreen composite canvas → draw card
chrome → `toBlob` → save/share/print as above. The one-off 2× capture render
must restore `renderer.setSize`/pixel ratio before returning control to the
normal loop.
