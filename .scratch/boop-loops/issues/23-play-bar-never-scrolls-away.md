# 23 — The play bar never scrolls away

**What to build:** The clip play button and the song play button are visible at
all times, at every width and every window height. When there is not enough
room, **the grid scrolls — not the bar**.

Today the problem hits the opposite button on each layout:

| Layout | Clip play | Song play |
|---|---|---|
| ≥1024px | `ClipControl` as `Grid`'s `wellFooter` — inside `.scroller` ❌ | `SongBar`, pinned in `.transportDock` ✓ |
| ≤1023px | `Transport`, pinned ✓ | `PhoneSongBar`, inside `.scroller` ❌ |

**The approach, agreed with the driver:** the bar stays where the design
handoff puts it and the grid scrolls *inside* its own container.

- `.well` (`features/grid/Grid.module.scss`) becomes a flex column with a
  `max-height`: the bar-numeral row and `.body` take `flex: 1; min-height: 0;
  overflow-y: auto`, and `wellFooter` takes `flex: none` at its foot.
- **Re-check the playhead.** `.playhead` is `position: absolute` inside
  `.body`, with hand-computed pixel offsets (Grid.module.scss:93–112). Putting
  `.body` in a scroll box changes its containing block's behaviour — verify the
  column still lands on the right step at both the laptop and tablet number
  sets, and that a vertically scrolled well doesn't clip it.
- `PhoneSongBar` gets the same treatment so its header — which carries song
  play — stays put while the lane strip scrolls.
- The grid stays 6×16 at every width. This ticket must not shrink or drop a row
  or a step ([ADR 0027](../../../docs/adr/0027-boop-small-phone-layout.md) is
  untouched).

**Deviates from:**
[ADR 0030](../../../docs/adr/0030-boop-fixed-frame-one-scroller.md), which says
the grid region is the **only** scroller. Amend it: a nested scroller is
allowed inside the grid well and inside the phone song bar, for exactly this
reason — a pinned bar the child can always reach beats a single-scroller rule.
Record the reason, not just the exception.

**Blocked by:** —

**Status:** ready-for-agent

- [x] `.iwft` at a short viewport (e.g. 1280×600): the clip play button is in the viewport without scrolling
- [x] `.iwft` at a short phone viewport (e.g. 390×640): the song play button is in the viewport without scrolling
- [x] The grid is still 6 rows × 16 steps at every breakpoint; no cell geometry changed
- [x] The playhead column lands on the correct step at 1280px+ and in the tablet band, including when the well is scrolled
- [x] ADR 0030 amended with the exception and its reason
