# 29 - Recents sidebar in the field notes dialog

**Status:** done (built on silt-per-scene-notes, 2026-09-06)
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

- [x] Witnessing a new discovery puts it at the top of the sidebar
- [x] The row count tracks dialog height (shorter viewport = fewer rows),
      with no scrollbar and no clipped partial row
- [x] Hidden on the phone layout
- [x] Unknown stored edge keys never render a row
- [x] Unit tests for the recents derivation; one `.iwft`: witness, open
      panel, see it listed first (pragmatic split)

## Comments

- (agent, 2026-09-06, on landing) One reading the ticket left open: which
  single element a row wears for a multi-element entry. Built as **what the
  witnessed edge left behind** - the witnessed source's first charted product
  (`recentRows` in `panelModel.ts`), falling back to the first reagent for an
  entry that consumes both cells - since the sidebar is "recently witnessed
  discoveries" and an edge's own products are exactly what the player saw. One
  row per charted entry, held at its first witness: a second raw edge behind a
  grouped entry is progress, not news (the moment cards' rule). Taps were left
  out - the ticket made them optional and rows are display-first.
- Also for ticket 28, noted here since the two landed together: a scene load
  raises no moment cards and never fires the 100% line (ADR 0055 §4) - the
  edges a snapshot brings in were witnessed wherever the scene was played.
