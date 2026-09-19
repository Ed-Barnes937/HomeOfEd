# wayfarer - maps of places that don't exist

**The toy.** A blank parchment and terrain brushes: coastline, forest,
mountains, marsh, river (rivers insist on flowing downhill to the sea). Stamp
towns and dragons, name everything with a wobbly-label tool, and the map
frames itself - border, compass rose, and a legend that builds automatically
from whatever you used. Fantasy cartography as a drawing toy: espy's calm,
pointed at world-building.

**The play loop.** Kids draw treasure maps unprompted; this makes the result
look *real*. Naming is half the fun (see nightjar). A finished map begs for a
story, which begs for another map.

**The stealth payload.** Map literacy as tooling: the legend, the compass, and
the scale bar are things your map *has*, so reading them elsewhere is
automatic. The river tool teaches watersheds by refusing to flow uphill.
Contour shading, coastline logic, why towns sit on rivers and coasts (a gentle
"good spot for a town" glow) - geography's grammar, learned by authoring
instead of reading.

**Stealth discipline.** No real-world geography content at all. The transfer
happens the first time the kid meets an OS map and already knows how to read
it.

**Prior art.** Inkarnate/Azgaar's fantasy-map generators (grown-up tools; the
gap is a child's version), Tolkien's maps, every tea-stained treasure map.

**Shape.** Stateless. Espy is the architectural sibling: layered canvas,
pure-TS brush/terrain engine, maps in localStorage, PNG export for printing
(home educators print things). The river/downhill constraint needs a cheap
heightfield under the painting - the interesting engine decision.

**Open questions.** Freehand-first or tile-assisted (freehand fits the house
style; tiles produce prettier maps for younger kids); label typography that
survives small screens.
