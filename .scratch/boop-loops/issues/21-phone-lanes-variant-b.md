# 21 — Phone lanes (variant B)

**What to build:** At ≤1023px (`useIsPhone`, as today) the whole clip-lanes
experience works on the phone layout. The song bar lives **inside the
scrolling region**, below the grid well — nothing new is pinned (ADR 0030's
default home). The phone keeps its pinned transport bar: **clip play and
Speed stay in the transport**. Reference shape: the
`prototype/04-small-screen-lanes` branch.

- **Slim clip header** above the grid well, in the scroller: "You're
  changing", tint dot, name, pencil, spacer, Make a copy, Delete clip.
- **Song bar header row**: song play circle (cyan, 36px, flips to ink + pause
  while playing), "Your boop", bars count.
- **Lanes reuse the step window's exact geometry** so lane squares align
  column-for-column under the grid: 92px pinned chip column, 32px squares,
  5px in-group gaps, 11px group gutters, the same 605px strip,
  `scroll-snap-type: x mandatory` to bar lines, `touch-action: pan-x`.
- **Paint vs scroll follows PhoneGrid's rules** (ADR 0027): sideways swipe
  scrolls, tap toggles, a drag paints only after crossing a cell boundary
  (`applyOnPointerDown: false`).
- **Chips are compact**: tint dot, truncating name, ×n count. "+ New" sits
  under them in the chip column, opens the picker, disabled at the 5-clip cap.
- The playing ring walks the lane squares as the song plays.
- The grid itself is untouched: 6×16 always (ADR 0027), step window, loop map.

Spec: §5 (phone).

**Blocked by:** 16 — Song playback; 17 — The "+ New clip" picker.

**Status:** ready-for-agent

- [ ] The song bar renders in the scrolling region with the geometry above; lane squares align column-for-column with the grid's step window
- [ ] Placements toggle under PhoneGrid's paint-vs-scroll rules; sideways swipe scrolls, snap lands on bar lines
- [ ] Song play works from the song bar header; clip play and Speed remain in the pinned transport; the playing ring walks the lanes
- [ ] Compact chips select clips; "+ New" opens the picker and disables at the cap; the slim clip header carries rename/copy/delete
- [ ] Nothing new is pinned; the grid region stays the only scroller; covered by `*.iwft` at a phone viewport
