# 18 - A grouped entry can read 9/9 while its star still waits

**Status:** ready-for-agent
**Type:** task
**Source:** found during ticket 08 (2026-09-04) - its spec review flagged that
decision 1's two halves pull apart on elements owning a grouped entry.
Recorded in spec decision 11; the code implements the ruling as written.
**Spec:** [../spec.md](../spec.md) decision 11, §7.

Ticket 08's ruling: a grouped entry is witnessed by *any* underlying raw edge
and mastered only by *all* of them. The picker row counts charted entries, so
on the five elements that own a grouped entry (flower, fire, lava, acid, seed)
the row can read `9/9` with `still to find: 0` while the star has not lit -
and the raw edges it waits on are ones the panel may not name (spec §7), so
the player cannot be told what is missing. Hunting was removed from the counts
but not from the star. Mud is unaffected (its six entries are one raw edge
each), so the unlock and completion moments stay honest today - but ticket 14
generalises unlocks to every mastered element, which raises the stakes: a
player staring at 9/9 with no star has no visible path to the unlock.

## Directions to choose between

1. **Count sources, not entries, in the picker row** (`12/15` where 15 is raw
   edges): the numbers and the star agree again, at the cost of the row's
   denominator no longer matching the ring's spoke count.
2. **A partial-progress state on the grouped spoke**: the ring's `4/7` chip
   (ticket 09's rendering) already shows where the gap is; the picker row
   keeps charted counts but shows a hollow/partial star until mastered. The
   gap is visible without naming anything - the chip counts silhouettes.
3. **Relax mastery to any-edge too**: star lights with the count. Simplest and
   most legible, but mastery stops meaning "seen everything this element
   does", and 14's unlocks get cheaper exactly where the roster is richest.

Option 2 pairs naturally with 09 (the chip exists there) and keeps 08's
ruling intact; it is the natural recommendation once 09 lands.

## Decision (Ed, 2026-09-05 triage)

**Option 2: the partial star.** Landed context since this was written: ticket
25's reading line shows a tapped grouped spoke's member silhouettes and its
x/y chip in the band, so the gap is already visible without naming anything -
the star just has to stop overstating.

## Design

- A third star state: **hollow/partial** when every charted entry involving
  the element is witnessed but some raw edge behind a grouped entry is not;
  the filled star stays all-raw-edges (mastery, the unlock trigger,
  unchanged). Elements whose entries are all single-source can never show it.
- Where a star renders, the state renders: the picker row and the FocusName
  (ring centre on desktop, header band on phone). Screen-reader text tells
  the states apart ("mastered" vs "more to see here").
- No store change, no derivation change beyond exposing the distinction the
  entry sources already carry (isWitnessed vs the mastered set).

## Tests

- panelModel: a grouped element with all entries witnessed but one raw edge
  missing reports partial (not mastered); all raw edges flips it to mastered;
  a single-source element never reports partial. The pinning case: row count,
  ring footer and star cannot contradict each other.
- iwft (thin): seed flower to all-entries-witnessed-minus-one-raw-edge; the
  row shows the hollow star; seed the last edge; it fills and EARNED gains
  flower.
