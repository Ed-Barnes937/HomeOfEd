# 01 - Raised features: shaft nodes and raised spirals

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
Blocked by: none

Let the generator *add* wood along the shaft, not just cut it. Today the shaft
profile is a smooth taper and every groove set removes wood
(`apps/armoury/src/wand/compile.ts`, `geometry.ts`).

## What to build

- **Shaft nodes**: evenly spaced swellings along the shaft, like a knobbly old
  stick or bamboo (benchmarks: Dumbledore's knobs, c3). Kid controls: a node
  style (none, round knobs, bamboo rings), how many, how big. Nodes are profile
  bumps, so they belong in the profile, not in groove sets. They fade towards
  the tip so the point still reads, and they stop before the collar.
- **Raised spirals**: the existing spiral groove options gain a "raised"
  variant where the helix stands proud instead of being cut (benchmarks: Ron,
  c10's ridge). A groove set with negative depth is the obvious mechanism;
  keep the fade-in/out it already has.
- **Envelope invariant**: replace the "carving only removes wood" test with a
  bounded envelope: the surface stays within a fixed fraction of the profile
  either side, and the mesh stays closed and finite. The handle range check
  stays.
- New params get curated ranges and defaults so old saves open unchanged
  (`normalise`), and `randomise` produces good-looking wands with them.
- At least one new preset that shows nodes off, with an original name.
- Kid-facing labels, no woodturning jargon (see the top of `wandSchema.ts`).

## Watch for

- Nodes plus deep shaft grooves plus a busy handle can get noisy. Couple them
  the way `calm` already calms the handle when the shaft is carved.
- Box fitting and the close look size the wand from `lengthMm` and the radii;
  check a chunky noded wand still sits in the box.
- Thumbnails in `public/thumbs/` only show handles; they shouldn't need
  re-rendering, but check.

## Done when

- Unit tests (generator) cover the envelope and the new params; iwft covers the
  new controls appearing and hiding.
- Ed has looked at it on a real GPU, including a few `Surprise me` rolls.
- The verify loop is green (`pnpm --filter armoury run test`, lint, typecheck).
- An ADR records the envelope invariant if it changes ADR 0076's tuning rules.

## Comments
