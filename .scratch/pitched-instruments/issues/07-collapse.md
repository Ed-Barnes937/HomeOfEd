# 07 - Collapse: the pebble summary row

**Status:** ready-for-agent
**Blocked by:** 06

**What to build:** A pitched row collapses to the handoff's ~56px summary:
small pebbles positioned by pitch in each step column (16px tall, radius 8,
inset from column edges - rescaled to the real column widths per spec §2),
the mini four-bar pitch contour in the label column, and the 44x44
expand/collapse chevron. Collapsed rows still receive the playhead column.
`collapsed` is UI-only component state: rows start expanded, reset on reload,
per-row chevron only, nothing persisted (grill Q8). Exists because several
expanded lanes make a clip unscannable - the collapse must be reachable and
obvious once two-plus pitched rows are in a clip.

Acceptance criteria:

- [ ] iwft: collapse and expand through the UI; pebbles reflect painted
      pitches (position by pitch, chords showing several pebbles); playhead
      passes over a collapsed row; painting is not possible while collapsed
      (expand first - the summary is read-only).
- [ ] Reload resets to expanded; nothing about collapse touches
      `saveFormat.ts`.
- [ ] Chevron is keyboard-reachable and announced (expand/collapse + row
      name).

## Comments
