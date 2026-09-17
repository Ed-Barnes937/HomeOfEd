# 06 - The pitched lane in the desktop/tablet grid

**Status:** ready-for-agent
**Blocked by:** 01, 03

**What to build:** `Grid.tsx` renders a pitched row as the handoff's lane,
**on boop's existing step geometry** (spec §2 - the columns are today's 52px
desktop / 42px tablet; the lane's cells, gaps, plate and hit bands rescale
onto them; hue ladder, plate treatment, ring, HIGH/LOW gradient legend and
label-column layout are exact as designed). Tap paints a note; a second tap
in the column adds (chords); drag fills every crossed cell (extend or sibling
`useDragPaint` - no replace semantics); the column-wide hit bands carry the
touch targets, centred on their tiles with the top/bottom bands absorbing the
plate padding (the handoff's off-by-padding warning). The playhead column
spans pitched rows; a painted cell under it gets the dark-inside/
light-outside ring, which is also the keyboard focus ring. Keyboard: the
existing grid model extended vertically within a lane column; every pitch
announced in solfège ("so, step 5"; top is "high do") - spec §7. Audition on
paint sounds the tapped pitch (via ticket 01).

Decisions this implements: R2-3 geometry policy, Q6 solfège, spec §6/§7.

Acceptance criteria:

- [ ] iwft: painting notes and chords through the UI, drag-fill across a
      column, playback sounding every painted note (fake driver assertions),
      playhead ring on lane cells, keyboard reach + solfège announcements.
- [ ] Hit-band unit tests: every band centred on its tile at desktop and
      tablet column sizes; a tap in the plate padding above/below lands on
      the end cells (the "one note low" regression from the handoff).
- [ ] Drum rows and every existing iwft suite unchanged - zero geometry
      diffs for non-pitched rows.
- [ ] `apps/boop/CONTEXT.md` gains Pitched row / Lane / Pitch index / Anchor
      pitch; `apps/boop/CLAUDE.md` notes the direction-not-pixel scope of
      this handoff.
- [ ] Dormant on main: with no manifest entry pitched, nothing renders
      differently.

## Comments
