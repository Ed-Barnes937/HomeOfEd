# 0016 — karesansui: port the reference geometry verbatim, treat the mechanism as decorative

- **Status:** Accepted — **amended 2026-07-09** (see [Amendment](#amendment-2026-07-09--plan-0007--adr-0017-level-2-pen-fidelity): the mechanism pen is no longer purely decorative; it now rides the true `geom()` point).
- **Date:** 2026-07-09
- **Related:** [0006-karesansui-implementation-plan.md](../plans/0006-karesansui-implementation-plan.md)
  §1 (D3, D4), §5 (reference-porting map); [0008-apps-without-a-database.md](0008-apps-without-a-database.md);
  amended by [0007-karesansui-architectural-redesign.md](../plans/0007-karesansui-architectural-redesign.md) / ADR 0017

## Context

karesansui was handed off as an HTML/CSS/JS design mock
(`reference/karasensui/project/Zen Gear Garden Studio.dc.html`) whose look
comes from a specific curve formula — a generalized-epicyclic ("summed-cosine")
`geom()`: a carrier circle plus one cosine/sine term per gear-train wheel,
scaled to fit the sand board. The mock's left panel also draws an illustrative
gear-cluster mechanism (`drawMech`) that visually suggests the ring/wheel train
but does not model true gear meshing — it does not share the same pin formula
as `geom` and is driven only by a carrier-angle progress value.

The handoff bundle's own instructions (`reference/karasensui/README.md`) say
to "recreate them pixel-perfectly" — match the visual output, not the
prototype's internal structure. The bundle also contains a second exploration
file, `Zen Gear Garden.dc.html`, with layout/sand studies and an unrelated,
unused classic-hypotrochoid formula (`spiroPts`/`drawSpiro`) — a different
curve family than the Studio's `geom()`. Nothing in the shipped app should be
derived from it.

## Decision

- **Port `geom()`, the rake/emboss shading (`sandFill`/`trace`/`emboss`/
  `rakeSegment`/`rakeStyle`), and `drawMech`'s illustration verbatim** from the
  Studio reference, adjusted only to TS/module form (`engine/geom.ts`,
  `engine/gears.ts`, `render/sand.ts`, `render/MechRenderer.ts`). No
  re-derivation, no "physically correcting" the math — the goal is a
  pixel-accurate match to the handed-off design, not a from-first-principles
  gear simulation.
- **Treat the mechanism panel as decorative**, decoupled from the sand curve.
  `MechRenderer.draw(config, carrierT)` is driven by carve progress (`t =
  geom.tMax * progress`) purely to look synchronized; it is not consulted by
  `geom()` and `geom()` is not consulted by it.
- **Ignore `Zen Gear Garden.dc.html`'s `spiroPts`/`drawSpiro`.** That file is
  reference-only exploration (layout/sand studies); its curve formula is a
  different, unused family and must not leak into `engine/geom.ts`.

## Consequences

- Fast to build and faithful to the handoff: the sand pattern and the
  mechanism drawing look exactly like the Studio mock, because the math is the
  same math.
- The gear ratios shown in the mechanism panel are **not physically rigorous**
  — the cog cluster's teeth counts and spin are cosmetic, not a real epicyclic
  gearbox, and the sand curve's math is not derived from actual gear meshing
  (it's a generalized-epicyclic curve chosen for its look, not simulated from
  a train of physical gears).
- Reviewers who read the code and expect the mechanism to explain the pattern
  will find it doesn't — this is intentional and documented here, not a bug.

## V2 / considered-but-deferred

A future engine could model a **physically-accurate gear train** — real tooth
meshing, ratios derived from actual ring/wheel geometry — so the sand curve is
a genuine consequence of the gearing shown, and the mechanism panel visualises
the real thing instead of an illustration keyed to progress alone. Deferred
because:

- It would change the visual output (the current look is the point — it's
  what was handed off and approved).
- It is not needed for the toy to be satisfying to use; the current fidelity
  bar (D3) is "matches the mock," not "is mechanically simulated."
- No consumer has asked for it; building it now would be speculative.

If undertaken, it's additive: a new engine module alongside (or replacing)
`geom.ts`, with `MechRenderer` driven by the same real ratios instead of a
cosmetic progress value. The existing `geom()`/`drawMech` port would either be
kept as a "classic" mode or retired once the new engine matches the current
look closely enough.

## Amendment (2026-07-09) — plan 0007 / ADR 0017: Level-2 pen-fidelity

The architectural redesign ([plan 0007](../plans/0007-karesansui-architectural-redesign.md),
ADR 0017) upgrades the mechanism from *fully* decorative to **Level-2
pen-fidelity**, and changes `MechRenderer`'s API from `draw(config, carrierT)`
to `setPattern(config)` + `draw(progress)`.

- **The pen is now honest.** `MechRenderer` builds its own `geom()` fit to the
  mech bowl radius and places the pen on the **true `geom()` point** every frame
  (indexed by carve progress). The pen visibly leads the *same curve* the sand
  carves — same shape, smaller scale (the mech bowl is smaller than the sand
  bowl; captions say "same curve", not "same size").
- **1 cog → an honest single-wheel spirograph.** A wheel of radius `W0` at the
  real carrier position `(R−W0)·(cos t, sin t)`, spun by `−(R/W0)·t`, on the same
  scale as the pen path — so the pen genuinely sits on that wheel.
- **2–3 cogs → the cluster stays illustrative.** For a multi-term summed-cosine
  curve there is no single rolling wheel to draw, so the ported abstract cluster
  is kept and an **arm is drawn to the exact `geom()` pen point**. The cluster is
  decorative; the pen is exact. Full physical honesty for multi-cog trains (the
  "nested carriers" idea above) remains the deferred next step.

What is unchanged: `geom()`, the rake/emboss shading, and `drawGear`/`drawRing`
are still the verbatim port (D3); the engine is untouched. `Zen Gear Garden.dc.html`'s
`spiroPts`/`drawSpiro` is still off-limits.
