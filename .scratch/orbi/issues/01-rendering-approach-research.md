# 01 — 3D rendering approach

**Type:** research
**Status:** claimed
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
