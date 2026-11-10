# 04 - Gems that glow in the core's colour

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
Blocked by: 03 (gems sit in metal settings)

Today the core only shows as the spell colour when the wand casts. Gems make it
visible: they take the core's colour and light up when the wand casts.

## What to build

- **Set gems**: small cut stones set into the surface. Placement patterns:
  a ring of stones on the handle, a line up the shaft, stones along a spiral
  (benchmarks: c1's scattered green stones, c3's red insets, c10's studs along
  a spiral, c5). Kid controls: pattern, how many, size.
  - Gems are separate small meshes positioned from `radiusAt` (surface point
    and normal). Keep placement a pure function in `wand/` so ticket 05's bend
    can pass gem positions through the same spine.
  - Each sits in a shallow carved seat (a local cut in the radius field) and
    optionally a metal rim from 03.
- **End gems**:
  - Crystal tip: a pointed hexagonal crystal replacing the wood tip (c2, c6,
    c7).
  - Orb pommel: a sphere replacing the end shape (c11, without the claws).
- **Colour**: gem colour follows the core's swatch (`wandSchema.ts`, `core`).
  At rest they glow faintly; when the wand casts they flare with the spell,
  timed off `SPELL_SECONDS`.
- **Material**: something that reads as glass or stone on a phone. Full
  transmission may be too costly; a faceted emissive plus HDRI reflection is
  probably enough. Check on a phone.
- **Reduced motion**: no flare animation, a steady glow, matching the rest of
  the app's motion rules.

## Watch for

- The tip position for the spell and sparkles (`CloseUpStage.tsx` tip) moves
  if a crystal makes the wand longer; length should include the crystal, or the
  crystal should replace the end of the shaft, not extend it.
- Gems must not collide with handle carving or raised spirals; the placement
  function decides where they're allowed.

## Done when

- Unit tests cover placement (count, on the surface, inside allowed zones,
  deterministic for the same params); iwft covers the controls and that the
  stage is asked to cast with gems lit.
- At least one gem preset with an original name.
- Ed has seen gems at rest and flaring on a real GPU and on a phone.
- Verify loop green. ADR for gems and the core-colour link.

## Comments
