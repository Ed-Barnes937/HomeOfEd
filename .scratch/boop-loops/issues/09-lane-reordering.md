# Lane reordering model

Type: grilling
Status: resolved
Assignee: ed-barnes937

## Question

Reordering clips (drag a chip vertically to change lane order) is in scope but
undesigned. The open question is the data model more than the drag:

- Is `clips[]` order the display order? Reordering then renumbers clip
  indices — and `placements` point at clips *by index*, so either placements
  are rewritten on every reorder, or clips need stable ids and placements
  reference those.
- Do tints travel with the clip or with the lane position?
- The interaction itself: drag the chip, with what affordance and drop
  feedback? (Cheap answer expected; the spec records it.)

## Comments

**2026-08-12 — data-model half settled by
[Save format v2](02-save-format-v2.md) / [ADR 0032](../../../docs/adr/0032-boop-save-format-songs.md):**
`patterns` order is lane order, placements reference clips by 1-based index in
a 16-char placement string, and **reordering rewrites the placement string
atomically in the same state update** — no stable clip ids. Remaining here:
whether tints travel with the clip or the lane position, and the drag
interaction itself.

**2026-08-13 — resolved (grilling):**

- **Tints travel with the clip**, not the lane position — the tint is how a
  child identifies a clip (chip, placement squares, header dot, grid-well
  ring), so reorder and delete must not recolour it. Persisted as an optional
  `tint` index on `StoredPattern` (absent → position, so old boops decode
  unchanged); new clips and copies take the lowest unused tint, preserving
  ticket 01's uniqueness after deletes. Recorded as an amendment on
  [ADR 0032](../../docs/adr/0032-boop-save-format-songs.md).
- **Interaction: whole-chip vertical drag** with a ~8px movement threshold
  separating drag from tap-to-select (the same tap-vs-drag disambiguation rule
  PhoneGrid uses). While dragging the chip lifts (scale + shadow, the grid's
  active language) and the other lanes make way live; drop commits, rewriting
  the placement string atomically in the same state update. No grab handle, no
  up/down buttons — no new chrome.
- **Keyboard**: Ctrl/Cmd+ArrowUp/Down moves the focused chip's lane; plain
  arrows keep their navigation meaning (the grid's arrow-key model extends,
  per the map's accessibility note).
- **Reordering counts as "edited"** — same class as a placement change
  (ADR 0031's grown definition).
