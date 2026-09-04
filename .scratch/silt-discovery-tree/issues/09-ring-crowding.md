# 09 - The ring does not scale: fire's chart is a crowd

**Status:** done (built on worktree-agent-aebff6377210aafd6, 2026-09-04)
**Type:** task
**Blocked by:** 08 (landed 2026-09-04 - the stage-species duplicate spokes are
gone; what follows sizes the residual problem)
**Absorbs:** 17 (spoke tiles cover arrowheads - same drawing pass, fixed here)
**Source:** PR #128 review feedback (Ed, 2026-09-04), with screenshot - fire's
ring at ~24 witnessed spokes: ring tiles overlap and clip at the panel edge,
outcome labels collide ("lava + sulphur" over "lava + moss"), the twelve
o'clock arc is a solid wall of arrowheads.
**Spec:** [../spec.md](../spec.md) §6 (ring), decision 7.

Decision 7 accepted the ring because "the panel shows one element at a time, so
the picture does not get busier as the roster grows" - true per element, but a
*hub* element's own ring still grows with every row that names it. Fire and
lava sit on the tag rows (`fire + [flammable]`, `lava + [everything]`), so
their degree grows linearly with the roster. `ringGeometry.ts` spaces spokes
evenly at one fixed radius (RING.radius 33), so beyond ~14 spokes the 40px
tiles overlap and the labels, at a fixed 0.62 along every spoke, land on their
neighbours.

## Decisions (Ed, 2026-09-04 triage)

Direction 1 - grouped spokes - with these rulings:

1. **Grouping key: (edge kind, outcome signature)**, NOT tag-row identity.
   Spokes on the focused element's ring merge when they are the same verb
   producing the same result, however the reaction table spells the rows -
   robust to ticket 15 having shipped eight literal acid rows, and to any
   future table refactor. The player sees "same verb, same result"; that is
   the unit.
2. **Rendering: mini-tile stack + count chip.** The partner position carries
   a small stack of member tiles - discovered ones in their colour, hidden
   ones as silhouettes (count-without-naming, the notch precedent) - plus a
   `4/7` progress chip. Every discovered member stays clickable to navigate.
3. **Group only above a threshold.** Below it, one spoke per pair keeps full
   fidelity; above it, every groupable set on that ring merges (never a
   partial mix of grouped and ungrouped spokes for one key). Derive the
   threshold from the geometry - the spoke count at which 40px tiles at
   RING.radius 33 stop fitting without overlap (~12-14) - as a named
   constant, not a magic number. The flip is computed at render from the
   witnessed degree, so a ring crossing the threshold regroups on next open;
   that pop is accepted.
4. **Ticket 17 is absorbed here**: give the product tiles a direction-aware
   side (above the label point on downward spokes, below on upward), so the
   tiles never sit on an arrowhead at any angle.

Counting does not change: witness/mastery stay per-pair (the chip is the
per-pair progress), mirroring 08's any-to-witness / all-to-master ruling.

## Tests

- ringGeometry: no two tile boxes overlap and no tile leaves the 0-100 box at
  the max real-world degree, both under and over the threshold (derive the
  degree from the graph, don't hardcode).
- ringGeometry/panel: at every spoke angle, the tiles' box does not intersect
  the arrowhead polygon (ticket 17's case).
- panelModel: grouped-spoke data shape (members, per-pair progress, hidden
  members as silhouettes), masking still via `refOf`; grouping keys on
  (kind, outcome), pinned against the eight literal acid rows collapsing to
  one spoke on sulphur's ring.
- panelModel: a ring at the threshold exactly does not group; one over does.
- iwft: open fire's ring fully witnessed; screenshot-free assertions on count
  of rendered spokes; mobile iwft on a downward spoke (tiles clear of heads).
