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

**Status:** resolved

- [x] The working grid state is a song; the grid and transport edit the active clip and the song's one bpm, exactly as today from the child's view
- [x] Autosave and restore round-trip clips, tints, names, placements, and the active clip; first load of an old working slot behaves as a one-clip song
- [x] Saving to My boops, loading a row, renaming, deleting, and sharing all carry the whole song
- [x] Every song mutation kind marks the loaded boop edited via the saved-state transitions, covered by unit tests
- [x] Existing `*.iwft` suites still pass — no visible behaviour change

**Resolution.** The song domain lives in `src/song/song.ts` (pure): `Song`/
`Clip`, `StoredBoop`↔`Song` conversions applying ADR 0032's defaults, and the
mutation kinds later tickets wire to UI (`withPlacement`, `addClip`,
`deleteClip`, `renameClip`, `moveClip` — placements rewritten atomically).
`useWorkingGrid` became `useWorkingSong`: it restores the whole song (landing
on `gridClip`) and autosaves it via the one builder `storedBoopFromSong`,
which the share link and the save form also use. `HomePage` holds the song;
the engine still holds only the active clip's pattern and the tempo. Song
mutations go through `updateSong`, which marks the loaded boop edited only
when the mutation really changed the song (ADR 0031, as amended); tempo
arrives via the engine's `tempoChanged` event, with `changeTempo` marking
edited itself, and `loadPreset`/`loadBoop`/`clearAll` replace the song with
their own loaded-state rules, as today.
