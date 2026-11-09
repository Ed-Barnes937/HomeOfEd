# 08 - Crystal colours, tip shapes and gem cuts

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
Blocked by: 06 (sequencing)

Ticket 04's gems always take the core's colour, the crystal tip is always a
hexagonal point and set gems are always round. Ed wants colour and shape variants
for the crystals.

## What to build

- **Colour.** A "Crystal colour" control in Extras: Match the core (the default),
  Amethyst, Emerald, Ruby, Sapphire, Citrine, Clear, Smoky.
  - One gem colour for the whole wand: set gems, the crystal tip and the orb.
  - The gems glow at rest and flare in their own chosen colour. With "Match the
    core" they behave exactly as today.
  - "Clear" and "Smoky" need a sensible glow; decide what it is and record it in
    the ADR.
  - Old saves get "Match the core".
- **Tip shapes.** A control for the crystal tip's shape: Hex point (today's),
  Double point, Cluster, Raw shard, Faceted teardrop.
  - Each shape replaces the wand's end and doesn't extend it.
  - The tip glow, spell and wave trail still sit on the crystal's point,
    including on a bent Branch (see 05's tip fix).
- **Set-gem cuts.** A control for the cut of the set gems: Round (today's),
  Square, Marquise.
  - Seats still never touch, and ADR 0083's packing rules still apply. A
    marquise is elongated, so check its orientation along the wand.
- **Shared rules for all three.**
  - Options are curated so every combination looks good.
  - "Try another" uses option weights: mostly "Match the core" and today's
    shapes.
  - The bloom cap rules from ADR 0083 still hold.
  - Reduced motion still means a steady glow.

## Done when

- Unit tests cover the gem colour resolution (including Match the core and old
  saves), each tip shape ending exactly at the wand length with the tip pose on
  its point (straight and bent), set-gem cuts never touching, and determinism.
- An iwft test covers the new controls.
- Headless GPU shots show every colour at rest and mid-flare, every tip shape,
  and every cut.
- Ed has looked at it on a real GPU.
- Verify loop green.
- ADR 0087 covers this.

## Comments
