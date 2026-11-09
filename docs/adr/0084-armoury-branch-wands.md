# 0084 - armoury branch wands: a spine bent after building, and a kind picker

- **Status:** Proposed
- **Date:** 2026-11-09
- **Related:** [ADR 0083](0083-armoury-glowing-gems.md) (gem poses ready for a bend),
  [ADR 0082](0082-armoury-material-zones.md) (zones, the bloom cap),
  [ADR 0081](0081-armoury-raised-features.md) (the envelope, weighted choices),
  [ADR 0074](0074-armoury-save-format.md) (new params default so old saves open),
  `.scratch/armoury-variety/` spike 02 and ticket 05.

## Context

Every wand was a straight turned stick: a radius field r(angle, z) round a
straight axis. Many reference wands are branches: bent, lumpy and knotted. Spike 02
showed that a bend alone reads as a bent rod and a wiggle with an even radius as
tubing; it takes a natural taper, lumps, knots with stain pooled in them and a
gentle bend together. It also showed the bend could be applied after the straight
wand is built, and that the branch controls make the turned handle's controls
meaningless. Ed decided the three questions the spike left open (ticket 05,
"Decisions").

## Decision

- **A "Kind of wand" picker above the groups**: Turned (default) or Branch. It is
  a schema param `kind` in its own group, `kind`, which the panel and the phone
  sheet render above the groups. Old saves and links have no `kind`, so
  `normalise` opens them as Turned. "Try another" always keeps the kind: the
  workbench adds the `kind` group to the locked groups it passes to `randomise`,
  so `engine/` stays item-agnostic.
- **The branch's controls are their own group**, "The branch" (phone tab
  "Branch"), shown only on a Branch: How bent, How wiggly, Lumpy, Knots (0-6) and
  Which branch (0-99). Groups now carry an optional `shows` predicate, and
  numerals are counted over the groups shown, so there is never a gap.
- **Handle: grown or turned** ("Grown or turned", in the handle group, on a Branch
  only). Grown is a natural taper, thickest at the butt with a slight swell where
  the hand goes, and hides Handle, Pattern, Ring and "Ring made of". Turned brings
  back the turned handle and ring, then a natural shaft tapering straight from the
  ring to the tip. Lumps and knots start past the ring.
- **No shaft carving on a Branch.** Carving and its controls hide, and the compiler
  builds none. Bumps stay. A Branch is named "The ... Branch".
- **The spine is applied after building.** Every feature is still authored in
  straight (angle, z) space. Each straight ring is carried onto a frame on the
  spine at its z before the normal pass, so normals need no extra work, and UVs
  stay in straight space, so the grain follows the bend. The spine is a bow plus
  three wiggles, less the straight line between its ends, so pommel and tip stay
  on the axis and the box, wave, tip glow and share picture need no changes. The
  frame is Gram-Schmidt from world x; a rotation-minimising frame is only needed
  for much bigger bends.
- **Curvature stays bounded.** The bow is `sin(pi u) - 0.2 sin(2 pi u)`, the wiggles
  fade in with a smoothstep over the first 40% and have amplitude `0.022 L (2/f)^2`,
  so each frequency curves equally hard. No `u^p` with p < 2 and no min/max
  envelopes, which the spike found fold the inside of a bend. Across length 28-38,
  slim to chunky, bend and wiggle 0-1 and twelve seeds, the tightest bend radius is
  at least 3x the widest surface radius there; the test asserts 2x.
- **Lumps and knots change the radius**, so they live in `radiusAt`, inside the
  envelope. Lumps are four low-frequency ripples, periodic in angle, at most 7% of
  the radius. Knots are bosses with a dimple, 16-26% of the local radius high,
  smaller below the grip, kept off gem seats and metal bands. A knot's heart and rim
  pool stain and shade darker, which is what makes it read as a knot. Groove depth
  for stain is measured from the natural surface (profile plus lumps and knots), so
  a lump never reads as carving.
- **Same params, same branch.** The branch is seeded from "Which branch" alone,
  never from a hash of the other params, so changing the colour never grows a new
  branch. A turned wand ignores the branch params entirely (`spec.branch` is null),
  so a Try another roll can't bend it or knot it.
- **Everything placed on the surface bends with it.** `gemPoses` carries each set
  gem's point and normal through the spine frame at its z; `endPoses` stands the
  crystal on the spine's tangent at its base and puts the orb on the spine. The tip
  glow and spell aim along the tip's tangent.
- **The close look's hit box** is sized from `reachMm`, how far the bent surface
  gets from the axis, so a tap on the peak of a full bow lands.
- **A stained Branch is matte.** On a turned wand a stain lowers roughness by up
  to 45% (polished); on a Branch by 15%, from a rougher base, so a stained branch
  doesn't look lacquered.
- **New preset "Blackthorn"**: the spike's best branch (walnut, midnight stain,
  six knots).

## Consequences

- A full-resolution branch build costs about 1.4x a straight one (the spike
  measured 39 ms against 27 ms).
- Wiggle amplitude is lower than the spike's (0.022 L, not 0.03 L): at full wiggle
  on a 38 cm wand the spike's read as a snake.
- The shop number hashes every param, so adding `kind` and the branch params
  changes old wands' numbers, as every new param has.
- The box shadow is still a straight blur under a bowed wand. Not noticeable.
- Forks, curls and hooks stay out (spec): they don't fit a radius field on one
  spine.
