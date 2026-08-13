# 14 — The working slot becomes a working song

**What to build:** Under the hood, the app now edits a song, not a bare
pattern — and nothing visible changes. The working slot holds
`Song { bpm, clips (1–5, order is lane order), activeClipIndex, placements }`;
the grid edits the active clip; autosave, restore, My boops save/load/rename/
delete, and share all round-trip the whole song through save format v2. A
reload lands on the clip the child was editing.

At the same time, "edited" grows to its one app-wide definition: any mutation
of the song — a cell toggle, a speed change, a placement change, clip add,
clip delete, clip rename, or a lane reorder — drops the saved indicator to
"• edited". All mutations of My boops still go through the saved-state
transitions (ADR 0031, as amended).

This is the expand step: the UI still shows a single clip and no song bar, but
every later ticket builds on this state shape.

Spec: §2 (state shape), §13 (saved/edited).

**Blocked by:** 13 — Save format v2.

**Status:** ready-for-agent

- [ ] The working grid state is a song; the grid and transport edit the active clip and the song's one bpm, exactly as today from the child's view
- [ ] Autosave and restore round-trip clips, tints, names, placements, and the active clip; first load of an old working slot behaves as a one-clip song
- [ ] Saving to My boops, loading a row, renaming, deleting, and sharing all carry the whole song
- [ ] Every song mutation kind marks the loaded boop edited via the saved-state transitions, covered by unit tests
- [ ] Existing `*.iwft` suites still pass — no visible behaviour change
