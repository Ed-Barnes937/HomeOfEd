# 11 - A key for the line kinds

**Status:** ready-for-agent
**Type:** task
**Source:** PR #128 review feedback (Ed, 2026-09-04) - "can we add a helper for
what the different line types in the field notes mean".
**Spec:** [../spec.md](../spec.md) §6 (edge kinds: reaction solid, decay
long-dashed + arrowhead, growth dotted + arrowhead; hook edges per ticket 07).

The chart speaks a small visual language (line style = edge kind, arrowhead
into the centre = the pair produces the focused element) and nothing in the
panel teaches it.

## Design

- A small "key" affordance in the panel - a toggle in the panel footer or
  beside the counters, opening a compact static block: one short sample line
  per edge kind actually present in the graph (derive the kinds list, don't
  hardcode - a new edge shape joins the key for free), plus one line for the
  arrowhead rule and one for the still-to-find notches.
- Static text and sample strokes only - it names no element, so the spoiler
  invariant (§7) is untouched by construction.
- Same chrome vocabulary as the rest of the panel (ink border, Silkscreen
  labels); collapsed by default, remembers nothing.
- Phone sheet gets the same block at the sheet's foot.

## Tests

- panelModel (or a tiny legend model): the rendered kind list equals the set of
  kinds in the derived graph.
- iwft (thin): open the panel, toggle the key, the decay row is visible.
