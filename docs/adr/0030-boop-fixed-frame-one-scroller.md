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
> **The grid absorbs the squeeze first, and on its own** (settled by the repo
> owner after review). The well shrinks — `min-height: 0` — and the phone song
> bar does not: `flex-shrink: 0`, capped by `max-height: 100%`. So the well
> gives up every pixel of its slack before the lane strip gives up one. The
> first build shared the deficit out proportionally, which is what flex does by
> default, and the result was a chopped lane row under a scrollbar in a 49px
> box on the default one-clip phone screen while the grid still held 109px of
> slack — the opposite of "the grid scrolls, **not** the bar". No shrink factor
> above zero can express the ordering, because flex shares a deficit rather
> than queueing it. What holds the bar is the *absence* of `min-height: 0` on
> it: a flex item with `overflow: visible` keeps `min-height: auto`, the
> content-based automatic minimum, and refuses to go below its content. (An
> explicit `flex-shrink: 0` was tried and removed — measured across four
> viewport and clip combinations it changed nothing, because the automatic
> minimum had already done the job.) `max-height: 100%` then clamps that
> minimum, per flexbox §4.5, which is what makes the strip's scroller
> load-bearing: once five lanes on a very short window make the bar taller
> than the whole region, the cap stops it growing and the strip is what gives,
> never the header.
>
> **Priority needs a floor, or it takes everything.** Giving the bar absolute
> priority with nothing under the grid did exactly that: five clips at 390×640
> left 40px of grid — less than one 44px row — and a 460px-tall window left
> **none at all** from one clip upwards. The floor is `min-height` on
> `PhoneGrid`'s `.well`, at **three rows** plus the loop map (170px of rows,
> derived from that file's own geometry variables).
>
> Three rather than two is the repo owner's call, and the reason is how often
> two binds: on a 390×640 phone a child is pinned to the floor as soon as the
> song has three clips, which is the ordinary state of a song being worked on
> rather than a rescue case. A 120px window onto a 332px grid cannot show the
> kick and the boop at once, so placing a beat means scrolling a six-row
> instrument grid two rows at a time. Three costs about 50px more region
> scroll — at exactly the sizes where the region is already scrolling — and
> buys 50% more grid for it.
>
> It goes on `.well` and not on the scroll box inside it, because `.well` is
> the box flex shrinks and it is `overflow: visible`. The scroll box is not all
> it holds — 20px of padding and the 34px loop map sit outside it — so a floor
> there leaves `.well` free to shrink below its own content, and what comes off
> spills rather than clips. Measured at 390×460 with five clips and the floor
> on the scroll box alone, `elementFromPoint` over the song play button
> returned the instrument rail's artwork: the grid painting over the song bar.
>
> The floor is paid for by the region scrolling, which is allowed; the *page*
> never scrolls, and that part of this ADR is still absolute.
>
> The floor's cost is what makes `max-height: 100%` matter twice over. The
> region now scrolls on a short phone, and scrolling it is what could take song
> play back off the top — but a bar capped at the region's height can never
> have its top rise above the region's top, so at the bottom of the scroll the
> header lands at y=62, clear of the 52px chrome, instead of at y=41 behind it.
> Note that "behind it" is invisible to a viewport-intersection assertion, so
> the test for it asks the browser what is painted at the button
> (`verifyNotOccluded`).
>
> **The reason, and it is the whole reason:** a pinned bar a child can always
> reach beats a single-scroller rule. One scroller was only ever a means to that
> end. Everything else in this ADR stands — the three-section frame, the pinned
> chrome and transport, `min-height: 0`, and "do not fix the empty band by
> stretching the grid" (no nested box is ever `flex: 1`, precisely so it
> cannot).
>
> The cost is that the grid is the thing that gives way, and on a short window
> it gives way hard: at 1280×600 the scroll box measures **113px against 485px
> of content** — one row of the six and about half of the next — and the child
> scrolls the well for the rest. Two rows is the 1440 case, not this one. That
> is the trade the ticket was written to make, and it is a real one.
>
> The playhead column survives the move — it is `position: absolute` inside
> `.body`, which is still its containing block, so only clipping was at risk.
> The scroll box takes 8px of padding at laptop and 7px at tablet (with
> matching negative margins, ticket 25's trick) to hold the column's overhang.
> Note the symptom that padding prevents: overflowing content *grows*
> `scrollWidth` rather than being sliced, so the playhead-against-its-cell
> comparison cannot see it — the column and the cell move together. What the
> overhang actually does is give the well a sideways scroll it should not
> have. `playBarPinned.iwft.tsx` pins the column over the right cell at both
> number sets and with the well scrolled, and asserts that missing sideways
> scroll at 1440 on step 15, the one step whose overhang reaches past
> the last cell. Removing the laptop padding puts 8px back and turns that test
> red; the tablet block is symmetry only — at 1024–1279 the 924px grid never
> reaches the edge of its ≥940px body, and no test can see it go.

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
- **Open, from ticket 23: no test places a clip while the lane strip is
  squeezed.** Once the grid took a floor, the strip is only squeezed at
  390×460 with five lanes, and the placement tests run at 390×844 and 390×640
  where it is whole. Worth closing if the lane gestures are touched again.
- **Also open: the phone grid has a floor, the laptop and tablet one does
  not.** `Grid.module.scss`'s `.well` still carries ticket 23's
  `min-height: 0`, so at the five-clip cap the well is squeezed to 16px at
  both 1280×600 and 1440×700 — no grid rows, and the clip control drawn over
  the song bar. A floor there costs acceptance criterion 1 ("clip play in the
  viewport without scrolling at 1280×600"), because unlike the phone the play
  button is *inside* the well, at its foot, so the floor pushes its own button
  down by exactly the floor's height. 1280×600 has **220px** of well to give;
  a two-row floor needs 289px and the three-row floor the phone now uses needs
  **365px** at the laptop's larger geometry. The gap was 69px and is now
  145px — the owner's three-row call widened it rather than closing it, which
  is worth knowing before anyone tries to make the two renderers match. One of
  the two guarantees has to go: an open call for the repo owner, not a merge
  call.
- On a phone short enough for the region to scroll, adding a clip leaves that
  region scrolled past the grid: the picker's own scrolling is what moves it,
  and the child has to scroll back up.
- **There is a height below which song play is behind the pinned transport on
  a fresh one-clip load, and the floor's size is what sets it.** Measured on a
  390px-wide phone, one clip, at rest: clear at **494px and taller**, behind
  the transport dock at **492px and shorter**. At the two-row floor this cliff
  sat at ~450px, so the extra row moved it up by about 42px — the floor pushes
  the bar down, and on a short enough window it pushes it past the fold. Every
  viewport this suite tests, and the 360×560 of ADR 0030's own sticky-bar
  suite, sits above the cliff; a child on a shorter window than that reaches
  song play by scrolling the region, which is the same region they are already
  scrolling for the grid. It is recorded rather than fixed because raising the
  floor and lowering the cliff are the same lever pulled in opposite
  directions — you cannot have both without taking the play button out of the
  scrolling region altogether, which is a design change, not a merge call.
- Since ticket 23 the loop map sits at the foot of the phone well, *outside*
  the well's own scroll box rather than inside it. It is still glued under the
  grid and still inside the scrolling region — §3's point — and being outside
  the box is what keeps it on screen when the rows scroll, which is the whole
  job it has when the playhead is out of view.
