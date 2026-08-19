# 01 — 3D rendering approach

**Type:** research
**Status:** resolved
**Blocked by:** —

## Question

Which 3D rendering stack should orbi commit to, and in what integration style?
The design handoff proves the look in vanilla three.js
(`.scratch/orbi/design-handoff/orbi-three.js`: canvas-textured sphere,
night-side emissive city lights via `onBeforeCompile`, fresnel atmosphere,
displaced-plane surface with blob meshes, hand-rolled drag-to-rotate). Ed has
never done 3D — the answer must justify itself to a 3D newcomer.

Resolve:

1. **Library**: three.js vs alternatives (Babylon.js, PlayCanvas, regl/raw
   WebGL, or a 2.5D canvas fake). Weigh: bundle size, docs/ecosystem for
   agent-written code, fit with the proven techniques.
2. **Integration style**: vanilla three.js driven from a DOM-free engine +
   renderer seam (the silt house pattern, `apps/silt/README.md`) vs
   react-three-fiber. Consider testability (the repo tests engines headlessly
   and asserts via canvas test seams, not pixels).
3. **Tablet/mobile constraints** for the responsive aspiration: iPad Safari
   WebGL2 support, `touch-action` vs drag-to-rotate, DPR capping, thermal
   throttling — what desktop-first decisions would foreclose tablet later?
4. **WebGL context lifecycle**: two views (orbit + surface) — one persistent
   canvas/scene swapped, or scene-per-view? Context-loss handling.

## Answer

**Recommendation: vanilla three.js (npm `three`, ESM), driven from a DOM-free
engine behind a renderer seam (the silt house pattern). No react-three-fiber.
One persistent `WebGLRenderer` + canvas for the whole app; orbit and surface
are two scenes swapped at render time. Cap DPR at 2, set `touch-action: none`
on the canvas, and register context-loss handlers from day one.**

### 1. Library: three.js

