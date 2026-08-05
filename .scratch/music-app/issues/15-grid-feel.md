# 15 — Grid feel: latched drag-paint, audible edits, clear-all

**What to build:** The grid stops being tap-only and starts feeling like
paint. Dragging across cells paints them with a latched add-or-remove mode
decided at pointer-down, tracked per pointer so two fingers work
independently. Toggling a cell on while stopped plays its sound. Steps read
in groups of 4, and a clear-all control (with a confirm step) empties the
grid by touch.

**Design:** the handoff (`docs/reference/boop-design/README.md`) fixes the
group tint alternation (even/odd bar backgrounds + 18px vs 8px gutters at
laptop), the edit-pop motion (scale 0.9 → 1, 140ms), the clear-grid button
(dashed coral — never mistakable for play-from-the-top) and the confirm copy
("Clear the whole grid?" / "Every step comes off. Saved grooves stay." →
*Keep playing* / *Clear it*) with the shared confirm-card shape.

**Blocked by:** 13 — First sound: tap-to-toggle grid + play/pause.

**Status:** ready-for-agent

- [ ] Pointer-down decides add-or-remove from that cell's state; the whole
      drag repeats that decision
- [ ] Mode tracked per pointer id — multi-touch painting works
- [ ] Toggling a cell on while stopped plays its sample immediately (via the
      engine's audition)
- [ ] Steps visually grouped in 4s (wider gap or shade)
- [ ] Clear-all reachable by touch, behind a confirm; never keyboard-only
- [ ] Touch-action prevention scoped to the grid element — page pinch-zoom
      still works
- [ ] Whole-frontend test covers drag-paint (add and remove drags) and
      clear-all confirm
