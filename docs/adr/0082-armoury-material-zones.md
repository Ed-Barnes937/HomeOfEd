# 0082 - armoury material zones: metal, paint and bone

- **Status:** Proposed
- **Date:** 2026-11-09
- **Related:** [ADR 0081](0081-armoury-raised-features.md) (raised spirals, weighted
  choices), [ADR 0076](0076-armoury-generator-tuning.md), [ADR 0074](0074-armoury-save-format.md)
  (new params default so old saves open), `.scratch/armoury-variety/` ticket 03.

## Context

Every wand was one wood with a stain gradient. Many reference wands have metal
caps, collars and bands, a painted shaft, a metal handle or are bone. The kid
needs to pick these without the control count running away, and every
combination still has to look good on the shop's lighting, including under the
bloom that makes the core's glow and the spell shine.

## Decision

- **Zones along z.** The compiled `WandSpec` gains `zones`: stretches of the wand
  (`from`, `to` in mm) in `metal`, `paint` or `bone`; wood is wherever no zone
  covers. Later zones cover earlier ones. The mesh carries a per-vertex
  `(metal, paint, bone)` weight, written like the stain amount, and the wood
  shader mixes each finish over the wood by those weights.
- **What a kid picks**, in a new group titled "Extras" (phone tab "Extras",
  `decor` in code, between the shaft and the core): what the handle is made of (wood, metal, painted, bone), what the shaft is
  made of (wood, painted, bone), a metal end cap, a metal ring (the collar), up to
  three metal bands, and, on a raised spiral, a metal spiral. Shaft bumps stay in
  the shaft group (ADR 0081).
- **Coupling.**
  - One metal (silver, brass, gold, dark iron) for every metal part, so a metal
    handle always matches its ring and bands.
  - One paint from a curated palette of six for every painted part.
  - A metal handle always has a metal ring. Otherwise the ring is metal if chosen,
    else takes the finish the handle and shaft share (a bone wand has a bone ring),
    else wood.
  - The end cap and the ring choice are hidden on a metal handle, the metal picker until something is
    metal, and the paint picker until something is painted.
  - The cap ends at a point chosen per handle style (`HandleStyle.cap`, just past
    the first bead or at the first neck), or past the ball on a ball end.
  - Bands sit in the gaps between bumps when there are bumps (two bumps leave
    three gaps, counting both ends), else at 10%, 30% and 50% of the shaft. They stand 0.45 mm proud, and carving and raised spirals
    stop at them, as at a ring clamped over the wood.
- **A metal spiral is a zone in angle as well as z.** A raised groove set may be
  `metal`; `radiusAt` reports how much of each point is metal ridge (full on the
  crest, fading at the ridge's foot and where the ridge fades in or out), and
  that weight takes over from whatever finish is beneath.
- **Stain** soaks into wood as before and never into metal or paint, so it still
  fades along the wood around them. Bone takes the stain's darkness but not its
  hue, so a stain ages bone rather than dyeing it.
- **The materials.** Metal is fully metallic (dark iron 0.85) with a roughness per
  metal, lit by the existing HDRI. Paint is an opaque, glossy (0.22) colour that
  hides the grain's colour but keeps 30% of its relief. Bone is a pale ivory with a
  quarter of the grain's contrast, 20% of its relief and a faint self-lit lift that
  stands in for translucency.
- **Nothing on the wand's surface blooms.** Shiny metal under the key light put
  whole highlight streaks over the bloom threshold. The surface's brightest channel
  is capped at 92% of the threshold (`BLOOM_THRESHOLD`, now shared by both stages),
  so only the core's glow, its sparkles and the spell bloom. The share picture
  renders through the same shader without bloom, so its metal highlights are
  capped too. No glint is added back for now; Ed judges metal highlights,
  including the share picture's, on a real GPU.
- **Try another stays mostly wood.** Option weights keep about 58% of rolls plain
  wood. About a quarter have some metal, usually a single part; about one in
  nine has paint and one in ten bone.
- **Old saves.** Every new param defaults to wood or none, so existing saves and
  links open as the same wand. The shop number changes, as ADR 0074 allows.

## Consequences

- Eight more controls, in their own group; the paint, the metal and the metal
  spiral only show when they apply, so a plain wooden wand shows five.
- A wand that is bone from end to end is named, described and told as bone (tag,
  shelf label, name and lore line); a partly bone wand keeps its wood's wording.
  Its wood choice then barely shows.
- Tuning was judged by eye on a real GPU (Apple M3 Pro, ANGLE Metal) in the box,
  the close look, the spell flash and the share picture.
