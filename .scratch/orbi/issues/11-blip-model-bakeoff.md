# 11 — Blip model bake-off

**Type:** prototype
**Status:** open
**Blocked by:** 01, 09

## Question

Graduated from the fog by ticket 09's research. One throwaway session, two
routes to a Blip model (boxy body, cyan screen-face eyes, riveted solar-panel
wings, one antenna — design handoff README), judged side by side against the
Flight Console mock, co-designer picks:

1. **Procedural**: compose Blip from three.js primitives in a Group (the
   `makeBlob`/`makePlant` pattern from `design-handoff/orbi-three.js`,
   ~10–20 primitives).
2. **Blender MCP**: Ed installs ahujasid/blender-mcp; agent models the same
   robot (optionally starting from a CC0 Quaternius robot), exports GLB,
   loaded in a minimal `GLTFLoader` viewer.

Run via `/prototype`. The verdict decides the asset pipeline for all
characterful props (Blip, rocket): if procedural passes — likely, given the
"deliberately rough" brief — orbi ships with **zero binary assets** and the
Blender route is dropped; if not, route 2 becomes the authoring workflow per
ticket 09's answer (self-hosted GLB in `public/`, meshopt optional at this
scale).

## Answer
