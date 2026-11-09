# 08 - Crystal colours, tip shapes and gem cuts

**Status:** ready-for-human
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

**2026-11-09, agent (built):** Built on branch `armoury-variety-08-crystal-variants`
(chained on 06's branch); decisions in ADR 0087. Needs Ed's eye on a real GPU, including
a few Try another rolls, before merging.

- Extras gain "Crystal colour" (swatches; "Match the core" shows the current core's
  colour with a light centre), "Crystal shape" (with a crystal tip) and "Gem cut" (with
  set gems). Old saves open as Match the core, Hex point and Round.
- Colour: `compileWand` resolves one `gemColour` (glow and stone) for set gems, crystal
  and orb. The spell, sparkles and tip glow stay the core's colour.
- Clear glows a cool white in a grey stone; Smoky a dim warm amber in a near-black
  stone, so it reads darker at rest and flares amber, not white.
- Tip shapes are pure solids in `wand/crystals.ts`; `crystalMesh` stands them on the
  spine's tangent and `tipPose` takes the solid's point, so the glow, spell and trail sit
  on it for every shape, straight or bent (the shard's point is off-centre on purpose).
- Cuts: each seat is a signed distance (circle, rounded square, marquise), so the dish,
  rim and carving fade follow the stone's outline; a round seat is unchanged. Marquises
  lie along the wand. Packing uses each cut's reach along and round the wand, so ADR
  0083's rules hold; a marquise row fits fewer stones on a crowded short shaft.
- Try another: Match the core about 53%, Hex point 60%, Round 67%.

Deviation: the "Crystal colour" label shows whenever there is any gem (set gems or orb
too), since the one colour covers them all.

GPU shots (headless Chromium, ANGLE Metal) in `shots/08/r3/`: `colour-*` (rest,
`-flare1`, `-flare2`), `tip-*` and `tip-*-branch` (full-bend 38 cm branch), `cut-*` (line
with gold bands, ring, spiral over carving), `reduced-*` (reduced motion: steady glow
when cast), `panel-extras.png`. The wand is small in the frame; crop the tip or shaft.

Not done / for later:
- Not checked on a real phone.
- Citrine is close to the Starlight core.
- Flare shots are timed by wall clock, so a few caught the flare a little late.

