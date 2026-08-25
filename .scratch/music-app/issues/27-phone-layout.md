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

**Status:** resolved

- [x] Phone breakpoint uses the design's geometry: pinned 92px rail,
      snap-scrolling step window, part-cut cell kept as the scroll
      affordance
- [x] Scroll snaps to the 4-step group offsets; playing never auto-follows
      the playhead — a child's scroll position is never yanked
- [x] Whole-loop map renders all 16 ticks (playhead / note / empty heights
      and colours per design) plus the window bracket
- [x] Off-screen playhead shows the edge glow on the side it's on
- [x] 52px chrome bar with the fridge's exact back/save/overflow glyphs;
      every tap target ≥ 44px
- [x] "⋯" menu holds My grooves, Share, How boop works, then Clear grid in
      the dashed-danger style
- [x] Drag-paint still works inside the window without fighting the scroll
- [x] Whole-frontend test at phone viewport: swipe to bars 3–4, paint a
      cell, verify the loop map tracks the playhead

## Comments

Resolved 2026-08-06 (agent, Opus, worktree branch `t27-phone-layout`,
commit `a7c8aef`, merged with wiring pass as `fba9c90`). PhoneGrid (pinned
92px rail, snap-scrolling 246px window over the 605px strip, exact handoff
geometry), LoopMap (16 ticks + sliding window bracket), PhoneBar (52px
chrome, fridge glyphs copied not imported, "⋯" menu with dashed-danger
Clear grid last). Paint-vs-scroll model (ADR 0027): horizontal drag =
browser scroll (`touch-action: pan-x`), vertical drag/tap = paint;
pointer-down cell not flipped so a swipe never leaves a note behind —
cost: no horizontal drag-paint on phone. Playback never yanks the scroll;
edge glow on the playhead's side (mirrored right form added beyond the
handoff's left-only frame). Documented deviations: last snap position
359px not 462px (geometrically forced — step 16 must be reachable);
bracket slides continuously. `useDragPaint`/`useLoadStagger` extracted and
shared with desktop Grid.

Merge wiring pass (Opus): all three TODO menu props connected — My grooves,
How boop works, and the save icon (saves immediately then opens
GroovesPanel in its "Saved it" state via `saveOnOpen`; groovesPanel state
became closed/open/saving). Merge code review caught a REAL stacking bug:
PhoneBar (z 30/31) rendered above every overlay (z 9/10) — overlays raised
to 40/41/42 with a regression-proven POM check. Design follow-ups recorded
in ADR 0027: WAV export has no phone entry point; "⋯" menu dismissal
(Escape/outside tap) unspecified by the handoff.

Gate re-verified by orchestrator post-merge: lint/typecheck clean, vitest
189/189, playwright CT 44/44.

Whole-branch review note (2026-08-06, out of scope — no change made): the
~45-line cell `<button>` block (props, paint/keyboard handlers, squash span,
testids) is near-identical in `Grid.tsx` and `PhoneGrid.tsx`, as is the rail
row (plate/artwork/nameBob). "Two renderers, one behaviour" is the documented
model and the hooks are shared, but a shared `Cell` component would remove
the largest remaining duplicate if the renderers ever start drifting.
