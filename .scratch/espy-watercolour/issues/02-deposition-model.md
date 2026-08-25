# 02 — Emergent watercolour: refactor the field onto a deposition model

**Type:** grilling → prototype → task
**Status:** ready-for-human

**Not blocked**, but ticket 01 first is sensible: the deposition model wants a
paper height field to granulate against, and 01 produces one.

**The goal:** espy's marks should get their watercolour character from a
simulated process rather than from post-processing. Rim pooling, granulation and
edge feathering should *emerge*, so they scale with the mark instead of being
applied at fixed magnitude.

Technique reference:
[`docs/reference/watercolour-technique/README.md`](../../../docs/reference/watercolour-technique/README.md)
§2–4 and §9 items 7–10. Implement from the Curtis et al. 1997 model as described
in the study — do **not** port sudoaquarelle source (unlicensed).

## Why this is a refactor and not a tweak

Today the pipeline is: pick a brush archetype → lay gaussian lobes
(`fluid.helpers.ts`) → bloom them through a stable-fluids sim → threshold the
dye buffer and paint on a rim band and a noise grain (`displayFragment`).

The silhouette comes from lobe *geometry*, and the watercolour character comes
from *post-processing*. A deposition model inverts both: the silhouette comes
out of water and pigment transport, and the character comes out of where
pigment settles.

Concretely that touches most of `displayFragment`, a good part of
`DEFAULT_TUNING`, and the meaning of `fluid.helpers.ts` — its brush archetypes
become seeding hints for a simulation rather than a description of the final
shape. It may also let `MIN_BLOBS = 3` in `engine/layout.ts` go, since that
floor exists precisely because our distortion is fixed-magnitude.

## The central unknown

**Their sim runs continuously and interactively. Ours blooms for ~1500ms,
freezes, and bakes to a bitmap.** Edge darkening in the reference is driven by
*drying* — the ring only fully develops while the sheet actively dries, and
their engine has a forced-dry mode that cranks evaporation 12×.

So espy needs the whole wet→dry arc to complete inside the bloom window, or the
window has to change, or the model needs a different forcing. Nobody has
established which. This is the first thing to settle.

## Shape of the work

**1. Grilling** — align on the outcome before any code. Questions to put to Ed:

- What is actually wrong with the current field, in his words? The study is a
  technical answer to a question that has not been stated as a *product*
  complaint yet.
- Does the mark still need to be a recognisable "creature blob" that a child
  draws a face onto, or is a looser, more painterly shape acceptable? The
  archetypes exist so a page reads as visibly different shapes — does an
  emergent model preserve that, and does it need to?
- Is the bloom window negotiable? A longer bloom is more time watching before
  drawing.
- Monochrome stays (ADR 0016), so full Kubelka-Munk with 52 pigments is out of
  scope — but is a single-pigment K-M with saturating dilution worth it purely
  for how the wash falls off?
- What is the acceptance bar: "reads as watercolour to Ed", or something
  testable?

**2. Prototypes** — throwaway, outside the app, answering:

- Can a deposition model settle convincingly within the bloom window? Try both
  a real-time arc and a forced-dry ramp.
- Does emergent rim pooling actually look better than our current painted band
  at phone scale, where the current one fails?
- Cost on a mid-range phone. We are adding passes per frame to something that
  already runs a fluid sim, and espy is a calm toy, not a demo.
- Does invasion-percolation feathering justify itself over the existing
  smoothed threshold?

**3. Decide, then ADR.** The outcome changes espy's rendering model, so it needs
an ADR alongside or amending ADR 0016 before implementation.

**4. Implement**, once the above has landed. Split into follow-up tickets at
that point — do not try to specify them now.

## Constraints that hold regardless

- Monochrome, single fixed sketchbook look (ADR 0016). No theme or ink-engine
  switcher.
- The one hard boundary: `engine/*` and the fluid pure helpers stay pure TS.
- The field is baked and frozen; undo/resize/save redraw the bitmap. If a
  proposal changes that, it changes ADR 0016 and must say so explicitly.
- Undo stays command-replay over `Op[]`, not raster snapshots.
- Must degrade to the plain-blot fallback without WebGL.
- Do not grow `fluid.tuning.ts`. If prototypes need knobs, they live in the
  prototype.

## Acceptance criteria

_(for the grilling-and-prototype phase — implementation criteria come later)_

- [ ] Grilling done; the outcome Ed actually wants is written down.
- [ ] Prototypes answer the bloom-window question with something demoable.
- [ ] Mid-range phone cost measured, not guessed.
- [ ] A go / no-go recorded, with the reasoning.
- [ ] If go: an ADR, and follow-up implementation tickets.
- [ ] If no-go: the cheap wins from study §9 items 1–6 that were not taken in
      ticket 01 are captured as their own ticket, so the study does not go to
      waste.

## Comments

_(none yet)_
