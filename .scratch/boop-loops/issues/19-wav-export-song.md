# 19 — WAV export renders the song

**What to build:** Exporting a boop renders the whole song — placements left
to right, one pass, no loop — so the file the child downloads is the song
they hear in song mode. A song with no placements exports the grid clip's 4
bars, exactly as export behaves today, so old boops export unchanged and
export is never disabled. Clips are not individually exportable.

Pure render-layer work behind the existing export UI; runs at the boop's one
bpm.

Spec: §12 (WAV export).

**Blocked by:** 14 — The working song state.

**Status:** ready-for-agent

- [ ] A song with placements exports one pass of the placement sequence at the boop's bpm (empty positions skipped)
- [ ] A song with no placements exports the grid clip's 4 bars — identical output to today for an old boop
- [ ] Export is available regardless of song contents
- [ ] Render behaviour covered by `*.test` unit tests
