# 0087 - armoury crystal colours, tip shapes and gem cuts

- **Status:** Proposed
- **Date:** 2026-11-09
- **Related:** [ADR 0083](0083-armoury-glowing-gems.md) (gems, their packing and the
  bloom cap), [ADR 0084](0084-armoury-branch-wands.md) (the tip pose on a bent wand),
  [ADR 0074](0074-armoury-save-format.md) (new params default so old saves open),
  `.scratch/armoury-variety/` ticket 08.

## Context

Ticket 04's gems always took the core's colour, the crystal tip was always a
hexagonal point and set gems were always round. Ed asked for colour and shape
variants and decided the options (ticket 08): eight colours, five tip shapes and
three cuts, each curated so every combination looks good.

## Decision

- **Three controls in Extras.** "Crystal colour" (Match the core, Amethyst, Emerald,
  Ruby, Sapphire, Citrine, Clear, Smoky) shows whenever the wand has any gem; "Crystal
  shape" (Hex point, Double point, Cluster, Raw shard, Faceted teardrop) shows with a
  crystal tip; "Gem cut" (Round, Square, Leaf) shows with set gems. Leaf is a marquise
  cut under a name a child knows; the code calls it `marquise`. Colour is a
  swatch picker; "Match the core" is drawn as the current core's colour with a light
  centre.
- **One gem colour for the whole wand.** `compileWand` resolves it to `gemColour`:
  the light the gems glow with and the stone's own colour, both sRGB. "Match the
  core" is the core's swatch with the stone at a quarter of its light, as before. A
  named colour has its own glow, chosen bright like the core swatches so every colour
  shows at rest, and the same stone rule. Citrine is pushed towards orange (`#ff901f`)
  so it stands apart from the Starlight core. The spell, sparkles and tip glow stay the
  core's colour; only the gems change.
- **Clear and Smoky.** Neither has a hue of its own, and glowing in the core's
  colour would make them read as "Match the core" with a different stone. So Clear is
  colourless quartz lit from inside: a cool white glow (`#eaf2ff`) in a grey stone.
  Smoky is light through smoked glass: a dim, warm amber glow (`#a8703f`, about two
  thirds as bright as the others) in a near-black stone, so it reads darker at rest
  and flares amber rather than white.
- **The glow rules are unchanged.** `gemGlow` scales whatever colour the gems have:
  under the wand's cap at rest, flaring with the spell (its own cap rising with it),
  and a steady glow with reduced motion. The cap works on the brightest channel, so it
  holds for every colour.
- **Tip shapes are pure solids in `wand/crystals.ts`**, built in the crystal's own
  frame (base at 0, point at its length), and `crystalMesh` in `geometry.ts` stands
  that solid on the spine's tangent at its base, as the hex point stood before. Every
  shape replaces the end: the length is unchanged, nothing reaches past the point
  along the crystal, and below the cup's rounded lip the solid is inside the cup.
  - Hex point: today's crystal.
  - Double point: a lower point rising out of the cup to a waist, then the upper one.
  - Cluster: a slimmer main point with four smaller ones leaning out round it.
  - Raw shard: five uneven sides and a broken, slanting top whose point is off the
    middle.
  - Faceted teardrop: a briolette, a bulb low down tapering to a long point, each row
    of facets turned half a facet from the last.
- **The spell leaves from the solid's point.** `tipPose` takes the point of
  `crystalMesh` and the tangent at the crystal's base, so the tip glow, spell and wave
  trail sit on the point for every shape, including the shard's off-centre one and on a
  bent Branch (ADR 0084).
- **Cuts change the seat as well as the stone.** A seat's shape is a signed distance
  in `wand/gems.ts`: a circle, a square with rounded corners, or a marquise (two
  circles' overlap). The dish, rim and the carving's fade all follow that distance, so
  a round seat is exactly as before. Stones are cut from the same outline (pavilion,
  girdle, crown and table) and turned so their length runs along the wand: `gemPoses`
  now gives each stone the way along the surface as well as its normal, carried through
  the spine.
- **Packing keeps ADR 0083's rules**, measured in each cut's reach. A cut reaches
  `along` and `around` times its size (round 1 and 1, square 0.86 and 0.86, marquise
  1.45 and 0.62). A row or spiral spaces gems by their reach along the wand, a ring by
  their reach round it; layout-for-the-smallest-seat, growing towards "Gem size" and
  the 40% cap all apply as before. So a marquise row holds fewer stones on a crowded
  short shaft than a round one.
- **Try another stays mostly today's look.** "Match the core" weighs 8 against 1 for
  each colour (about 53%), the hex point 6 against 1 for each other shape (60%), and
  round 4 against 1 each for square and marquise (67%). Gems still come up on about one
  roll in ten (ADR 0083).
- **Old saves.** The new params default to Match the core, Hex point and Round, so
  existing saves and links open as the same wand.

## Consequences

- Three more controls in Extras, each shown only when it applies.
- At the flare's peak bright colours bloom towards white at the centre, with their
  hue in the halo, as "Match the core" always has.
- Tuning was judged by eye on a real GPU (ANGLE Metal, headless) at rest, mid-flare,
  with reduced motion, on straight wands and full-bend branches.
