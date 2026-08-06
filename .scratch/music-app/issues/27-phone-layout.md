# 27 — Small-phone layout: scrolling grid window + whole-loop map

**What to build:** The design's answer to the fixed-6×16-on-a-phone problem
(`docs/reference/boop-design/README.md`, screen 3). The grid stays 6 × 16,
always: the instrument rail is pinned and the 16 step columns scroll
horizontally inside a window, snapping to the 4-step groups so a swipe always
lands on a bar line. A "WHOLE LOOP" map under the grid shows all 16 steps as
ticks (playhead / has-notes / empty) with a window bracket, so the playhead
is never lost — it moves from the grid to the map. Phone chrome is the 52px
bar (back, wordmark, save, "⋯") ported from the fridge's MobileBar idiom,
with My grooves, Share, How boop works, and Clear grid living in the "⋯"
menu.

**Blocked by:** 15 — Grid feel (paint vs scroll interplay); 17 — Playhead
(the loop map tracks it).

**Status:** claimed

- [ ] Phone breakpoint uses the design's geometry: pinned 92px rail,
      snap-scrolling step window, part-cut cell kept as the scroll
      affordance
- [ ] Scroll snaps to the 4-step group offsets; playing never auto-follows
      the playhead — a child's scroll position is never yanked
- [ ] Whole-loop map renders all 16 ticks (playhead / note / empty heights
      and colours per design) plus the window bracket
- [ ] Off-screen playhead shows the edge glow on the side it's on
- [ ] 52px chrome bar with the fridge's exact back/save/overflow glyphs;
      every tap target ≥ 44px
- [ ] "⋯" menu holds My grooves, Share, How boop works, then Clear grid in
      the dashed-danger style
- [ ] Drag-paint still works inside the window without fighting the scroll
- [ ] Whole-frontend test at phone viewport: swipe to bars 3–4, paint a
      cell, verify the loop map tracks the playhead
