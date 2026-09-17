# 08 - The pitched lane on the phone

**Status:** ready-for-agent
**Blocked by:** 06, 07

**What to build:** `PhoneGrid` renders pitched rows inside the existing
pinned-rail + snap-scrolling step window, on the phone's own column sizes
(spec §2/§8). The lane's vertical paint gesture must coexist with the
paint-vs-scroll rules in `PhoneGrid.tsx`'s header (browser owns horizontal
pans via `touch-action: pan-x`; a tap toggles; a drag paints after crossing a
cell boundary) - a vertical drag inside a lane paints a cluster, and the rows
box must still be scrollable when the touch starts outside a lane. Collapse
(ticket 07) is expected to carry most of the vertical-space load on phones.
The unbreakable rules: playback never scrolls on either axis (ADR 0042), the
fixed frame and its nested-scroller inventory stand (ADR 0030/0035), no row
or step may be dropped at any breakpoint.

**Tripwire (grill Q2):** if the 8-cell lane structurally fights the strips
model - not "needs care" but "cannot be made to work without inventing a new
phone interaction model" - stop, write up the conflict in this ticket, set
Status: ready-for-human, and kick phone back to the design project.

Acceptance criteria:

- [ ] iwft at phone sizes: paint a note and a chord, drag a vertical
      cluster, scroll the step window horizontally and the rows box
      vertically with lanes present, collapse/expand, playhead behaviour with
      an off-screen pitched row (loop map still carries it).
- [ ] Frame measurements at the ADR 0030 sizes with one and two pitched rows:
      the page never scrolls; clip play stays reachable.
- [ ] No new nested scroller (or an ADR if one is truly needed - expected
      answer is none).

## Comments
