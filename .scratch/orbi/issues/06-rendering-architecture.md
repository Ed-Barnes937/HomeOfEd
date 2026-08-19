# 06 — Rendering architecture

**Type:** grilling
**Status:** open
**Blocked by:** 01, 02

## Question

Given the rendering stack (ticket 01) and the sim model (ticket 02), design
the seams:

1. **Engine / renderer / React split**: the sim engine is DOM-free and
   unit-tested (silt pattern); the 3D renderer consumes sim state behind a
   narrow interface; one React hook owns the frame loop and pointer input.
   What exactly crosses the sim→renderer interface each frame?
2. **Two views**: orbit (whole planet, drag-to-rotate, toolkit, Mission
   Control panel) and surface (horizon, blobs, life decorations, collapsed
   Blip). Shared canvas/context or per-view scenes? Transition between them.
3. **Test seam**: what does the canvas expose for `.iwft` tests (silt's
   `TEST_SEAM_KEY` pattern) — e.g. current chapter rendered, blob count,
   night-side lights on — so Playwright asserts state, not pixels?
4. **Chrome vs canvas boundary**: which Flight Console UI is DOM (panels,
   sliders, bracketed buttons — likely all of it) vs in-canvas (planet,
   crosshair ticks, orbit ring)?

Run with `/grilling` + `/codebase-design`. This ticket's answer is the shape
of `apps/orbi/src/` and probably warrants an ADR.

## Answer
