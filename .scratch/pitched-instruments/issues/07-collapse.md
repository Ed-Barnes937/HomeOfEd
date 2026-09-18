# 07 - Collapse: the pebble summary row

**Status:** done (PR pending)
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

- [x] iwft: collapse and expand through the UI; pebbles reflect painted
      pitches (position by pitch, chords showing several pebbles); playhead
      passes over a collapsed row; painting is not possible while collapsed
      (expand first - the summary is read-only).
- [x] Reload resets to expanded; nothing about collapse touches
      `saveFormat.ts`.
- [x] Chevron is keyboard-reachable and announced (expand/collapse + row
      name).

## Comments

**2026-09-18 - built.** `laneSummary.ts` (pure: the pebble's fraction of its
track, and the four-bar contour as the rounded mean of each bar's notes) under
Vitest; the collapse itself in `PitchedLane.tsx`'s `LaneSummary` / `PitchedRail`
with seven `.iwft` cases in `pitchedLane.iwft.tsx`.

Decisions recorded in [ADR 0061](../../../docs/adr/0061-boop-collapsed-pitched-row.md):

- The summary is **read-only** - no handlers, nothing focusable, `aria-hidden`;
  the chevron carries the row's meaning and painting means expanding first.
- A pebble is placed as a **fraction of the track's travel**, so one rule
  covers the 56px desktop and 50px tablet tracks; on the handoff's own 56px
  track it reproduces its drawn 27px / 31px pebbles (pinned by unit test).
- The track is boop's **drum cell** (size, radius, bar alternation, playhead
  lift) and the summary wears the **lane's own hue ladder** - the handoff's
  four bass purples are one instrument's derived set, and there is no
  per-instrument ladder in the app.
- The **chevron takes the rail's second line**: a 160px rail cannot hold a 52px
  plate, a 17px name and a 44px control at once, so the name keeps full width
  and the pitch key / contour shares the line below with the chevron. The cost
  is a ~64px collapsed row rather than 56.
- Arrow keys now **step over** a folded row rather than stranding the cursor
  (`useGridKeyboardNav`).

Still dormant (spec §11): no kit entry is pitched, and the dormancy test now
also asserts no chevron renders.
