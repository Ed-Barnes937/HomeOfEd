# 01 - Remove the 5-clip cap on a song

**Status:** split (see 04, 05)
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

- 2026-09-06 (grilling session, Ed): needs-info answered. The tint model is a
  **hybrid of options 1 and 2**, plus a hard ceiling the ticket's options
  didn't surface:
  - **Palette grows to 10 tints.** The 5 new colours are derived by the
    implementing agent from the existing 5 (which stay exactly as the handoff
    fixed them); Ed vetoes at review from a screenshot. `tint` becomes 0-9;
    save-format note: a stale build meeting `tint` 5-9 rejects the boop and
    discards the document - the same accepted stale-build class as layering.
  - **Uniqueness holds up to 10 clips, then tints cycle**: past 10, a new clip
    takes the least-used tint. The decoder's duplicate-tint rejection and the
    ADR 0032 amendment's uniqueness invariant are lifted accordingly.
  - **The cap is 35, not none.** The `placements` string indexes clips by
    single character, so >9 clips can't be written in digits; the settled
    encoding is digits `1`-`9` then letters `a`-`z` (clip 10 = `a`), in both
    placement forms. Old strings are a strict subset, so every existing save
    and share link still decodes; the writer only emits letters once a 10th
    clip exists. Beyond 35 is out of scope for good ("no cap" for any actual
    child).
  - Implementer additions to the scope notes: amend ADR 0032 (as the ticket
    says) covering all three points above, and update `apps/boop/CONTEXT.md`'s
    **Tint** and **Song** entries (both state "at most one clip per tint" /
    "at most 5 clips") to the shipped model. Persistence direction context:
    [ADR 0056](../../../docs/adr/0056-boop-clips-stay-local.md) - this ticket
    changes no storage substrate.
- 2026-09-06 (/to-tickets, Ed approved): split into two tracer-bullet slices -
  **04** (ten clips, ten unique tints - the palette growth, the letter `a`,
  the overflow UI) and **05** (thirty-five clips, cycling tints - blocked by
  04). This file stays as the decision log; the slices are the grabbable
  tickets. Do not implement from this file.
