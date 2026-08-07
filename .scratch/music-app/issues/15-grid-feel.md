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

**Status:** resolved

- [x] Pointer-down decides add-or-remove from that cell's state; the whole
      drag repeats that decision
- [x] Mode tracked per pointer id — multi-touch painting works
- [x] Toggling a cell on while stopped plays its sample immediately (via the
      engine's audition)
- [x] Steps visually grouped in 4s (wider gap or shade)
- [x] Clear-all reachable by touch, behind a confirm; never keyboard-only
- [x] Touch-action prevention scoped to the grid element — page pinch-zoom
      still works
- [x] Whole-frontend test covers drag-paint (add and remove drags) and
      clear-all confirm

## Comments

Resolved 2026-08-06 (agent, Sonnet, worktree branch `t15-grid-feel`, commit
`8b7264c`, merged as `f0be1eb`). Latched drag-paint via pointerenter with
per-pointer-id mode map (pure logic in `paintMode.ts`, unit-tested);
implicit touch pointer capture explicitly released on pointer-down — a real
touch-device bug caught by the code-review pass (mouse tests could not see
it). Edit-pop motion per handoff (0.9->1, 140ms, reduced-motion respected);
`touch-action: none` scoped to the grid body only; dashed-coral clear-grid
button + reusable `ConfirmCard` (shared shape, ticket 20 will reuse) with
the handoff's exact copy. Group-of-4 visuals verified as already correct
from ticket 13. Known gaps flagged: no genuine multi-touch CT test
(Playwright limitation — logic supports it); edit-pop will need
differentiating from the preset-load stagger when ticket 22 lands.
Gate re-verified by orchestrator post-merge: lint/typecheck clean, vitest
96/96, playwright CT 10/10. Commit delayed by the 1Password signing outage;
committed signed once the agent recovered.
