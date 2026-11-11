# 0101 - armoury smithy: the forge drawn in CSS and SVG, the anvil top-down, a brown ticket

- **Status:** Accepted
- **Date:** 2026-11-11
- **Related:** [ADR 0073](0073-armoury-wand-shop.md) (the wand shop's look this
  matches), [ADR 0075](0075-armoury-share-links-and-picture.md) (the picture),
  [ADR 0076](0076-armoury-generator-tuning.md) (why scene shadows are CSS),
  [ADR 0096](0096-armoury-item-kinds-saves-and-links.md) (the shop shell),
  [ADR 0098](0098-armoury-sword-generator.md) (the sword and its outline).

## Context

The smithy needs a place as carefully made as the wand shop's candle-lit shelves,
velvet box and paper tag: a cosy village forge at the end of the day, with the
sword lying across an anvil (decision E2). The wand shop is drawn, not rendered:
one seeded SVG wall rasterised once, CSS gradients for light, a blurred shape for
the shadow, and the 3D item in a click-through canvas over the scene. The sword is
3D too, so a drawn anvil under a rendered sword risks reading as a sticker unless
both agree on view and light.

## Decision

**Drawn, like the wand shop.** `smithy/forgeArt.ts` makes two seeded SVGs: the
back wall front-on (stone below a timber beam, a brick hearth with a sooty hood
and a bed of coals, tongs on a rail, bellows, hammers on a rack, horseshoes, a
lantern, a small-paned window, a leaning chalk slate, a quench barrel, a sleeping
cat on the warm hearth end) and the floor from above (worn flags, ash thicker
toward the forge). Both are drawn at 1 px per unit and scaled by `--art-scale`
(1 on desk, 0.5 on a phone) so the forge stays a warm edge on the left of a
phone. CSS adds the light: the forge's spill on the wall and floor, the window's
cool shaft, the room falling dark at the edges. The only live parts are a slow
pulse on the coals and nine rising embers; both stop under reduced motion.

**Texture from tiles, not filters.** Stone, soot and floor grain come from two
small seamless noise tiles made once on a canvas (`smithy/grain.ts`) and laid
over the art with `soft-light`. An SVG `feTurbulence` over the whole wall took
about 600 ms to paint at DPR 2; the tiles take a few.

**The anvil is fixed and drawn in the sword's own view.** `smithy/anvilArt.ts`
draws a London-pattern anvil from straight above (horn to the forge side, step,
polished face with hardy and pritchel holes, feet past the face) on a banded
stump, in the anvil button's units. The face spans 0.62 of the stage's fill, so
a Dagger lies on it and every longer sword overhangs (decision O3: the sword is
drawn at `drawnFraction(lengthMm)`, the anvil never scales). Its light matches
the 3D lights: warm from the low left (the forge), cool from the high right (the
window), shadows falling right and slightly toward the viewer.

**The shadow is the sword's outline.** `swordOnAnvil(spec)` places
`swordOutline` where the stage draws the sword (centred in the slot, pommel
left). `SwordShadow` draws it three ways, clipped to the anvil's top: a tight dark
contact shadow, a cool-dark cast away from the forge and a warm-dark one away from
the window; and, outside the anvil's top, one soft far shadow on the stump and
floor wherever the sword overhangs. It hides while the sword is lifted.

**Palette by token.** `styles/tokens.scss` overrides the shell's tokens under
`[data-shop='smithy']` (soot panel, brass, kraft-brown card, hemp twine, a steel
rule), so the panel, sheet and tag turn smithy-coloured with no change to the
shared components. The ticket is the shared `Tag` in brown card, tied by drawn
twine from its hole to the sword's grip (`spec.gripAt`). It keeps "No." (O13).

**The picture is the shared frame plus a per-shop painter.** `paintSmithyCard`
draws the same wall, floor and anvil SVGs into the card (preloaded as images when
the module loads), the window's light, the sword's shadow cast from the capture's
own alpha (the shadow-offset trick, which works without `ctx.filter`), the
capture, and a faint glow in the sword's colour. The frame draws the tag, header
and footer.

## Considered and rejected

- **A rendered backdrop** (CC0 props baked offline into images, research 9.1):
  heavier, and the wand shop set the drawn style; the two rooms should match.
- **Live 3D coals and a coal light in the stage:** a second light source to keep
  in step with the drawing, and GPU cost for a few glowing pixels. The coals are
  SVG with a CSS pulse.
- **A 3D anvil inside the sword stage:** kept as the fallback for architecture
  risk 4.13 only if the drawn anvil reads as a sticker beside the real sword.
- **A blurred bar for the shadow** (the wand's): a guard and pommel cast their
  own shapes, and an overhanging blade's shadow belongs on the floor, not the
  anvil.

## Consequences

- The sword stage must keep this frame: sword centred in the slot along its
  pommel-to-tip line, pommel left, outline `+y` toward the viewer, the forge key
  from the low left and the window from the high right. If it changes, the shadow
  and the anvil's light must change with it.
- The picture's tag is drawn by the shared frame in the wand's paper colours, not
  the smithy's brown card.
- The scene is static apart from the coals and embers, so it costs nothing per
  frame; the art rasterises once per size.
