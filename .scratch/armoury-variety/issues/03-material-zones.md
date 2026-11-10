# 03 - Material zones: metal, paint and bone

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
Blocked by: 01 (sequencing only: both edit the same files)

Today the whole wand is one wood with a stain gradient
(`apps/armoury/src/stage/WandMesh.tsx`, `addStain`). Give parts of the wand
other materials.

## What to build

- **Zones along the wand**: the compiled spec gains a list of material zones
  over z ranges, written per vertex like `aStain` and mixed in the shader.
  Materials:
  - **Metal**: silver, brass, gold, dark iron. PBR metalness and roughness,
    lit by the existing HDRI.
  - **Paint or lacquer**: an opaque coloured finish that hides the grain
    (benchmark: Neville's orange shaft, c5).
  - **Bone**: pale, slightly translucent-looking, low grain (benchmark:
    Voldemort). Can be a material choice for the whole wand rather than a zone.
- **What a kid picks** (in a new "Decorations" group, see the spec):
  - Metal end cap at the pommel (benchmarks: Narcissa, c13's dark cap).
  - Metal collar: the collar's beads in metal instead of wood (c2's gold bands).
  - Metal bands: a few thin bands up the shaft.
  - Handle finish: wood, metal, paint (benchmarks: Horace's and Narcissa's
    silver handles).
  - Shaft finish: wood (with the existing stain), paint.
- **Raised spirals in metal**: if 01's raised spiral can take a material, a
  silver ribbon wound up the shaft (c6, c7) needs zones in angle as well as z.
  Do it if it falls out cleanly; otherwise note it in Comments for later.
- Metal zones don't take stain; stain still fades along the wood around them.
- Coupling so every combination looks good: e.g. a metal handle pairs its cap
  and collar metal; paint colours are a curated palette, not a free picker.

## Watch for

- The R3F uniform rule in apps/armoury/CLAUDE.md: changing uniforms go through
  the material, not props.
- Bloom: shiny metal under the spell flash and sparkles may bloom too much.
- The share picture and the shelf render through the same stage; check both.

## Done when

- Unit tests cover zone compilation (z ranges, defaults, coupling); iwft
  covers the Decorations group.
- At least one metal-heavy preset with an original name.
- Ed has looked at metal, paint and bone on a real GPU.
- Verify loop green. ADR for the material model (zones, which materials,
  what stain does to them).

## Comments
