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

**Status:** ready-for-agent

- [ ] Rail icon opens the picker on laptop and phone; 20 instruments in three labelled groups, dialog scrolls
- [ ] Tapping a sound auditions it and swaps the row live with steps preserved; dialog stays open; tapping through several sounds leaves the last one
- [ ] In-clip instruments disabled; "Remove this row" absent/disabled at 1 row and otherwise removes and closes
- [ ] `.iwft`: the spec §5 scenario verbatim - pick instruments on clip 1 with nothing painted, visit clip 2, return, the chosen rows show; then reload, they still show
- [ ] `.iwft`: phone-layout pass (pinned rail buttons open the picker; paint-vs-scroll rules untouched)
- [ ] Dialog keyboard/AT semantics match the existing dialogs
