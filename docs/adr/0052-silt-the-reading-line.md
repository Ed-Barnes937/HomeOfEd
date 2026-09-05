# 0052 - silt: the ring is icons, and one reading line holds the words

- **Status:** Accepted (2026-09-05, landed with
  `.scratch/silt-discovery-tree/issues/25-reading-line.md`)
- **Date:** 2026-09-05
- **Related:** `.scratch/silt-discovery-tree/spec.md` §6 (amended by this
  change) and §7 (the spoiler policy this tightens);
  [ADR 0049](0049-silt-species-are-charted-as-elements.md) for the charted
  entry the line reads. Implemented in
  `apps/silt/src/features/fieldNotes/panelModel.ts` (`ReadingLine`) and
  `FieldNotesPanel.tsx`. Supersedes ticket 10's label arithmetic, which is
  deleted here.

## Context

Every spoke of the field-notes ring carried its outcome as text along its line.
Ticket 10 spent a geometry module stepping those words clear of the arrowheads,
and ticket 17 gave their product tiles a side of their own for the same reason.
Ticket 20 then measured the thing all of that was defending: at the ring's own
constants there are about **10.4 arc units of label room per spoke** at the
capacity of twelve, against real labels up to **16**. The words never fitted,
and no amount of stepping was going to make them. The phone had already
conceded the point - `.spokeOutcome` was `display: none` there.

A lettered ring is also the whole of the panel's spoiler surface: up to 24 text
sites per ring, each of which must mask an undiscovered name.

Ed adopted ticket 20's recommendation on 2026-09-05: the pattern PoE,
constellation UIs and Neo4j Bloom all converge on - an icons-only graph with one
detail region for the active node.

## Decision

1. **The ring draws tiles, names and arrowheads. No words along a line.**
   `labelPoint`, `outcomePoint`, `tileSide`, `RING.outcomeAt` and
   `RING.labelHalfHeight` are deleted with their tests. The arrowheads become
   the sole, now unobstructed, direction encoding.
2. **One fixed-height reading line under the ring holds the active spoke**, as
   a recipe of tiles with their names: `lava + water -> steam · obsidian`. It
   is the single place the panel puts an interaction into words, so the spoiler
   invariant has one text site to hold rather than two dozen.
3. **Reading and following split.** A ring tile *reads* its spoke into the
   band; a tile *in the band* is what follows an element. A mis-tap on a
   crowded ring no longer throws the player onto another element's chart.
4. **A ring tile is never disabled.** It used to be, for an undiscovered
   element, because it navigated somewhere the panel will not go (§7). It now
   reads, and a masked reading (`lava + - - -`) names nothing - so leaving it
   inert would have made a spoke with a hidden partner the one spoke nobody
   could read. The picker's rows are still inert: those navigate.
5. **The active spoke is sticky.** Hover, keyboard focus and tap all set it;
   only moving the ring to another element clears it. A line that emptied as
   the pointer left would take the reading away from whoever was reading it,
   and would flicker as a mouse crossed the ring.
6. **The band is the chips and the line, in that order** (ticket 19, absorbed):
   the chips describe the ELEMENT, the line describes the SPOKE. Both rows are
   fixed heights and scroll horizontally, so the ring above never jumps.

## Consequences

- The ring scales with the roster in a way it did not: a spoke costs a tile and
  an arc, never a label's width, so ticket 09's capacity is now the only limit.
- `Spoke.outcome` and `Spoke.tiles` are gone; `Spoke.reading` is a `ReadingLine`
  carrying the whole entry. Grouping folds on the reagents its members share,
  which lets the line list them properly and retires the `…` the ring wrote.
- A stage of one element's own life (ADR 0049) reads as that element alone: an
  arrow from a thing to itself says nothing, so the line draws no right-hand
  side for it.
- The reading line is announced to a screen reader (`role="status"`,
  `aria-live="polite"`) - a keyboard moves one spoke at a time and would
  otherwise get nothing, since focus is on the ring and the words are not.
- Rejected: keeping the words and shrinking the type (the measurement rules it
  out at any legible size), and lettering only the hovered spoke in place (the
  same arc, and it moves as the ring regroups).
