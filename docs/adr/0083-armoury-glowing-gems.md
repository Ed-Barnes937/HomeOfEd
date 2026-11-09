# 0083 - armoury gems glow in the core's colour

- **Status:** Proposed
- **Date:** 2026-11-09
- **Related:** [ADR 0082](0082-armoury-material-zones.md) (metal, the bloom cap),
  [ADR 0081](0081-armoury-raised-features.md) (raised spirals, weighted choices, the
  envelope), [ADR 0074](0074-armoury-save-format.md) (new params default so old saves
  open), `.scratch/armoury-variety/` ticket 04.

## Context

The core only showed as the spell's colour when the wand cast. Many reference wands
carry stones: a few set into the handle or shaft, a crystal for a tip, an orb for a
pommel. Stones in the core's colour make the core visible all the time. They need a
place on the wand that never fights the carving, a length that never moves the spell's
tip, and a glow that lives with ADR 0082's rule that nothing on the wand's surface
blooms.

## Decision

- **Three kinds of gem**, all in "Extras": set gems ("Gems": No gems, Round
  the handle, Up the shaft, Winding up, with "How many gems" 3-9 and "Gem size"), a
  crystal tip ("Gem on the tip") and an orb ("Gem on the end"). The shape group's
  "Tip" and the handle's "End" hide when a gem replaces them.
- **Placement is pure and lives in `wand/gems.ts`.** It returns each set gem as
  (angle, z, seat radius) in the straight wand's space; `gemPoses` in `geometry.ts`
  turns that into a surface point and outward normal from the profile and its slope.
  A later bend of the wand can carry gem poses through the same spine as the mesh.
  - A ring goes evenly round the handle at a point chosen per handle style
    (`HandleStyle.belt`), clear of its beads, with one stone on the side that faces
    up in the box.
  - A row and a spiral run up the lower 62% of the shaft, spread evenly over the
    stretches left once metal bands and bump crests are taken out. A spiral of gems
    follows the shaft's twisting carving, between round grooves or ridges and in the
    middle of flat faces. With no carving it winds by itself, one turn per 240 mm,
    centred on the side that faces up, so most of its stones show from one side.
  - Seats never touch: a seat shrinks to fit its neighbours and never covers more
    than 40% of the local radius. A row or spiral is laid out as if every seat were
    the smallest (0.8 mm), then each seat grows towards "Gem size" as far as its
    neighbours and the nearest band, bump or shaft end allow. So a bigger size never
    means fewer or smaller gems. Where even 0.8 mm seats won't fit (a short, crowded
    shaft), the row or spiral holds fewer gems than asked.
- **Each gem sits in a seat cut in the radius field**: a shallow dish (30% of the
  seat's radius deep) with a low rim (0.35 mm, 0.6 mm wide). Carving and raised
  spirals stop at the rim and come back over 1.2 mm, as they do at a band (ADR 0082).
  So a row of gems across a carved shaft reads as stones set over the carving, and
  the envelope still holds.
- **Settings follow the wand's metal.** When anything on the wand is metal, the rims
  and the crystal's cup are that metal; otherwise they are whatever finish they are
  cut in. No extra control.
- **End gems replace the ends; they never lengthen the wand.** The compiled spec has
  `bodyFrom` and `bodyTo`, the stretch the turned body covers, and the mesh is built
  over just that. A crystal is a pointed hexagon, 5 times its radius long, standing in
  a slightly wider cup and ending exactly at `lengthMm`, so the spell, the sparkles and
  the wave trail still leave from the same point. An orb is a sphere the size of the
  ball end, touching z = 0, sitting in a socket with a lip. A metal end cap on an orb
  wand becomes the socket's metal cup.
- **Colour and glow.** Gems are glass in the core's swatch: a dark base, a clearcoat
  and the studio HDRI for reflections, and an emissive in the core's colour that is
  brightest where a facet faces the eye, so a stone reads as lit from inside without
  transmission. Set gems are an eight-sided lathe and the crystal a six-sided one,
  flat shaded; the orb is smooth.
- **Gems and the bloom cap.** At rest gems obey the same cap as the rest of the wand
  (92% of `BLOOM_THRESHOLD`), so a wand lying in its box glows faintly but only the
  core's light, sparkles and spell bloom. When the spell leaves the tip the gems flare
  with it: their glow and their own cap rise together (to 8x and 14) and fall back with
  the same `exp(-3t)` envelope as the tip's light, reaching rest by `SPELL_SECONDS`.
  So gems are the one part of the wand's surface allowed to bloom, and only while it
  casts. The cap is a uniform on the gem material, written each frame. `gemGlow` in
  `stage/gemGlow.ts` holds this and is unit tested; `SPELL_SECONDS` moved into
  `stage.ts` so it can be.
- **Reduced motion**: gems hold their resting glow and never flare.
- **Try another stays mostly plain.** "No gems" weighs 40 against 1 for each pattern,
  and each end gem 1 in 51, so about one wand in ten has a gem (7% set gems) and about
  52% of rolls are still plain wood with no extras at all.
- **Old saves.** Every new param defaults to none, so existing saves and links open as
  the same wand. The shop number changes, as ADR 0074 allows.

## Consequences

- Five more controls in the extras; a wand without set gems shows three of them.
- Extras' summary says "Gems" when the wand has gems and no metal, paint or bone.
- The tag's name and lore don't mention gems yet.
- On a short shaft crowded with bumps and bands, a row or spiral can hold fewer gems
  than "How many gems" asks for.
- Tuning was judged by eye on a real GPU (Apple M3 Pro, ANGLE Metal) in the box, the
  close look at rest and mid-flare, on a phone viewport and in the share picture.
