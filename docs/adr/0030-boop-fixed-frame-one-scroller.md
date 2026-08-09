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
