# 15 — Laptop clip lanes: the 2a frame

**What to build:** At ≥1280px the child sees and works the whole clip-lanes
design: they can make several clips, switch between them, name them, place
them into a song on the lane grid, and everything they know from today still
works. Recreate the handoff's **2a Clip lanes** frame pixel-close
(`docs/reference/design_handoff_clip_lanes/README.md` — the geometry numbers
there are final).

Concretely, from the child's perspective:

- The top bar gains "New boop" as a **plain, no-dialog reset** — working slot
  becomes a one-blank-clip song at default tempo, loaded boop dropped, no
  confirm.
- A **clip header row** above the grid well: "You're changing", tint dot,
  name, rename pencil, Make a copy, Delete clip (disabled at one clip).
- The **grid well** wears the active clip's tint ring; the **clip control**
  inside the well carries "Play this clip" (loops the grid clip, playhead as
  today) and **Clear grid**, now clip-scoped: it clears only the clip on the
  grid, counts as an edit, and no longer drops the loaded boop.
- A **pinned song bar**: header row with Speed (moved from the transport),
  the song play button (laid out per the handoff; its behaviour lands in
  ticket 16), the lane grid (one lane per clip: chip + 16 placement squares),
  and the "+ New clip" row.
- **Placements:** tapping a lane square places the clip there; a filled square
  taps off; placing into an occupied column replaces. Lane squares carry
  labels ("Clip 2, position 5, on") and follow the grid's existing arrow-key
  model: plain arrows navigate, the existing toggle key places/removes.
- **"+ New clip"** adds a blank clip (automatic "Clip N", lowest unused tint,
  put on the grid, not placed in the song) and **disables at 5 clips**
  (greyed, not hidden). The picker replaces this direct-blank behaviour in
  ticket 17; reword the handoff's hint text (suggest: "Add another layer").
  Tapping a chip selects that clip onto the grid.
- The **old transport bar is removed** at this width — its pieces move per
  the handoff. The 5-clip cap bounds the pinned chrome; the grid region stays
  the only scroller (ADR 0030).

Spec: §3 (laptop layout + deltas), §7 (New boop / Clear grid), §14
(accessibility), §15 (motion).

**Blocked by:** 14 — The working song state.

**Status:** ready-for-agent

- [ ] The 2a frame is recreated pixel-close at ≥1280px; the old transport bar is gone at this width
- [ ] Clips can be added (blank), copied, renamed, deleted, and selected via chips; tints follow the lowest-unused rule; Delete disables at one clip, + New clip at five
- [ ] Placements toggle by pointer and keyboard, one per position with replace; lane squares have labels and arrow-key navigation
- [ ] New boop is a plain reset; Clear grid is clip-scoped and counts as an edit
- [ ] Play this clip loops the grid clip with today's playhead behaviour
- [ ] Whole-page behaviour covered by `*.iwft`; placement/clip logic by `*.test`
