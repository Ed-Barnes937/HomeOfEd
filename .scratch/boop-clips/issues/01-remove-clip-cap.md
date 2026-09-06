# 01 - Remove the 5-clip cap on a song

**Status:** needs-info
**Type:** task
**Reported:** 2026-09-06, user request via Ed

A song is capped at 5 clips. The cap is not arbitrary: `MAX_CLIPS =
TINT_COUNT` (`saveFormat.ts:29`, ADR 0032, spec §2) - **one clip per tint**,
and the tint is how a clip is identified everywhere (the shelf, the song bar
placements, thumbnails). `addClip` refuses at the cap (`song.ts:194`) and
assigns the first unused tint (`song.ts:200`); the decoder rejects documents
with more patterns (`saveFormat.ts:231`); the UI disables add/copy at the cap
(`SongBar.tsx:85,387`, `PhoneSongBar.tsx:83`, `HomePage.tsx:934` `canCopy`).

So "remove the limit" forces a design decision, which is the open question:

## Question for Ed (the needs-info)

With more than 5 clips, tints must repeat (or the palette must grow). Today a
kid reads the song bar by colour alone - two clips sharing a tint breaks that.
Options:

1. **Tints cycle** (recommended): drop the uniqueness invariant, assign the
   least-used tint to a new clip. Clips also carry names ("Clip N") and
   thumbnails, so colour stops being the sole identity. Cheapest, no save
   format change (`tint` stays 0-4).
2. **Grow the palette**: more tints, uniqueness kept, but that just moves the
   cap and 10+ distinguishable kid-friendly colours is its own problem.
3. **A higher cap instead of no cap** (e.g. 10 with 5 cycling tints) - keeps
   the UI bounded.

Confirm option (1) or pick another, then this is ready-for-agent.

## Scope notes for the implementer

- Decoder: lifting `saveFormat.ts:231` means old builds meeting a >5-clip
  document degrade to `EMPTY_DOCUMENT` (decode is total). Acceptable - same
  story as any forward-format change - but say so in the ADR amendment.
- The clip shelf and song-position picker need an overflow answer (scroll),
  same shape as the instrument picker's overflow work (boop-instruments
  ticket 06).
- Check the song-bar placement rendering still reads with repeated tints.
- Amend ADR 0032 rather than writing a new one.

## Comments
