# 33 - Recents rows show the combination and its outcome

**Status:** ready-for-agent
**Type:** task
**Reported:** 2026-09-06, Ed, on seeing ticket 29 in play.

**What to build:** each recents row currently shows a single element (the
witnessed edge's first product). Ed wants the whole story: the element
combination and its outcome, e.g. lava + water -> steam. Each element in the
row is drawn as a stacked tile: icon on top, name underneath.

**Blocked by:** none. Builds on ticket 29 (`recentRows` in `panelModel.ts`,
`RecentsSidebar` in `FieldNotesPanel.tsx`).

## Design

- `RecentRow` grows from one `element` to the witnessed source edge's
  `reagents` and `products`, each an `ElementRef` (masked by `refOf` like
  every other tile, as today). Keep the row's identity `key` as is.
- Rendering: reagent tiles joined by `+`, then an arrow, then product tiles.
  Each tile is icon above name (a small vertical stack), replacing the
  current horizontal icon-beside-name row.
- Rows get taller: raise `RECENT_ROW_PX` to whatever the stacked layout
  measures; the capacity arithmetic (`recentCapacity`, whole rows only, no
  scrollbar, no clipped partial row) is unchanged in shape.
- Edge cases, decide sensibly and record here in Comments:
  - an entry whose witnessed edge has no charted products (leaves nothing):
    show the combination alone, no dangling arrow;
  - stage/self entries (every name is the same element): one sensible tile,
    not `x + x -> x`;
  - duplicate reagent pairs (`x + x`) collapse or show twice, implementer's
    call, recorded.
- Timeline semantics from ticket 29 are untouched: one row per charted entry
  at its first witness, newest first, unknown keys render nothing,
  desktop-only.

## Acceptance

- [ ] A recents row shows the witnessed combination and its outcome, each
      element as icon above name
- [ ] Row capacity still fits whole rows to the dialog height, no scrollbar,
      no clipped partial row (existing behaviour at the new row height)
- [ ] Unit tests for the new derivation shape; the ticket 29 `.iwft`s
      updated or extended to assert combination + outcome (pragmatic split)
- [ ] Full verify loop green
