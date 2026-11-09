# 03 - Material zones: metal, paint and bone

**Status:** ready-for-human
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

**2026-11-09, agent (built):** Built on branch `armoury-variety-03-material-zones`
(chained on 01's branch); decisions in ADR 0082. Needs Ed's eye on a real GPU,
including a few Try another rolls, before merging.

- New "Decorations" group (between Shaft and Core, phone tab "Decor"): Handle
  made of (Wood, Metal, Painted, Bone), Shaft made of (Wood, Painted, Bone),
  Paint (six curated swatches), End cap, Ring made of, Metal bands (None to
  Three), Spiral made of (only on a raised spiral) and Metal (Silver, Brass,
  Gold, Dark iron). Paint and Metal only show once something uses them; End cap
  hides on a metal handle.
- Zones are z ranges in the spec; the mesh carries (metal, paint, bone) weights
  per vertex and the wood shader mixes the finishes over the wood.
- Bone is a zone material (handle and/or shaft), not a whole-wand switch; a wand
  that is bone end to end is called bone on its tag and shelf label. Bone takes a
  stain's darkness but not its hue (a dye on bone looked wrong).
- Bands sit in the gaps between bumps when there are bumps; carving and raised
  spirals stop at bands.
- The metal raised spiral fell out cleanly: a raised groove set can be `metal`
  and `radiusAt` reports the ridge's metal weight per vertex.
- Bloom: metal highlight streaks bloomed in the box. The wand's surface is now
  capped just under the bloom threshold, so only the core's glow, sparkles and
  spell bloom. Share picture (no bloom) and shelf (no 3D) checked.
- Try another: about 58% plain wood, about 26% with some metal (usually one
  part), about 11% paint, 10% bone.
- New preset "Silversmith" (silver handle, ring and raised spiral on walnut).

GPU shots (headless Chromium, ANGLE Metal, Apple M3 Pro) in `shots/03/`: `r2/`
is the final round (box, close look, spell flash at 2.6 s, share picture, shelf,
panel, eight rolls); `r3/` is a plum-stained bone wand after the bone fix; `r1/`
is before the bloom fix.

Not done / for later:
- The derived name still uses the stain or wood word ("The Plum Spiral" for a
  bone wand), and the wood lore line shows on a bone wand.
- Ed to judge bone's look (it reads as pale aged bone, not very translucent).

**2026-11-09, agent (review round 1 follow-ups):**
- Three bands between two bumps no longer lose one to float rounding (bands are
  picked by gap index, not filtered by position); regression test at 28 cm.
- A metal handle always has a metal ring, and "Ring made of" hides there like
  "End cap".
- The group is titled "The trimmings" (phone tab "Trim"); the code key stays `decor`.
- A wand that is bone end to end is named and told as bone ("The Bone Spiral",
  "Bone is old and quiet and remembers everything."); partly bone wands keep the
  wood wording.
- ADR 0082 corrected: the share picture is capped too (same shader, no bloom).
  No glint for now.
- Shots in `shots/03/r4/`: an all-bone wand's tag, a metal handle with its ring,
  and the trimmings panel.

