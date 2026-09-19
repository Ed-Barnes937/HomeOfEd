# trundle - a snail that goes where the tiles say

**The toy.** A garden snail sits on a big leaf. You snap instruction tiles into
a strip - `forward`, `turn`, `again x3` - press Go, and the snail trundles off,
leaving a silvery trail. Trails accumulate into pictures; the leaf slowly heals
so old doodles fade. No goals, no levels: it is a drawing toy where the pen is
a creature you program.

**The play loop.** "Can I make it draw a star?" is the whole game. Getting a
shape you imagined out of a snail that only obeys tiles is inherently funny
(it overshoots, it spirals off the leaf) and inherently compelling.

**The stealth payload.** Sequencing, iteration, decomposition, debugging - the
core of computational thinking, via the oldest trick in the book: Logo's
turtle, reborn as a toy with zero syntax. A repeat tile *is* a loop; noticing
"my square needs four of these, not three" *is* debugging. Angles and geometry
ride along for free (a hexagon needs `turn 60`, and you feel why).

**Stealth discipline.** No coding vocabulary anywhere in the UI. Tiles are
pictures. Never say loop, program, or debug.

**Prior art.** Logo (Papert built it for exactly this), [turtleSpaces](https://turtlespaces.org/),
[Turtletoy](https://turtletoy.net/), Scratch Jr's block strips, Bee-Bot.

**Shape.** Stateless (ADR 0008), single screen, canvas renderer. Pure-TS
interpreter engine (tile strip in, path segments out) with the renderer on
top - the silt/boids engine-vs-render split applies directly. Saved snails
and doodles in localStorage. Later: share a tile strip URL-hash encoded, per
boop's share-link model (ADR 0026).

**Open questions.** Age floor for the tile strip (pre-readers need pure
pictograms); whether a second snail (two strips racing) is v1 or later.
