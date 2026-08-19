# 06 — Phone: the loop map scrubs, and a WHOLE SONG band

**What to build:** Frame **1d** of the handoff, ≤1023px. Two pieces:

1. **`WHOLE LOOP` becomes the clip scrubber.** `LoopMap`'s geometry does not
   change at all — the 34px band, the 92px label, 16 ticks on a 4px gap, and the
   window bracket underneath are all untouched. It gains pointer handlers on the
   whole band and a grip cap above the current step.
2. **A `WHOLE SONG` band** in `PhoneSongBar`, between the header row and the
   lanes: a caption row (`WHOLE SONG` left, the readout right) and a segment
   track with a bar marker and a cap.

Both strips are the **non-scrolling** kind, and that is the point. It is the
loop map's own existing argument, from ADR 0027: the grid and the lanes still
swipe sideways, but the playhead lives on a band that never moves, so a child
can never lose it.

Two things to be careful of.

**`touch-action: none` inside the one-scroller frame.** The handoff asks for it
on the loop map band. ADR 0030 makes the grid region the only scroller, and the
loop map lives inside it — check that killing touch actions on the band does not
trap the region's vertical scroll. This is not the same problem as `PhoneGrid`'s
paint-vs-scroll rules (the band is not part of the scrolling strip), so do not
reach for that machinery, but do verify the scroll still works with a finger on
the band.

**The song band's geometry is derived, not fixed** (spec §7.2). It spans the
song's *placed* positions, so the segment count changes when placements do:
8 segments in the handoff's demo, `flex: 1` each, divided by an inset rather
than a gap so the marker arithmetic stays exact. Segments carry their topmost
clip's tint at 32%.

Spec §7.2 records the live risk here: at a full 16 positions the bar step drops
to ~5px. Build it bar-snapped as designed and report what the by-hand check
feels like at 16 positions — if it is too tight, the follow-up switches the
phone to position-snap, which ticket 02's timeline makes a change of snap unit.

Caps clear 44px of touch target via their row height even though the visible cap
is smaller (spec §4's accessibility rules apply to both screens).

Spec: §4, §7.2.

**Blocked by:** 04

**Three notes from the build** — the first two amended into the spec and
ADR 0027:

1. *`touch-action: pan-y`, not `none`, and the gesture has to prove itself.* The
   handoff asks for `none` on the loop map band; inside ADR 0030's one scroller
   that traps a finger landing on the band, which is exactly what this ticket
   was told to check. So both bands take `pan-y` — horizontal is the scrub,
   vertical belongs to the region — and `useScrubDrag` gained
   `applyOnPointerDown: false` for them. Leaving `pointercancel` to undo an
   accidental scrub was the first attempt and it does not work: the browser sends
   a `pointermove` or two before it claims the scroll, so the playhead had
   already jumped. The band therefore commits only once the pointer has
   travelled further across it than down it — `useDragPaint`'s cell-boundary
   rule on a continuous axis — with a tap still scrubbing on release. The
   `.iwft` drags *down* each band and asserts the playhead does not move. The
   laptop strips keep the immediate press: they are in a pinned bar that cannot
   scroll.

   The cap's own offset came out of the same review: it was a flat 1/16 of the
   track, like the mock's, which the ticks' 4px gaps put ~2px off the tick it
   names. It now derives a tick's width the way the laptop strip's marker
   derives a cell's, and the `.iwft` asserts cap and tick share a centre.
2. *The song band draws positions but snaps on the whole track.* The handoff
   draws eight position segments; the spec says the snap is a fraction of the
   track through `globalBarAtFraction`. Both are true — the segments are paint,
   and the track is marked as one continuous scrub segment, so the fraction
   across it is the answer with no second copy of the bar arithmetic. That is
   also what keeps the marker exact when a placement changes the segment count.
3. *44px comes from padding, not from a taller band.* The loop map's 34px is
   fixed by the ticket and the song band's track is the handoff's 30px, so
   neither is 44px on its own. Both bands take `padding` out to 44px and give
   the space straight back with a negative `margin`, so the hit box grows onto
   dead space (the well's padding, the row's own margin) and no visible geometry
   moves.

**Status:** ready-for-human

- [x] `LoopMap`'s geometry is unchanged — band, label, ticks and bracket all as
      they are today
- [x] Tapping or dragging the loop map band moves the playhead within the clip,
      snapped to steps
- [x] The loop map's cap matches the handoff: size, offset, grip bars, cyan
      playing / `--ink` stopped
- [x] The grid region still scrolls vertically with a finger starting on the
      band (ADR 0030 is not broken by `touch-action: none`)
- [x] The `WHOLE SONG` band spans the placed positions, with segments dividing
      by inset rather than gap, each in its topmost clip's tint at 32%
- [x] The band's segment count follows a placement change without the marker
      drifting
- [x] The marker is one bar of the song's real length, at the 1 / 0.45 opacity
      rule, hard-cut
- [x] The caption row reads `WHOLE SONG` and the readout, per the handoff
- [x] Both caps clear 44px of touch target
- [x] Neither band scrolls, at any phone width, while the grid and lanes still
      swipe (ADR 0027)
- [x] Whole-page coverage in an `.iwft` suite at phone widths
- [ ] **Human, by hand, on a real phone:** scrub both bands; then build a
      16-position song and report whether bar-snapping on the song band is too
      tight (spec §7.2's follow-up trigger)
