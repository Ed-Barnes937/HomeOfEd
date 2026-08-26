# 21 — The erase tool removes spawners

**What to build:** An erase stroke clears the spawners under its brush, not
just the cells.

Erase was cells-only, so the only way to remove a spawner was to switch to
spawner mode and click each one. Clearing an area with a spawner in it left the
emitter behind to refill the hole — the tool visibly did not do what it says.

- An erase stroke removes every spawner whose cell falls inside the brush
  footprint, at the brush width in use; dragging sweeps them as it goes
- Placed spawners under the erase brush wear the existing red-with-minus
  "about to be removed" chrome, the same affordance a spawner-mode hover uses
- Spawner mode's click-to-remove is unchanged; erase is a second path, not a
  replacement

**Status:** resolved

- [x] Erase removes a spawner under the brush; the status count follows
- [x] Brush width is respected — a 1x1 stroke two cells away leaves it, a 5x5 takes it
- [x] The red-with-minus chrome tracks the erase brush footprint
- [x] Unit test for the footprint predicate, `*.iwft` for the three behaviours; lint/typecheck/tests green

## Comments

`isUnderBrush(spawner, centre, brushWidth)` in
`features/spawners/spawners.ts` is the one pure answer to "would this stroke
take it", shared by the sweep in `useSimLoop.paintAt` and the removal highlight
in `WorldOverlay` — the chrome cannot disagree with what the stroke does. Its
`lo`/`hi` split mirrors `brushOffsets`, so an even brush width would land on the
same cells in both.

The sweep is keyed on `selectedElement === EMPTY` rather than a new "erasing"
flag into the loop: painting EMPTY *is* the erase tool (HomePage maps the tool
to that species, and entering spawner mode already forces the tool back to
paint), so a second flag would be a way for the two to drift apart. The overlay
does take an explicit `erasing` prop — it only ever sees `mode`, which is
`'paint'` for both painting and erasing.

Deliberately not done: no confirm on erasing a spawner. Reset guards *everything*
behind a second click, but a stroke is already deliberate and undoing it is one
more click in spawner mode.

Spec §7 gained the second removal path.
