# 05 - The instrument picker

**What to build:** Every row's rail artwork becomes a button (both `Grid` and
`PhoneGrid`; the phone rail is pinned so it is always reachable) that opens
the **instrument picker**: a paper-card dialog in the `NewClipPicker` idiom,
sectioned **Drums / Notes / Silly** (spec §2's order), each entry the
instrument's icon + name tinted in the opening row's hue.

Interaction (spec §4 + §10.1, owner-decided):

- **Tap an instrument = audition + apply live.** The sound plays (engine
  `audition()`, ticket 02) and the row swaps immediately (ticket 04's
  `swapRowInstrument` - painted steps kept). The dialog **stays open** so the
  child browses by ear; dismiss is ✕ / tap outside / Esc. This deliberately
  differs from NewClipPicker's choose-and-close.
- Instruments already in the clip render disabled ("already in this clip"),
  including the row's current one.
- The picker footer carries **"Remove this row"** - hidden or disabled at
  1 row; removing closes the dialog. No confirm anywhere.

Keyboard/AT: the dialog follows BoopsPanel/NewClipPicker's existing dialog
semantics (focus trap, Esc, labelled buttons); the rail button is labelled
"<Name>. Change this row's sound.".

Spec: §4 (UX), §2 (groups), §10.1.

**Blocked by:** 01 (the roster it lists), 02 (`audition`), 04 (mutations).

**Status:** done

- [x] Rail icon opens the picker on laptop and phone; 20 instruments in three labelled groups, dialog scrolls
- [x] Tapping a sound auditions it and swaps the row live with steps preserved; dialog stays open; tapping through several sounds leaves the last one
- [x] In-clip instruments disabled; "Remove this row" absent/disabled at 1 row and otherwise removes and closes
- [x] `.iwft`: the spec §5 scenario verbatim - pick instruments on clip 1 with nothing painted, visit clip 2, return, the chosen rows show; then reload, they still show
- [x] `.iwft`: phone-layout pass (pinned rail buttons open the picker; paint-vs-scroll rules untouched)
- [x] Dialog keyboard/AT semantics match the existing dialogs

## Comments

**2026-09-02** - Built.

- **The picker's groups are manifest data, not a list in the picker.**
  `KitInstrument` gains an optional `group` (`drums` | `notes` | `silly`),
  parsed exactly the way `role` is, and all 20 launch entries carry one.
  Ticket 01's note called this: roles cannot express the groups (Notes and
  Silly are both `melodic`), and a list of ids in the picker would break the
  standing rule that nothing outside the manifest may enumerate instrument
  ids. Recorded as **ADR 0042 §6** (a decision this ticket added to the ADR
  that owns the model) and in `apps/boop/CLAUDE.md`'s "Kits are pure data".
  `instrumentGroups.ts` turns the roster into sections - each group in
  `INSTRUMENT_GROUPS` order, each section in *manifest* order, empty groups
  dropped, and any ungrouped instruments in one last "Sounds" section so a kit
  written before the field still offers every sound it has.
- **`InstrumentPicker` does not apply anything itself** - it reports the tap
  and the caller decides what happens, including whether the dialog closes.
  That is what lets ticket 06 reuse it in append mode without a mode flag (see
  the API note at the bottom).
- **Escape is taken in the capture phase and stopped there.** The picker opens
  over `ClipEditorCard`, whose Escape listener is on `window` - the last thing
  a keydown reaches - so without this one keystroke closed both and threw the
  child back to the song bar. A `document` capture listener that stops
  propagation makes the innermost dialog win regardless of where focus is.
  Verified red: with the `stopPropagation()` removed, the dismissal test fails
  on the card being gone.
- **Deviation from the ticket's parenthetical: no focus trap.** The ticket
  says "match BoopsPanel/NewClipPicker's existing dialog semantics (focus
  trap, Esc, labelled buttons)", but none of the app's four dialogs traps
  focus - the semantics they actually share are `role="dialog"` +
  `aria-modal`, Escape, a backdrop tap, and labelled buttons. This dialog
  matches those and additionally moves focus into the card on mount (a
  scrollable card with `tabIndex={-1}`), which is the cheap half of the
  benefit. Adding a trap here alone would make it behave unlike its siblings;
  if traps are wanted they belong on all five at once.
- **"Remove this row" is absent rather than disabled at one row** (the ticket
  allowed either). The footer only exists when `onRemoveRow` is passed, so the
  one-row floor is expressed by the caller not passing it - and a child never
  taps a dead button.
- The rail plate became a `<button>` in both renderers with the handoff's
  geometry untouched (only a button's own chrome reset off it, plus a
  `:focus-visible` ring), labelled "<Name>. Change this row's sound.".
- A swap deliberately does **not** bump `loadToken`: the steps are staying
  put, so the preset-load stagger has nothing to say. The new row keys get
  delay 0 through `useLoadStagger`'s own not-a-fresh-load path.
- Both mutations pair with `updateSong` like every other song mutation, so a
  swap or a remove marks the loaded boop edited (ADR 0031 as amended) and
  stops song playback first; the engine is re-synced with
  `engine.setPattern(activeClip(next).pattern)` after each.
- Verify: `pnpm lint` and `pnpm typecheck` (17/17 green repo-wide),
  `pnpm --filter boop exec vitest run` - **433** green (up 8), and the boop
  `.iwft` suite - **242** green (up 10, the new `instrumentPicker.iwft.tsx`).

**For ticket 06 ("+ Add a sound"), the picker's API:**

```ts
<InstrumentPicker
  kit={engine.kit}
  title="Add a sound"          // also the dialog's accessible name
  inClip={rows.map(r => r.instrumentId)}   // rendered disabled
  colorVar={ROW_COLOR_VARS[rows.length % ROW_COLOR_VARS.length]}
  onChoose={appendRowAndClose}  // the caller closes: append is one decision
  onClose={...}
  // no onRemoveRow - no footer
/>
```

Append mode needs no change to the component: closing on choose is the
caller's `onChoose` doing `setPickerOpen(false)`, and omitting `onRemoveRow`
drops the footer. `title` is the only copy to change. Also note the aria copy
for the grid ("N by 16") is still unclaimed and still ticket 06's, and
`HomePagePom` gained the picker helpers (`openRowInstrumentPicker`,
`chooseInstrument`, `verifyInstrumentSections`, `verifyInstrumentEntryDisabled`,
`verifyRemoveRowAbsent`, the three dismiss helpers) - the entry locator is
`instrument-picker-entry-<id>`, so an add-mode test can reuse all of them.
