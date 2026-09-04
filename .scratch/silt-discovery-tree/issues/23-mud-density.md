# 23 - Mud should be one of the densest things in the world

**Status:** ready-for-agent
**Type:** task
**Source:** local testing feedback (Ed, 2026-09-04) - "Mud should be one of
the most dense liquids (feels odd calling it a liquid) - currently sand and
sulphur fall through it which feels odd."
**Spec:** sim content - `.scratch/silt-materials/spec.md` for density context.

Today mud is `liquid, density 50` (`elements.ts:252`), deliberately below sand
(60) - the comment says "lighter than sand, so a grain still sinks through".
Sulphur (powder, 55) sinks through too. Ed's ruling overrides that design:
grains resting ON a mud bed is the felt-right behaviour.

## Design

- Raise mud's density above every powder that should rest on it: **65** puts
  it above sand (60) and sulphur (55), making it the densest liquid (lava is
  45). Update the def comment to tell the new story (a bed, not a cloud).
- Keep the archetype `liquid` (the ooze physics - dispersion 1, move 0.1 - is
  what makes mud read as mud). The `[liquid]` tag chip stays; if the word
  still feels wrong on the chip after this lands, that is a separate
  presentation call, not a physics one.
- **Check the seed path carefully**: burial (`seed + mud -> buried`) is a
  reaction row, not density sinking, so it should survive - but the seed bank
  has an explicit density knob (`elements.ts:551`, "This is the density knob")
  and seedBank.ts is called out as density-dependent. Verify germination,
  burial and the buried seed's behaviour under the new number with the
  existing life tests before touching anything there.
- Knock-on layers to eyeball in the sim: mud now settles under sand and
  sulphur; lava floats on mud; water still floats on mud (30 < 65). Regenerate
  nothing - density is not an edge, the graph doc does not move.

## Tests

- soil/acid-style unit test: a sand grain and a sulphur grain dropped on a mud
  pool rest on it (do not pass through); water still sits on mud; a seed still
  buries in mud and germinates.
- Determinism test green; full life.test.ts green (run it alone if the
  machine is loaded - known flake under load).
