# 01 - Raised features: shaft nodes and raised spirals

**Status:** ready-for-human
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

**2026-11-09, agent (built):** Built on branch `armoury-variety-01-raised-features`;
decisions in ADR 0090. Needs Ed's eye on a real GPU, including a few Try
another rolls, before merging.

- Shaft gets "Bumps" (No bumps, Knobbly, Bamboo) with "How many bumps" (2-7) and
  "How big". They are profile, sit between 6 mm past the collar and 86% of the
  length, and shrink to 45% towards the tip.
- Spirals get "Spiral" (Cut in, Raised). A raised spiral is a groove set with
  negative depth and its own "How tall" slider (in place of "How deep"); the
  fade in and out are unchanged.
- The "carving only removes wood" test is now the envelope: within 25% of the
  local profile radius either way, and nothing wider than 1.35x the handle (so a
  chunky bumpy wand still fits the box). The test now gathers extremes and
  asserts once; the old per-sample expects took over 5 s per design on a
  loaded machine.
- Big bumps calm the handle like a long shaft carving does, eased over "How
  big" 30-80%.
- New preset "Hedgerow" (knobbly oak).
- Thumbnails: unaffected, since bumps start past the collar and thumbnails show
  only handles.

Deviations:
- Bumps live in the Shaft group, not a new "Decorations" group (the spec's
  rule for surface decoration); they change the shaft's shape.
- Bumps are hard to see under Twisted sides; left as is.
- The Shaft group's summary still says the carving ("Smooth") on a knobbly
  wand with no carving.

GPU screenshots (headless Chromium, ANGLE Metal) are in `shots/01/` (gitignored).

**2026-11-09, agent (review round 1 follow-ups):**
- Shaft summary names the bumps when there are bumps and no carving.
- Choice options take an optional `weight` in `engine/`; "No bumps" weighs 2,
  so Try another leaves about half its wands without bumps (ADR 0090).
- `GrooveSet` is now a union: only round sets can be `raised`, so a flat ridge
  can't be written. Depth is always a positive fraction.
- Dropped the redundant `thinnest >= 0` check; `LONGEST_COLLAR` comes from
  `COLLARS` (now exported).
