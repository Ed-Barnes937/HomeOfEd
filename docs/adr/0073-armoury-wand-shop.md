# 0073 - armoury: a stateless wand shop with a three.js stage behind a seam

- **Status:** Accepted - **amended 2026-11-11** (see the note below the header)
- **Date:** 2026-11-08
- **Related:** [ADR 0008](0008-apps-without-a-database.md) (stateless apps),
  [ADR 0074](0074-armoury-save-format.md), [ADR 0075](0075-armoury-share-links-and-picture.md),
  [ADR 0076](0076-armoury-generator-tuning.md). Idea, research and prototype:
  `~/Code/Playground/ideas/armoury`.

> **Amended by [ADR 0097](0097-armoury-street-and-last-shop.md) and
> [ADR 0101](0101-armoury-smithy-scene-tag-and-picture.md) (2026-11-11).** The wand
> shop is now one of two shops on a street, beside the smithy, which makes swords.
> Everything this ADR decides about the wand shop's look, the seam and the sheet
> stands; it now lives at `/wands`, and the root sends a first visitor to the
> street. The shell around it (header, tag, controls, shelf) is shared by both
> shops through `ShopView` ([ADR 0096](0096-armoury-item-kinds-saves-and-links.md)).

## Context

The armoury prototype proved that a non-artist can generate wands that look
carved rather than procedural: a radius field with groove sets, real CC0 wood
scans, a stain that blends towards a colour, and a lit stage. It was a
developer's tool though: a CAD-like canvas and a panel of chips. The brief for
the real app was "slick, not an AI prototype", with saving and sharing and no
backend.

Three visual directions were explored on a design canvas (Workshop, Night sky,
Specimen), plus a fourth asked for afterwards: the feeling of choosing a wand in
an old wand shop. That fourth, "Wand shop", was chosen.

## Decision

**The look is a wand shop.** Shelves of boxed wands fade into the dark behind a
counter; the child's wand lies in an open, velvet-lined box on the counter with
the lid propped behind it; a paper tag on a string carries its shop number, name
and tag line. The core's colour lights the shop around the tip, and flashes when
a spell is cast. Controls read like an order slip (numbered sections, IM Fell
English small caps), length is set on an inch ruler, woods are end-grain discs,
and the actions speak shop: "Try another", "Keep this wand", "Your shelf". The
shelf wall is one seeded SVG rasterised once as a background image, not DOM.

**Franchise-free.** The feeling is evoked with shelves, boxes, tags and inches,
never with names, quotes or vocabulary from the books or films. Cores, lore and
names are original.

**Stateless, client only.** No Store, no handlers beyond the starter's
placeholder; everything persists in `localStorage` (ADR 0074) or travels in a
link (ADR 0075).

**three.js behind a seam.** `stage/stage.ts` defines `StageHandle` (cast, roll,
capture) and a `StageContext`. `WandStage` is the only module that imports
three.js / React Three Fiber, and `App` lazy-loads it, so the shop renders at
once and the ~1 MB 3D chunk follows. The `.iwft` harness passes `FakeStage`,
which exposes what it was asked to draw as data attributes. That keeps whole-
frontend tests off WebGL; generator correctness is unit-tested on the pure
`wand/` modules instead.

**The box drives the wand.** The 3D canvas is a click-through overlay that
bleeds past the box (so the glow and the spell aren't clipped); the box itself
is the button. A tap casts a spell, a horizontal drag rolls the wand about its
length, Enter/Space cast. The camera looks down into the box, matching the CSS.
(Amended by [ADR 0077](0077-armoury-close-look.md): a tap now lifts the wand out
for a close look, where it casts.)

**Phones get a bottom sheet.** Below 900px the panel becomes a sheet with one
tab per group; the counter scene sits above it.

**Locks and undo.** "Try another" re-rolls only unlocked groups and remembers
the wand it replaced until anything else changes ("Put the last one back").

## Consequences

- The stage chunk is large (three.js, R3F, drei, postprocessing). It is lazy,
  so first paint is the shop; the warning limit is raised for it in
  `vite.config.ts`.
- A WebGL-less browser shows the shop and the controls but no wand. Acceptable
  for now; a static fallback image is an easy later addition.
- Link previews can't show the wand (the fragment never reaches a server); see
  ADR 0075.
