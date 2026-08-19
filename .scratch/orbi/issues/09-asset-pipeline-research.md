# 09 — Asset creation pipeline

**Type:** research
**Status:** claimed
**Blocked by:** —

## Question

How should orbi's 3D artwork (planet surfaces, blobs, plants, Blip the
robot-satellite, comets, rockets) be made? Ed's idea: HITL-generate 2D mocks,
then have Claude build 3D models from them via a **Blender MCP**, exporting
for the web — versus building everything procedurally in code (the design
handoff's three.js sketches are fully procedural: canvas textures +
primitive-composed blobs/plants). Research:

1. **Blender MCP workflow**: what exists (e.g. ahujasid/blender-mcp), how
   reliable is agent-driven modelling, glTF/GLB export size and loading,
   and whether stylised low-poly models would beat procedural primitives for
   the "realistic-but-a-bit-cartoony, touchable" brief.
2. **Procedural-in-code**: what the proven sketches already achieve
   (`.scratch/orbi/design-handoff/orbi-three.js`), where procedural runs out
   of road (Blip's character model? the rocket?).
3. **Hybrid**: procedural planets/terrain + a few authored GLB models for
   characters/props. Asset budget: file sizes, no-external-CDN constraint
   (self-hosted under `public/`).
4. A recommendation, plus what a cheap HITL prototype to validate it would
   look like (this graduates from the map's fog if warranted).

## Answer
