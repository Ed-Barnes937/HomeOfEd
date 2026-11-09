# 04 - Gems that glow in the core's colour

**Status:** ready-for-human
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

**2026-11-09, agent (built):** Built on branch `armoury-variety-04-glowing-gems`
(chained on 03's branch); decisions in ADR 0083. Needs Ed's eye on a real GPU and a
real phone, including a few Try another rolls, before merging.

- Trimmings gain "Gems" (No gems, Round the handle, Up the shaft, Winding up) with
  "How many gems" (3-9) and "Gem size", plus "Gem on the tip" (Crystal) and "Gem on
  the end" (Orb). "Tip" and "End" hide when a gem replaces them.
- Placement is `placeGems` in `wand/gems.ts` (angle, z, seat radius); `gemPoses` in
  `geometry.ts` gives surface point and normal, ready for 05's bend. Rows and spirals
  skip bands and bump crests; a spiral of gems winds between the shaft's grooves or
  ridges. Carving stops at a gem's rim, as at a band.
- Crystal and orb replace the ends: the spec has `bodyFrom`/`bodyTo` and the length
  is unchanged, so the spell tip doesn't move.
- Settings (rims, the crystal's cup) are the wand's metal when it has any.
- Glow: under the 03 cap at rest, so gems don't bloom in the box; they flare with the
  spell (glow and their own cap rise and fall together), and hold steady with reduced
  motion.
- Try another: about 10% of rolls have a gem; about 52% stay plain wood.
- New preset "Lantern" (brass-capped walnut, ring of gems, crystal tip, starlight).

GPU shots (headless Chromium, ANGLE Metal, Apple M3 Pro) in `shots/04/`: `r3/` is the
final round (ring, crystal, orb at rest and mid-flare; line and spiral; phone; share
picture). The flare peaks in `*-flare1.png`. `r1/`, `r2/` are before tuning.

Not done / for later:
- Not checked on a real phone, only a phone viewport.
- Name and lore don't mention gems ("The Smoky Star").
- Ed to judge the orb (reads as a glowing pearl more than clear glass).

**2026-11-09, agent (review round 1 follow-ups):**
- Seats no longer floor at 0.8 mm: they shrink to share the room, and where even
  0.8 mm seats won't fit, the row or spiral holds fewer gems. The crowded designs from
  review (28 cm, 7 knobs or bamboo bumps, three bands, 9 big gems, with and without a
  crystal) are in the no-touching test.
- The envelope test now includes three random wands with each gem pattern, a crystal
  and an orb forced on.
- A spiral of gems with no carving winds one turn per 240 mm (was 80), centred on the
  side that faces up; most stones now show from one side. Shot in `shots/04/r4/`.
- iwft: `verifyGemsLit` is now `verifyGems`.

**2026-11-09, agent (review round 2 follow-up):**
- A row or spiral is laid out for the smallest seat, then each seat grows to fit its
  neighbours and the nearest band, bump or shaft end, so a bigger "Gem size" never
  gives fewer or smaller gems. Tested across the crowded designs.