- **The look is already proven in three.js.** Every technique the design
  depends on — `onBeforeCompile` emissive gating (an official, documented
  `Material` API: [threejs.org/docs Material.onBeforeCompile](https://threejs.org/docs/#api/en/materials/Material.onBeforeCompile)),
  back-side fresnel `ShaderMaterial`, `CanvasTexture` planet maps — is
  three.js-idiomatic. Porting to another library means re-proving the design,
  for zero gain.
- **Bundle size**: full `three` is ~168 kB min+gzip and tree-shakeable ESM, so
  a scene using a subset ships less
  ([bundlephobia.com/package/three](https://bundlephobia.com/package/three)).
  Babylon.js is larger — a minimal rendering-only scene imports ~300 kB
  pre-gzip even via the modular `@babylonjs/core` packages
  ([Babylon forum: bundle size](https://forum.babylonjs.com/t/babylon-bundle-size/48068)).
- **Ecosystem for agent-written code**: three.js has by far the largest corpus
  of examples, docs, and Q&A of any web-3D library — the safest bet for a 3D
  newcomer reviewing agent-written code, because almost any pattern can be
  cross-checked against official examples.
- **Alternatives rejected**:
  - *Babylon.js* — a full game engine (physics, GUI, XR); heavier, and its
    strengths (inspector, scene formats) don't help a hand-shaded planet.
  - *PlayCanvas* — engine is MIT/npm/tree-shakeable
    ([playcanvas.com/products/engine](https://playcanvas.com/products/engine)),
    but the ecosystem is editor-centric; the code-only community and example
    corpus are much thinner than three.js.
  - *regl / raw WebGL* — orbi needs a scene graph (planet + moon + comet +
    atmosphere shell + surface props), sRGB/lighting management, and geometry
    helpers; hand-rolling those is weeks of work three.js gives for free.
  - *2.5D canvas fake* — forecloses the proven night-side terminator sweep,
    fresnel atmosphere, and drag-to-rotate-in-3D that make the design work.
    The planet **is** the product; faking it is a different (worse) product.
- Pin a release and upgrade deliberately: three.js versions monthly
  (`r183` current) with occasional breaking changes per release
  ([github.com/mrdoob/three.js/releases](https://github.com/mrdoob/three.js/releases)).
  `onBeforeCompile` string-replaces shader chunks, so an upgrade can silently
  break the night-lights gate — pin, and cover the gate with a test. Use
  `WebGLRenderer`, not the newer `WebGPURenderer`/TSL path — the WebGL
  renderer is the mature one and the techniques are written against it
  ([threejs.org/docs WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html)).

### 2. Integration style: silt house pattern, not react-three-fiber

- **Testability is the deciding factor.** The three.js scene graph
  (`Object3D`, `Vector3`, materials, the planet-map canvas logic) is plain
  JavaScript — constructible and assertable in Vitest/Node without a WebGL
  context. Keep the sim engine (chapters, recipes, telemetry, time rate)
  DOM-free and three-free; keep scene construction in a module that takes the
  sim state and returns/updates a scene; keep the `WebGLRenderer` behind a
  narrow seam (exactly silt's `Sim → Renderer` split, `apps/silt/README.md`).
  Unit tests then assert "chapter 5 ⇒ emissive intensity > 0, rocket mesh
  present" headlessly; `.iwft` tests assert via the seam, not pixels.
- **r3f solves a problem orbi doesn't have.** r3f's value is declarative
  scene-graph-as-JSX with React state driving it. orbi is the opposite shape:
  an imperative fixed-timestep sim mutating a mostly-static scene every frame.
  In r3f that work happens in `useFrame` escape hatches anyway — imperative
  code inside a declarative wrapper
  ([r3f docs: useFrame runs outside React render](https://r3f.docs.pmnd.rs/advanced/scaling-performance)).
  Per-frame overhead is fine (useFrame doesn't re-render React), but the
  wrapper adds a dependency (`@react-three/fiber` tracks React versions and
  had breaking type churn in v9 —
  [pmndrs/react-three-fiber#3520](https://github.com/pmndrs/react-three-fiber/issues/3520)),
  and its headless story (`@react-three/test-renderer`) is explicitly
  experimental ([npmjs.com/package/@react-three/test-renderer](https://www.npmjs.com/package/@react-three/test-renderer)).
  Vanilla three behind a seam is testable with nothing extra.
- React still owns everything outside the canvas (shelf, builder panels,
  Mission Control, toolkit buttons) — UI state flows into the engine through
  its API, mirroring silt's `HomePage → useSimLoop → Sim/Renderer` hooks.

### 3. Tablet constraints (desktop-first, don't foreclose)

- **WebGL2 on iPad is safe**: Safari 15+ (Sept 2021) ships WebGL2 on
  macOS/iOS/iPadOS via ANGLE-on-Metal; all major browsers support it
  ([khronos.org blog](https://www.khronos.org/blog/webgl-2-achieves-pervasive-support-from-all-major-web-browsers)).
  No need to target WebGL1.
- **Touch**: `touch-action: none` on the canvas is the required way to claim
  drag gestures — `preventDefault()` on pointer events deliberately does *not*
  stop browser panning/zooming per the Pointer Events spec
  ([MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)).
  The handoff's hand-rolled pointer-event drag works unchanged on touch once
  that CSS is set — so write pointer events (not mouse events) from day one.
- **DPR**: cap at `Math.min(devicePixelRatio, 2)` (already in the handoff
  sketch). 3× retina costs ~2.25× the fragments of 2× for no visible gain;
  standard three.js guidance
  ([Codrops three.js performance](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)).
  Keep the cap a constant behind the renderer seam so tablet can later drop to
  1.5 without touching scene code.
- **Thermal / memory**: iOS Safari throttles and *loses WebGL contexts* under
  GPU-memory pressure and on backgrounding
  ([WebKit bug 261331](https://bugs.webkit.org/show_bug.cgi?id=261331),
  [Apple dev forums iOS 18 crashes](https://developer.apple.com/forums/thread/778735)),
  and leaks memory when an on-screen WebGL canvas is repeatedly resized
  ([Apple dev forums](https://developer.apple.com/forums/thread/668999)).
  Desktop-first decisions that keep tablet open: modest texture sizes (the
  1024×512 canvas planet map is fine), one canvas (see §4), debounced resize,
  pause the RAF loop on `visibilitychange`.
- orbi's scenes are tiny (one sphere, a plane, tens of low-poly props) —
  nothing here is near tablet limits if the above hygiene is kept.

### 4. Context lifecycle: one renderer, two scenes

- **One persistent canvas + `WebGLRenderer` for the app's lifetime; orbit and
  surface are two `Scene`+`Camera` pairs and view-swap = changing which pair
  `renderer.render()` gets.** Scenes are cheap CPU objects; the expensive,
  loss-prone resource is the GL context.
- Canvas-per-view is the wrong shape: Safari hard-caps live WebGL contexts per
  page and silently kills the oldest ("There are too many active WebGL
  contexts… the oldest context will be lost" —
  [pmndrs discussion #2457](https://github.com/pmndrs/react-three-fiber/discussions/2457)),
  and each context re-pays shader compilation. The builder's live preview and
  the orbit view are the same planet — same scene, different camera, zero
  extra cost.
- **Context loss handling** (day one, not retrofit): on `webglcontextlost`
  call `event.preventDefault()` (signals intent to restore), on
  `webglcontextrestored` rebuild GPU resources — three.js re-uploads
  geometry/textures automatically, but the render loop must survive the gap
  ([MDN WEBGL_lose_context](https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_lose_context),
  [three.js #5507](https://github.com/mrdoob/three.js/issues/5507)).
  Because sim state lives in the DOM-free engine, restoration is "rebuild the
  scene from state" — the seam makes this nearly free, and
  `WEBGL_lose_context.loseContext()` makes it testable.
- Dispose discipline: when a scene is torn down (e.g. leaving a planet for the
  shelf), dispose geometries/materials/textures explicitly — three.js does not
  garbage-collect GPU resources. (Silt learned the equivalent lesson: the
  engine must not dispose its driver.)
