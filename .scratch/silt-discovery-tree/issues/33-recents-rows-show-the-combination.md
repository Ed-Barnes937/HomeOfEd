# 33 - Recents rows show the combination and its outcome

**Status:** done (built on silt-per-scene-notes, 2026-09-06)
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

- [x] A recents row shows the witnessed combination and its outcome, each
      element as icon above name
- [x] Row capacity still fits whole rows to the dialog height, no scrollbar,
      no clipped partial row (existing behaviour at the new row height)
- [x] Unit tests for the new derivation shape; the ticket 29 `.iwft`s
      updated or extended to assert combination + outcome (pragmatic split)
- [x] Full verify loop green

## Comments

- (agent, 2026-09-06, on landing) `RecentRow` is now the recipe the player
  witnessed - `reagents` and `products`, both `ElementRef[]` through `refOf`,
  keyed by the charted entry as before. It is a `ReadingLine` minus the group,
  deliberately: a row of the timeline is a reading of one interaction, and the
  panel draws it with the same `+`, `->` and `·` the reading line uses.
- **`RECENT_ROW_PX` 30 -> 34.** An 18px tile over its 8px name measures 28px
  (verified in the browser), and 34 leaves 3px above and below, so two rows
  read apart. The CSS-var handoff is unchanged, and `verifyRecentRowsFitTheSidebar`
  now also measures each row's own content against the row box, so a taller
  tile fails the `.iwft` rather than clipping quietly. The sidebar widened
  170 -> 210px for the longest recipe the roster writes
  (`lava + water -> steam · obsidian`, measured at ~155px); a longer one still
  cannot spill, because the tiles shrink and the names ellipsis.
- **No-product edges: the combination alone, no arrow.** `acid + dirt` reads
  `acid + dirt` and stops. The reading line's `both consumed` wording was left
  out on purpose - it belongs to a band with room for a sentence, and the row
  is 210px wide.
- **Stage entries: one tile.** The raise and the bloom chart as flower at both
  ends, so `recentRows` empties the products and the row draws `flower` alone -
  the same call `isStage` makes for the ring, asked of the recipe rather than
  of a focus, since the timeline has no focus. A *partial* self-loop keeps its
  arrow (`flower -> seed · flower`): only a recipe that is one element all
  through is a stage.
- **Duplicate reagents: nothing to do.** Charting already collapses them
  (`chartEntries` dedupes both sides), so `fire + tip` and `fire + stalk` are
  one `fire + flower` and no row can read `x + x`. The model adds no
  de-duplication of its own - a second one here would hide a charting bug.
- **The combination is the charted entry's, the outcome is the witnessed
  edge's.** The ticket says "the witnessed source edge's `reagents` and
  `products`", but an `EntrySource` carries products only - reagents live on the
  entry, as the union across its sources (`entries.ts`). So the left-hand side
  is the charted pair (`fire + flower`) and the right-hand side is what *this*
  edge left (steam for a sprout, fire for a tip), which is also what discovery
  is derived from. No entry on today's roster has sources that disagree about
  their reagents; a roster that grew one would show the union, and that is the
  honest reading of a charted entry anyway.
- **Truncation is guarded, not merely unlikely.** A name is `text-overflow:
  ellipsis` as the safety valve, and an ellipsised name still reads whole in
  `textContent` - so `verifyRecentRowsFitTheSidebar` measures every name's
  `scrollWidth` against its box as well as the row's geometry. Measured at
  210px: 27 names across 13 rows, none clipped; squeezed to 80px the same check
  reports 16px of clipping, so it is a live assertion rather than a vacuous one.
- The row's test id moved from the element to the entry key
  (`field-notes-recent-react:dirt+water`), and the POM now reads a row as the
  words it draws (`dirt + water -> mud`) rather than as a name, so the `.iwft`
  asserts what a player reads.
- One thing outside the ticket's own scope was touched deliberately: the
  reading line and a recents row are now the panel's *two* renderers of a
  recipe, so they share `recipeSide` and the model's `REAGENT_JOIN` /
  `PRODUCT_JOIN` / `MAKES` (the arrow is a constant now, for the same reason the
  joins already were). `isStage` is likewise defined over the timeline's
  `isSelfStage` rather than beside it. Two definitions of one grammar, or of one
  stage, is exactly what would drift.
