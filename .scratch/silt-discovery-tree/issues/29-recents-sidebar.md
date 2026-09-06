# 29 - Recents sidebar in the field notes dialog

**Status:** ready-for-agent
**Type:** task
**Reported:** 2026-09-06, Ed

The field notes dialog (`FieldNotesPanel.tsx`) gains a **recents sidebar**:
the most recently witnessed discoveries, newest first. The number shown is
limited **only by the dialog's height** - render as many rows as fit, no
scrolling, no "show more". **Not shown on mobile** (the phone layout keeps
the panel as it is today).

The data already exists: the store keeps witnessed edges append-only in
first-seen order - "the order is a timeline" (`fieldNotesStore.ts`, the
`Progress.edges` doc comment) - and the `reviewed` watermark / NEW-chip
machinery (spec §6) is built on exactly that timeline. Recency needs no new
stored state; the sidebar is a derived view, same family as
`fieldNotesView.ts` / `panelModel.ts`.

## Design notes

- A row is a witnessed entry: its element tile/appearance and name, the same
  visual vocabulary as the ring (reuse `ElementTile` / `elementAppearance`,
  not new art). Keep rows display-first; if a tap does anything, focusing
  that entry in the ring is the natural act - optional, not required.
- Newest at the top. Edges the current roster cannot resolve (forward-compat
  unknowns, spec §5) simply do not appear, matching how derivations already
  ignore them.
- Height-limited: measure the available column height and render
  floor(height / rowHeight) rows; re-derive on resize. No partial rows.
- Mobile: gate on the same breakpoint the panel already uses for its phone
  layout - the sidebar never renders there.
- Interacts with ticket 28 (per-scene progression): the timeline shown is
  whatever the working progression holds, so loading a scene changes the
  sidebar with it. Nothing extra to do beyond deriving from the store; just
  do not cache across loads.

## Acceptance

- [ ] Witnessing a new discovery puts it at the top of the sidebar
- [ ] The row count tracks dialog height (shorter viewport = fewer rows),
      with no scrollbar and no clipped partial row
- [ ] Hidden on the phone layout
- [ ] Unknown stored edge keys never render a row
- [ ] Unit tests for the recents derivation; one `.iwft`: witness, open
      panel, see it listed first (pragmatic split)

## Comments
