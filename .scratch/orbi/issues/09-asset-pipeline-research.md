# 09 — Asset creation pipeline

**Type:** research
**Status:** resolved
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

**Recommendation: procedural-first, with a hybrid escape hatch.** Build
planets, terrain, atmosphere, comets, plants and blobs procedurally — the
design handoff already proves all of them in ~220 lines
(`design-handoff/orbi-three.js`). Reserve authored GLB models only for the
two genuinely characterful props: **Blip** and the **rocket** — and
even those should first be attempted procedurally, because Blip's design
("boxy body, screen face, riveted solar-panel wings, one antenna") is
box+plane+cylinder territory, exactly what primitives do well. The Blender
MCP is viable as the authoring tool *if* procedural attempts fall flat, and a
cheap HITL prototype (below) settles that in an afternoon. Do **not** build a
Blender pipeline speculatively.

### 1. Blender MCP — what exists and how reliable it is

[ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) is the
de-facto standard (26k+ stars, actively maintained). It gives the agent scene
inspection, object/material creation, and — crucially — an
`execute_blender_code` tool that runs arbitrary Python in Blender, so
anything Blender can do (including native glTF/GLB export via
[io_scene_gltf2](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html))
is scriptable. It also integrates Poly Haven / Sketchfab asset download and
Hyper3D AI generation.

Reliability caveats from the project's own README and issue tracker: complex
operations must be broken into small steps; behaviour is "sometimes erratic";
first commands sometimes fail; threading/timer race conditions exist
([error-handling notes](https://deepwiki.com/ahujasid/blender-mcp/6.2-error-handling-and-troubleshooting)).
Agent-driven modelling from a 2D mock works best for **primitive-composed,
hard-surface, stylised** objects — which is precisely what Blip and a
cartoon rocket are — and degrades for organic sculpting. So the workflow Ed
imagined (2D mock → agent models it in Blender → GLB) is plausible for these
two props, but it is a HITL iterate-and-eyeball loop, not a batch pipeline.

### 2. Procedural-in-code — how far the proven sketches go

`orbi-three.js` already delivers, fully procedurally: seeded canvas-texture
planets with night-side city lights (emissive map gated via
`onBeforeCompile`), fresnel atmosphere, comet + impact flash, displaced
ground plane, hopping two-eyed blobs, and three-stage growing plants — all
from spheres, cones and cylinders. This *is* the chosen look: the handoff
calls these "proof-of-technique" and the Flight Console direction wants
"deliberately rough geometry, correct mood".

Where primitives run out of road: **articulation and silhouette character**.
A Blip that emotes (eye states on a screen face), or a rocket with fins,
window and exhaust bell, is buildable from ~10–20 primitives in a Group —
the same technique as `makeBlob`/`makePlant`, just more of it. The real
limit is if the co-designer wants smooth sculpted forms or bevelled/rounded
hard-surface detail; that's when authored geometry wins.

### 3. Hybrid + asset budget

If GLBs are used: load via three.js `GLTFLoader` from the app's `public/`
(self-hosted — satisfies the no-runtime-CDN rule; note the sketch's
`cdn.jsdelivr.net` three.js import must become a normal npm dependency in
the real app regardless). Compression options, both self-hostable:

- **meshopt** ([zeux/meshoptimizer](https://github.com/zeux/meshoptimizer)
  / `gltfpack`): 2–4× on vertex data, ~1 byte/triangle indices; decoder is a
  single small JS file bundled from npm. Preferred here.
- **Draco**: better raw ratios but needs a ~300 KB wasm decoder copied into
  `public/` and it disturbs vertex order.

Budget maths: a stylised low-poly prop is typically 1k–5k triangles; with
vertex-colour or single small texture that is **20–150 KB per GLB
uncompressed, ~10–50 KB with meshopt**. Two props ≈ under 100 KB total —
negligible against the three.js bundle itself (~600 KB min). Compression is
honestly optional at this scale; plain GLB in `public/` is fine.

### 4. CC0 libraries as a base

[Quaternius](https://poly.pizza/u/Quaternius) (1,400+ CC0 models, incl. an
[Ultimate Space Kit](https://poly.pizza/bundle/Ultimate-Space-Kit-YWh743lqGX)
with rockets, and [animated robots](https://poly.pizza/m/QCm7qe9uNJ)),
Kenney's Space Kit, and [poly.pizza](https://poly.pizza) generally are CC0 —
free to restyle and self-host with no attribution. The fastest hybrid route
is: pull a CC0 robot/rocket, recolour/retopo it in a Blender MCP session to
match Blip's design, export GLB. Cheaper than modelling from scratch and
still fully agent-drivable.

### Cheapest HITL validation prototype (warranted)

One session, throwaway: take the design handoff's Blip description (or a
2D mock frame from `orbi directions.dc.html`), then run **both** routes
side by side:

1. **Procedural**: agent composes Blip from three.js primitives (the
   `makeBlob` pattern) — ~1 hour.
2. **Blender MCP**: Ed installs the addon, agent models the same robot
   (optionally starting from a CC0 Quaternius robot), exports GLB, loads it
   in a minimal `GLTFLoader` viewer page — ~1 session.

Put both next to the Flight Console mock and let the co-designer pick. If
the procedural one passes (likely, given the "deliberately rough" brief),
the Blender pipeline is dropped entirely and orbi ships with **zero binary
assets** — matching the handoff's "No external assets" line.
