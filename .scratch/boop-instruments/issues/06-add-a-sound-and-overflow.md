# 06 - "+ Add a sound" and the vertical overflow geometry

**What to build:** The row-count chrome and the layout that absorbs it.

- An **"+ Add a sound"** button sits under the last row, **inside the well's
  scrolling rows box** (it scrolls with the rows; the clip play footer stays
  pinned - ADR 0030 as amended by ticket 23). It opens ticket 05's picker in
  **append mode**: choosing adds the row at the bottom and **closes** the
  dialog (a single decision, unlike the browsing swap flow). Disabled when
  the clip holds the whole roster. Present on laptop and phone.
- **Laptop/tablet:** more rows grow the well; the existing nested rows
  scroller absorbs the overflow. No new scroller, no ADR 0030 change.
- **Phone:** the pinned rail and step window gain rows the same way; the
  region scrolls to pay for them. The three-rows-plus-loop-map `min-height`
  floor becomes **`min(3, rowCount)` rows** plus the loop map.
- Playback **never auto-scrolls a row into view** - ADR 0027's rule extended
  to the vertical axis (ticket 02's ADR wording covers this).
- Row hue stays positional, cycling `ROW_COLOR_VARS[rowIndex % 6]`
  (spec §10.2: recolour-on-delete accepted).
- Aria copy becomes dynamic: "N by 16 step grid"; keyboard nav
  (`useGridKeyboardNav`) works over any row count.

Spec: §4 (add flow, colour, geometry), §10.2.

**Blocked by:** 04, 05.

**Status:** ready-for-agent

- [ ] "+ Add a sound" appends and closes; disabled at the full roster; reachable on laptop and phone; scrolls with the rows, never pinned over the footer
- [ ] 12+ rows: laptop well scrolls its rows with the clip play footer pinned and the grid region behaving per ADR 0030; nothing stretches the grid on a tall window
- [ ] 12+ rows on the phone: rail and step window stay aligned, region scrolls, floor is `min(3, rowCount)` rows + loop map; the ≤505px scrolling-page mode still behaves
- [ ] Rows 7+ cycle the six hues; deleting a row recolours rows below (pinned by a test, since it is a decision)
- [ ] Playback with the playhead on an off-screen row does not scroll vertically
- [ ] Grid aria label reflects the row count; arrow keys traverse all rows
