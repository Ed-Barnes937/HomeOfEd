# 18 — Lane reordering

**What to build:** The child can reorder lanes by dragging a chip vertically.
A ~8px movement threshold separates drag from tap-to-select (PhoneGrid's
tap-vs-drag rule); while dragging, the chip lifts (scale + shadow — the grid's
active language) and the other lanes make way live; drop commits. No grab
handle, no up/down buttons — no new chrome.

Data: `clips[]` order is lane order. A reorder rewrites the placement string
**atomically in the same state update** (ADR 0032 — placements are
index-based). Tints travel with their clips: reorder and delete never
recolour a clip.

Keyboard: Ctrl/Cmd+ArrowUp/Down moves the focused chip's lane; plain arrows
keep their navigation meaning. Reordering counts as edited.

Spec: §8 (lane reordering), §14 (accessibility).

**Blocked by:** 15 — Laptop clip lanes.

**Status:** ready-for-human

- [x] Chip drag reorders lanes with the lift treatment and live make-way; a sub-threshold press still selects the clip
- [x] Placements move with their clips — the placement string is rewritten in the same update, covered by unit tests
- [x] Tints stay with their clips through reorder and delete
- [x] Ctrl/Cmd+ArrowUp/Down moves the focused chip's lane; plain arrows are unchanged
- [x] A reorder marks the boop edited
