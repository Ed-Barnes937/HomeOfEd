# 0027 — boop's small phone gets a pinned rail and a scrolling step window

- **Status:** Accepted
- **Date:** 2026-08-06
- **Related:** [ADR 0023](0023-fridge-mobile-chrome.md) (the fridge's mobile
  chrome, whose 52px strip this ports), the design handoff
  ([`docs/reference/boop-design/README.md`](../reference/boop-design/README.md),
  "Main screen — small phone"), and the spec's "The grid" /
  "Accessibility & input"
  ([`.scratch/music-app/spec.md`](../../.scratch/music-app/spec.md)).
  Implements ticket 27.

## Context

boop's grid is **6 × 16 and never shrinks** — the spec is explicit that no
breakpoint may drop a row or a step. The tablet layout needs
`124 + 14 + 16×42 + 12×6 + 3×14 = 924px` plus 52px of frame padding, so 1024px
is the narrowest viewport it fits. A 390px phone is 634px short.

The design handoff answers this in full, and its numbers are final: pin the
instrument rail at 92px, scroll the 16 step columns inside a ~246px window that
snaps to the four 4-step groups, and put a 16-tick "WHOLE LOOP" map underneath
so the playhead is never lost when it is off screen.

Three things had to be decided to build it.

## Decision

### 1. A second renderer, not a responsive one

`PhoneGrid` renders below 1024px; `Grid` renders at and above it. They share
their props type (`GridViewProps`), the latched drag-paint (`useDragPaint`) and
the preset-load stagger (`useLoadStagger`), but own their own DOM and SCSS.

The phone's structure is genuinely different — the rail is a sibling *column*
of the scroller rather than the first child of each row, and the playhead lives
inside the scrolling strip — so one responsive component would be a pile of
breakpoint branches over a layout the two cases don't share. The cell markup is
duplicated as a result; that is the accepted cost, and the desktop layout is
pixel-final so leaving it untouched is a feature.

### 2. The breakpoint is width-only, unlike the fridge

[ADR 0023](0023-fridge-mobile-chrome.md) gives the fridge compact chrome on
*any* coarse pointer, tablets included. boop does the opposite: `useIsPhone` is
`(max-width: 1023px)` and nothing else. boop's tablet layout is the **primary**
target and is entirely touch-designed — an iPad in landscape should get the
real grid, not the scroll window.

### 3. Paint and scroll split by axis, and the first cell waits

Inside the step window a horizontal drag is ambiguous: it is both the paint
gesture and the swipe gesture. The split:

- `touch-action: pan-x` on the window hands **horizontal** pans to the browser.
  A sideways swipe scrolls, snaps to a bar line, and never paints. This is
  ticket 15's blanket `touch-action: none` deliberately relaxed — scoped to the
  window, so page pinch-zoom is unaffected either way.
- **Vertical** drags stay ours, so painting down a column across instruments
  works as it always did.
- A **tap** toggles one cell, via the `click` that a scroll gesture never
  produces.
- The pointer-down cell is **not** flipped immediately (`useDragPaint`'s
  `applyOnPointerDown: false`). A child starting a swipe on a cell must not
  come back to a note they didn't mean to make; the latch is committed only
  once the drag crosses into another cell.

Horizontal drag-paint is therefore unavailable on a phone. Tap and vertical
drag remain, and the alternative — reserving the 5px inter-cell gaps as the
only scroll affordance — is not something a six-year-old's finger can hit.

### 4. The chrome's save icon borrows the panel's "Saved it" moment

> **Superseded by ticket 32 (V1.1 feedback).** The "Saved it" moment is gone:
> "My boops" now carries an always-on, always-prefilled save form, so opening
> the panel *is* being ready to save. The icon therefore only opens the panel —
> it no longer saves on mount, and `saveOnOpen` is gone with it. The layering
> below is unchanged.

The 52px strip has a save icon but no room to confirm anything, and the design
handoff's §5 "Saved it" moment — the prefilled name field, with the save already
done — lives inside "My boops". So the icon does both: it saves and it opens
the panel already in that state (`BoopsPanel`'s `saveOnOpen`). One save path,
one confirmation, identical on both breakpoints; the alternative was a
phone-only toast, which the design rules out everywhere else.

This also fixes the layering the ported chrome brought with it. The strip sits
at `z-index: 30` (its menu at 31) so it clears the grid well, but it is now what
*opens* the overlays — so the overlays have to clear it in turn: boops panel
40, hint sheet 41, confirm card 42 (topmost, since a confirm can be raised from
inside the boops panel).

> **Amended by [ADR 0030](0030-boop-fixed-frame-one-scroller.md) (ticket 33).**
> The step window now sits inside a *vertically* scrolling region — the stage
> became a fixed frame with pinned chrome and a pinned transport. Everything
> §3 decides is unchanged and is re-verified at a short phone viewport in
> `stickyBottomBar.iwft.tsx`; the loop map stays inside that scrolling region,
> under the grid, rather than joining the pinned bar.

> **Amended by the boop-playhead effort (ticket 06).** The loop map is now also
> the phone's clip scrubber, and a `WHOLE SONG` band joins it in the phone song
> bar. Both are **non-scrolling** bands — which is the loop map's own argument
> from §1, now carrying the playhead on the song axis too — and both split axes
> the way §3 does, one step further:
>
> - `touch-action: pan-y`, not the playhead handoff's `touch-action: none`.
>   Horizontal gestures are the scrub and are ours; **vertical** pans belong to
>   ADR 0030's one scrolling region, which both bands sit inside. `none` would
>   trap a finger that lands on a band.
> - The press decides nothing, and the gesture must *prove* it is a scrub
>   (`useScrubDrag`'s `applyOnPointerDown: false`, §3's rule for the same
>   reason). The proof is that the pointer has travelled further across the band
>   than down it — the continuous-axis form of §3's "crossing a cell boundary is
>   what proves this is a paint", and it is the guard that matters, because the
>   browser sends a `pointermove` or two before it claims a touch scroll and
>   sends `pointercancel`. A press that barely moves is still a tap, and scrubs
>   on release. The laptop strips keep the immediate press — they are in a pinned
>   bar that cannot scroll.

## Consequences

- Playback **never** scrolls the window. The loop map carries the playhead and
  an edge glow marks the side it is on, exactly as the handoff specifies.
- The last snap position is the end of the strip (359px), not the fourth bar
  line (462px, unreachable). This is forced: step 16 is not visible from any
  bar line, and the grid may never hide a step. Three of the four settling
  positions are bar lines; the fourth is the end of the loop.
- Clear grid has one home per breakpoint — the transport bar on desktop, the
  "⋯" menu on phone (`Transport`'s `showClearGrid`), never both.
- Two grid renderers means a visual change to a cell must be made twice. If
  that becomes a real source of drift, the cell is the seam to extract.
- The WAV export (ticket 25) has **no phone entry point**. It is the demoted
  link under Share in the desktop `TopBar`, and the "⋯" menu's four entries were
  specified before that ticket existed. Adding a fifth is a design call, not a
  merge call — left for a follow-up.
