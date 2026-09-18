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

- [x] iwft at phone sizes: paint a note and a chord, drag a vertical
      cluster, scroll the step window horizontally and the rows box
      vertically with lanes present, collapse/expand, playhead behaviour with
      an off-screen pitched row (loop map still carries it).
- [x] Frame measurements at the ADR 0030 sizes with one and two pitched rows:
      the page never scrolls; clip play stays reachable.
- [x] No new nested scroller (or an ADR if one is truly needed - expected
      answer is none).

## Comments

**2026-09-18 - built. No tripwire; ADR 0063.**

**The gesture collision the ticket feared does not exist.** `touch-action:
pan-x` on the step window (ADR 0027 §3) already gives the browser the
horizontal pan and keeps every vertical gesture inside the window for us -
which is what lets a drum drag paint down through rows today. A finger that
wants to scroll the rows starts on the pinned rail, where nothing constrains
`touch-action`. So the lane inherits a vertical axis that was never scroll's,
and needs no new phone interaction model.

What was real was two smaller things, both in shared code:

1. A lane column reports the pointer with `pointermove` (ADR 0060 §6), which
   fires on the first pixel. On the phone `useDragPaint` is deferred, and the
   first report is exactly what proves a press is a paint rather than a swipe -
   so a lane handed it that proof for free. The hook now ignores an unlatched
   report naming its own origin. That also fixed a latent double-toggle on the
   same path (origin applied twice, on then off), which is what a finger that
   settles before it drags used to hit.
2. The tiles are `pointer-events: none`, so the laptop's tap paints through
   `pointerdown` and the tile's `onClick` is the keyboard's path only. Deferred,
   there is no pointerdown paint - so a tap on a phone lane did nothing at all
   until the column took the click too. All three mechanisms were
   mutation-checked: removing each turns a named test red.

**Geometry.** Row 156px: 16px tile on a 4px gap, which is the handoff's own
20-on-40 ratio on the phone's 32px column, and 20px hit bands. `PhoneGrid` owns
`--pitched-row-height` and the lane derives the tile from it, so the pinned rail
and the scrolling steps cannot disagree about a row's height; `verifyPitchedRowAligns`
measures both anyway. The plate keeps its vertical bleed and drops the
horizontal one - the strip is exactly 605px and `phoneWindow.ts`'s snap offsets
are arithmetic over that number.

**The rail.** 92px cannot hold a 32px plate, a name and a 44px chevron on one
line, so the chevron takes the first line beside the plate (83 of 92) and the
name drops to a full-width line below it, with the pitch key taking what is
left. A folded row is 60px, and the summary track fills all of it rather than
staying a 44px drum cell - which buys 5.7px of pebble travel per pitch against
the laptop's 4.6.

**Frame measurements**, 390px wide, rows-box content vs box:

| viewport | rows box | two lanes | one folded | both folded | all drums |
| --- | --- | --- | --- | --- | --- |
| 390x844 | 500 | 596 | 500 | 404 | 372 |
| 390x640 | 320 | 596 | 500 | 404 | 372 |
| 390x505 | 201 | 596 | 500 | 404 | 372 |
| 390x420 | 127 | 596 | 500 | 404 | 372 |
| 390x380 | 91 | 596 | 500 | 404 | 372 |

Two expanded lanes overflow the rows box and it scrolls, which is its job.
Folding one is exactly the 844 box. At every height above, with two lanes open
and with both folded, `verifyStageIsAFixedFrame` and
`verifyClipPlayInWellIsReachable` hold - the page never scrolls and clip play
stays whole and unoccluded.

**No new scroller**, and the inventory is now asserted rather than assumed:
`verifyGridScrollBoxes(['phone-step-window'])` walks the well and pins it.

**For Ed, on a real phone:** the 20px hit bands are the smallest touch targets
in the app. No test can say whether they suit a six-year-old's finger; if they
do not, `$lane-row-height` in `PhoneGrid.module.scss` is the one number to
change. Also worth an eye: the folded row against the drum rows around it, and
whether the pitch key earns its space on a 92px rail.
