# 20 - Label layout research: how do other apps and games label node graphs?

**Status:** ready-for-agent
**Type:** research
**Source:** local testing feedback (Ed, 2026-09-04) - "labels have moved and
are now off center and conflict with other labels, we should do some market
research to see how this is solved in other apps/games. A skill
tree/progression tree is a common thing."
**Spec:** [../spec.md](../spec.md) §6; ticket 10 moved the labels
perpendicular off the spoke (scaled by |ux|), which fixed the arrowhead
overlap but introduced off-centre labels and new label-vs-label collisions.

The ring has now had two rounds of local label surgery (10's perpendicular
step, 09's grouping). Ed's call: stop patching and look at how mature
skill-tree / progression-tree / node-graph UIs solve labelling, then decide
whether the ring keeps per-spoke text at all.

## Research questions

1. How do games with radial or tree progression UIs (e.g. Path of Exile's
   passive tree, Civilization's tech tree, Skyrim's constellations, crafting
   trees in survival games) handle node labels: always-on text, hover/tap
   reveal, a fixed detail panel for the focused node, or icons-only with a
   legend?
2. How do graph tools (Obsidian graph view, Figma FigJam, family-tree apps)
   handle label collision at density: hide-on-zoom, declutter/priority rules,
   leader lines, halo text?
3. What is the common pattern on touch screens specifically, where hover does
   not exist?

## Deliverable

A short findings doc (`.scratch/silt-discovery-tree/research/20-label-layout.md`)
with: the 3-4 dominant patterns, which games/apps use each, and a
recommendation for silt's ring (desktop + phone sheet) that respects the
spoiler policy (spec §7). A follow-up build ticket gets written from it - this
ticket changes no code.
