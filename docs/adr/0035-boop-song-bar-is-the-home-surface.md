# 0035 — boop's song bar is the home surface; the grid opens as a card

- **Status:** Accepted
- **Date:** 2026-08-25
- **Supersedes:** [ADR 0030](0030-boop-fixed-frame-one-scroller.md) in part —
  its three-section frame stands, its "both bars are always visible and the
  grid absorbs the squeeze" model does not.
- **Related:** [ADR 0027](0027-boop-small-phone-layout.md) (the grid never
  shrinks — 6 × 16 at every width, unchanged and now honoured inside the card),
  [ADR 0031](0031-boop-saved-state-visibility.md) (the saved-state chrome, which
  must stay on screen at every width),
  [ADR 0033](0033-boop-laptop-column-fits-its-breakpoint.md) (the fixed-geometry
  column the card has to contain), and
  [ADR 0034](0034-boop-song-play-is-the-song-header.md) (song play as the song
  bar's header, which is what lets the bar carry it into the scrolling region).
  Spec: [`.scratch/boop-screenspace/spec.md`](../../.scratch/boop-screenspace/spec.md).

## Context

ADR 0030 built a fixed frame with the grid well and the song bar both
permanently on it, and both permanently squeezed. Ticket 23 pushed that model
to its end and it needed three props to stand up:

1. a three-rows-plus-loop-map `min-height` floor on the phone grid well,
2. a `max-height: max(32dvh, 100px)` cap on the ≥1024 dock, and
3. an exception below 505px of viewport height where boop stopped being a fixed
   frame and the whole page scrolled.

The third is the tell. 505 was the height at which no arrangement could keep
both play buttons clear of each other, so the answer was to abandon the frame's
central promise in a band. Two containers were competing for one screen and
neither could win.

A throwaway prototype put four arrangements on the real `/` route at every
width (`?variant=`, captured on the branch `boop-screenspace-prototype`): both
surfaces squeezed, the song behind a tap, the grid behind a tap, and a tabbed
pair. Grid scroller height, measured:

| Variant | Phone 390×844 | Tablet 1100×800 | Laptop 1440×900 |
|---|---|---|---|
| both on the frame | 327px | 323px | 385px |
| any one-surface variant | 332px | 388px | 439px |

## Decision

**The song bar is the home surface. The grid opens as a card.**

At every width the song bar is the scrolling region's whole content — it is
what a child lands on. The grid opens in a paper-card dialog (`ClipEditorCard`),
bottom-anchored below 1024 and centred at and above it, reached by two routes:
a tap on any clip chip, and a labelled launcher that is the dock's one row.

### Why the song was the half that stayed

The song is already the less discoverable half of the app. Hiding it makes a
real problem worse, so the half that goes behind a tap is the half a child
already knows how to find. The tabbed variant hid the song hardest — behind a
tab, with no standing presence at all — and was rejected for exactly that;
pointing the dialog at the song is the same mistake in a softer form.

Pointing it the other way puts the arrangement in front of the child by default
and makes the grid the focused thing they choose to open. It is also the only
variant that keeps every shared control permanently reachable at ≥1024, because
Speed lives in the song bar's header and that header is now always on screen.

### The three compromises: two retired, one retired and replaced

Each was removed and then measured, not assumed.

**The ≥1024 dock cap — retired.** It guarded a dock that held the growing song
bar; the dock holds a fixed-height clip launcher now. Measured with the cap
gone, the dock is **132px at 1280×600 and at 1280×900, one clip or five**,
against a cap that would have allowed 192. Every other number on the frame is
identical with it removed. `.stack` came off the dock's column with it — that
existed so a capped dock could shrink its one child.

**The 505px page-scroll exception — retired**, along with its two limbs: the
`max-height` twin on the phone well and the lane strip's own cap, both keyed to
`max-height: 504px`. Measured with all three gone, **page overflow is zero at
380, 420, 460, 492, 504, 505 and 520**, at one clip and at five, with both play
buttons uncovered at every one. The frame is fixed at every height again, which
was always the intent. The exception bought reachability by scrolling the
document; with one surface on the frame there is nothing left to buy.

**The phone grid's three-row floor — retired, and replaced with
`min-height: 0`.** This is the finding the ticket asked for, and it did not go
the way it was expected to.

Deleting the floor alone is *worse* than leaving it. `min-height` on a flex item
overrides the content-based automatic minimum, so removing it restores
`min-height: auto` and the well refuses to shrink below its full 460px of
content — measured, it then overflows a 405px card at 390×460 and takes the clip
control off the bottom of the screen. The correct retirement is `min-height: 0`,
which is the rule `Grid.module.scss`'s well has always carried.

The floor's stated reason is gone: it existed because the well and the song bar
fought over one scrolling region, and priority with no floor took the grid to
40px at 390×640 and to nothing at 460. The card bounds the grid now and the song
bar is nowhere near it — measured with the floor gone, **390×640 gives the rows
320px, not 40**.

What the floor does instead is spend its own button. Screenspace ticket 03 put
clip play *inside* the phone well (see below), so a floor that refuses to shrink
pushes the button under it below the fold. Measured with the floor on: clip play
landed at **y 381–429 on a 380px-tall window** and at **380–428 on a 667×375
landscape phone** — wholly off screen both times — and 13px below the fold at
390×420. That is precisely the conflict ADR 0030 already records for the laptop
well; ticket 03 brought it to the phone. The two renderers now agree: no floor,
at either width.

**The cost, stated.** At 390×460 the rows get 162px rather than the floor's 170
— the third row is 8px short there. Below about 455px of window the floor bought
nothing at all. The grid is now a straight function of the window (the card is
`max-height: 88dvh` and the fixed chrome between the card's edge and the rows is
243px), with no step in it anywhere.

### Where things ended up (decided by ticket 03)

- **The laptop playhead readout** — `Position 4 · bar 2 of 4` rode on
  `ClipHeader`, and `ClipHeader` is inside the card. It moved into **`SongBar`'s
  header row, immediately after "N bars"**: it reads the *song's* playhead, so
  it belongs with the song's other numbers, and the header stays on the frame
  when the card closes rather than disappearing with it. It shrinks and
  ellipsises so Speed is never what gives way in the tablet band. The phone is
  unchanged — its readout is on the WHOLE SONG caption row.
- **The phone's "+" New boop action** — the transport was its only phone home,
  and the transport is gone. It is the **first entry in the phone's "⋯" menu**,
  above My boops, with Clear grid still last as the one danger item. `TopBar`
  leads its own action group with New boop, so the two widths agree on the
  order. Rejected: a second button on the launcher row (that row is clip play,
  the clip's name and the way in — a whole-boop reset does not belong on it).
- **Clip play is the well's footer at every width.** The card is a modal with a
  dimmed backdrop, so the dock's launcher is unreachable while it is open. At
  ≥1024 `ClipControl` inside the well already answered that; below 1024 there
  was nothing, and a child editing a clip on a phone had no way to hear it.
- **The card is `--column-width + 36px` at ≥1024, on a 14px overlay gutter.**
  The card *contains* the fixed-geometry column, so its own horizontal padding
  adds to `--column-width` or the last steps are clipped. The gutter is 14, not
  the 32 a dialog would normally take: 14 + 18 = 32 at ≥1280 and 14 + 12 = 26 in
  the tablet band, which are the frame's own two numbers, so the card gives the
  grid exactly what the frame gave it.

## Consequences

- **A child no longer watches the grid clear.** On the phone, Clear grid is in
  the "⋯" menu and the grid is behind the card, so the action and its effect are
  never on screen together. Before, the grid was on the frame while the menu was
  open. This is a real cost and it is not fixed. The alternative is a second
  Clear button in the well, which the design forbids.
- **The two surfaces are never on screen together**, so the loop map (in the
  card) and the WHOLE SONG band (on the song bar) cannot be measured in the same
  breath. `HomePagePom` routes for this: helpers that act on the grid open the
  card first, helpers that act on the song bar or the chrome close it first, and
  assertions never route.
- ADR 0030's three-section frame, its pinned chrome and dock, its `min-height: 0`
  and its "do not fix the empty band by stretching the grid" all stand. What is
  superseded is the two-surface model those props existed to hold up.
- The nested-scroller exception ADR 0030 granted is narrower now: the well's
  scroll box lives inside the card, and the phone song bar's lane strip is the
  only nested scroller left on the frame itself.
- The frame has no height-keyed exception of any kind. `playBarPinned.iwft.tsx`
  keeps the 504/505 pair and points it the other way — every height in that band
  asserts the same promise, and one test resizes a single page across the old
  threshold so a step that came back would be visible. 380 and 420 were added
  because they are the heights the retired grid floor failed at.
- The dock is `flex: none` at every width again, with nothing in it that grows.
  Anything added to it costs vertical space on the screen that has least of it.
