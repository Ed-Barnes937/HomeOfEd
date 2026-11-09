# 0081 - armoury adds wood: shaft bumps, raised spirals and the envelope

- **Status:** Proposed
- **Date:** 2026-11-09
- **Related:** [ADR 0076](0076-armoury-generator-tuning.md) (replaces its "carving
  only removes wood" test), [ADR 0074](0074-armoury-save-format.md) (new params
  default so old saves open), `.scratch/armoury-variety/` ticket 01.

## Context

Every wand was a smooth turned profile with groove sets cut out of it. Knobbly
sticks, bamboo and wands with a spiral ridge wound round them need wood added
along the shaft. The generator's one geometric test asserted that carving only
ever removes wood, which a ridge breaks on purpose.

## Decision

- **Bumps are profile, not carving.** A new shaft choice, "Bumps" (No bumps,
  Knobbly, Bamboo), with "How many bumps" (2-7) and "How big", swells the shaft's
  profile at evenly spaced points. Bumps sit between 6 mm past the collar and 86%
  of the length, so they never touch the collar or the point, and each one is
  smaller towards the tip (down to 45% of the first). A knob is one cosine swell;
  a bamboo ring is a narrow ridge on a short, gentle swell. Because grooves are a
  fraction of the local profile radius, any shaft carving follows the bumps.
- **A raised spiral is a round groove set marked `raised`.** A new "Spiral"
  choice (Cut in, Raised) shows for the two spiral carvings; raised spirals get
  their own "How tall" slider instead of "How deep", so the words fit. The
  `GrooveSet` type only allows `raised` on round sets, because a raised flat set
  (a polygon outside the profile) would silently do nothing. `radiusAt` keeps
  the deepest cut and the tallest ridge
  separately and adds both to the profile, so overlapping sets combine the same
  in any order; for cuts alone this is exactly the old `min()`. Ridges are not
  shaded or stained as grooves.
- **The envelope replaces "carving only removes wood".** For every preset and 30
  random wands, the surface stays within a quarter of the local profile radius
  either side (so never below zero), and nothing (profile or ridge) is wider than
  1.35 times the handle's widest. The last bound is what keeps a chunky, bumpy
  wand inside its box and the close look, which size it from `lengthMm` and
  `handleMaxR`.
- **Calm.** Big bumps calm the handle's carving the same way a long shaft carving
  does, easing in with "How big" (30% to 80%) so dragging it never jumps; the two
  calms take the stronger of the two.
- **Weighted choices.** A choice option may carry a `weight` (default 1), which
  `randomise` honours, including among the options another param allows. "No
  bumps" weighs 2, so Try another leaves about half its wands without bumps and
  splits the rest between Knobbly and Bamboo (decided in review of PR #171).
- **Old saves.** The new params default to no bumps and a cut spiral, so every
  existing save and link opens as the same wand. The shop number changes, as
  ADR 0074 allows.

## Consequences

- Five more shaft controls, though at most four extra show at once. They live in
  the shaft group, not a new "Decorations" group: bumps change the shaft's shape
  rather than decorating its surface.
- Try another picks a raised spiral half the time a spiral is picked. Judged by
  eye the combinations read well, but bumps under twisted sides are hard to see.
- The shaft group's summary names the bumps when the shaft has bumps and no
  carving.
- Tuning was judged by eye on a real GPU (Apple M3, ANGLE Metal).
