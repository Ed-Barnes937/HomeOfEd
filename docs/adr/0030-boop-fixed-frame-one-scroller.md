# 0030 — boop's stage is a fixed frame with one scrolling region

- **Status:** Accepted
- **Date:** 2026-08-09
- **Related:** [ADR 0027](0027-boop-small-phone-layout.md) (the phone's pinned
  rail and horizontal step window, whose scroll model this wraps), the design
  handoff ([`docs/reference/boop-design/README.md`](../reference/boop-design/README.md),
  §1 "Main screen — laptop" and §3 "Main screen — small phone", both amended).
  Implements ticket 33; gated by the layout prototype, ticket 37.

## Context

The design handoff opens with "a single fixed-height column, no page scroll",
but the build only ever expressed that as `min-height: 100dvh` on the stage
with no overflow control. On any window shorter than the stack — a laptop with
a short window, and every phone — the *whole column* scrolled, transport
included. Ed's V1.1 feedback was the symptom: the play button looks wrong sat
in the middle of the screen, and it can scroll away entirely.

Two questions had to be answered, and one of them could not be answered on
paper.

## Decision

### 1. The stage is a three-section frame, not a scrolling page

`.stage` is `height: 100dvh; display: flex; flex-direction: column` holding:

| Section | Flex | Contents |
|---|---|---|
| chrome | `flex: none` | `TopBar` (desktop) or `PhoneBar` (phone) |
| scroller | `flex: 1; min-height: 0; overflow-y: auto` | the grid well, then the preset row |
| transport dock | `flex: none` | `Transport` |

**The grid well's region is the only scrolling region.** `min-height: 0` is
what allows it to shrink below its content inside the flex column; without it
the frame grows and the page scrolls again.

Pinning by flex layout rather than `position: fixed` was deliberate: a fixed
bar would need a z-index, would overlap the content it is meant to sit below,
and would need scroll padding underneath it so the last row is reachable. A
`flex: none` sibling needs none of that.

The frame's horizontal padding sits on each of the three sections rather than
on `.stage`, so the preset row's phone full-bleed strip (a `-12px` margin) still
bleeds into padding belonging to the scrolling region instead of overflowing it
and giving that region a sideways scroll of its own.

The preset row moves *above* the transport, inside the scroller — the transport
has to be the last thing in the frame, and the preset row is on its way into a
dialog anyway (ticket 36).

> **Updated by ticket 36.** The preset row is gone from the main screen, so the
> scroller now holds the grid well alone and the full-bleed strip that forced
> per-section padding no longer exists. Per-section padding stays: it is also
> what keeps the pinned bars aligned with the scrolling grid, and it is where
> the transport's safe-area `padding-bottom` lives. The consequence for the
> "empty band on a tall window" below is the one already anticipated there —
> the band is larger, not smaller.

> **Amended by ticket 23 (post-launch feedback) — the one-scroller rule has an
> exception.** "The grid well's region is the only scrolling region" turned out
> to reach the wrong result on a short window. The region carries the grid well,
> and the well carries a play button on both layouts — the clip control at
> ≥1024, the song bar's header on the phone. So the thing that scrolled away was
> the thing the rule existed to keep on screen, just one level in: at 1280×600
> the clip play button was off the bottom of the region, and at 390×640 so was
> song play.
>
> A **nested scroller is therefore allowed inside the grid well and inside the
> phone song bar**, and nowhere else. The well is a flex column of the region's
> height whose rows scroll in their own box (`Grid`/`PhoneGrid`'s `.wellScroll`)
> with the footer under them at `flex: none`; the phone song bar is the same
> shape with its header pinned and the lane strip scrolling
> (`PhoneSongBar`'s `.lanes`). The scrolling region's column
> (`HomePage.module.scss`'s `.stack`) is what gives the well a height to shrink
> against — nothing in it grows, so a tall window is exactly as it was.
>
> **The reason, and it is the whole reason:** a pinned bar a child can always
> reach beats a single-scroller rule. One scroller was only ever a means to that
> end. Everything else in this ADR stands — the three-section frame, the pinned
> chrome and transport, `min-height: 0`, and "do not fix the empty band by
> stretching the grid" (the nested box is `flex: 0 1 auto`, never `flex: 1`,
> precisely so it cannot).
>
> The cost is that the grid is the thing that gives way: at 1280×600 about two
> rows of it are on screen at a time and the child scrolls the well for the
> rest. That is the trade the ticket was written to make. The playhead column
> survives it — it is `position: absolute` inside `.body`, which is still its
> containing block, so only clipping was at risk: the scroll box takes 8px of
> padding at laptop and 7px at tablet (with matching negative margins, ticket
> 25's trick) to hold the column's overhang, and `playBarPinned.iwft.tsx` pins
> it over the right cell at both number sets and with the well scrolled.

### 2. The bar is inset to the column, not full-bleed — decided by prototype

Ticket 33 was grilled to a **full-bleed** bar with its contents aligned to the
1356px column, on the argument that a bar inset to the column would read as a
floating toolbar rather than as chrome. That argument did not survive being
seen on a screen.

The [layout prototype](../../.scratch/music-app/issues/37-bottom-bar-prototype.md)
built three variants — today's page scroll, the full-bleed bar, and the inset
bar — at laptop-short and phone. Ed chose the **inset** bar: it reads as the
transport, in the place a child already knows it from, and full-bleed is heavier
chrome than the screen needs.

So the transport keeps its existing treatment exactly (`max-width:
var(--column-width)`, `margin-inline: auto`, radius 20px,
`rgba(255,255,255,.075)`, its own 22px inset) and is simply pinned, plus a drop
shadow so it reads as sitting over the grid. The play circle still lands under
the instrument plates, because nothing about the bar's internal geometry moved.

### 3. ADR 0027's scroll model is wrapped, not changed

The phone grid's horizontal snap window now lives *inside* a vertical scroller.
Everything ADR 0027 §3 decided still holds unchanged: `touch-action: pan-x` on
the window, tap-to-toggle, drag-paint latching only after a cell boundary, and
playback never scrolling the window. The loop map also stays inside the
scrolling region, glued under the grid — if it migrated into the pinned bar,
0027's "the playhead moves from the grid to the map" would stop being a local
relationship and the map would become a second, competing transport.

This is asserted rather than assumed: `stickyBottomBar.iwft.tsx` re-runs the
snap, paint and loop-map behaviours at a short 360 × 640 phone viewport.

## Consequences

- On a tall window and on the phone, the grid is short and the bar is pinned
  low, so a large empty band sits between them. Ed accepted this as the cost of
  the fixed frame — **do not fix it by stretching the grid.** Ticket 36's
  dialog removes the preset row, which makes the band larger, not smaller.
- The iOS safe area is now the transport container's own bottom padding
  (`calc(12px + env(safe-area-inset-bottom))`), because the bar is inset rather
  than full-bleed.
- The phone tempo block has to be shrinkable: an `<input type="range">` keeps
  its intrinsic width under `flex: 1`, which overflowed the bar once ticket 36's
  New boop button was placed beside it. `min-width: 0` on the slider and its
  track row, with 28px / 24px endpoint labels.
- Anything added to the main screen from here belongs in the scrolling region
  by default. Adding to either pinned bar costs vertical space on the screen
  that has least of it.
- Since ticket 23 the loop map sits at the foot of the phone well, *outside*
  the well's own scroll box rather than inside it. It is still glued under the
  grid and still inside the scrolling region — §3's point — and being outside
  the box is what keeps it on screen when the rows scroll, which is the whole
  job it has when the playhead is out of view.
