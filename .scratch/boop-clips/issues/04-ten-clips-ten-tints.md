# 04 - Ten clips, ten unique tints

**What to build:** A kid can build a song of up to **10 clips**, each with its
own tint. The tint palette grows from 5 to 10: the 5 existing handoff colours
stay exactly as they are, and the implementing agent derives 5 new
kid-distinguishable companions (Ed vetoes at review from a screenshot - flag
the PR ready-for-human on the palette). "+ New clip" and copy stay enabled up
to the new cap; the clip shelf, the song bar's lanes, and the song-position
picker scroll rather than clip once clips outgrow the space (same overflow
shape as the instrument picker). Saving, reloading, and share links all
round-trip a 10-clip song.

**Blocked by:** None - can start immediately.

**Status:** ready-for-agent

Decisions this implements (from the 2026-09-06 grilling session - see ticket
01's comment and [ADR 0056](../../../docs/adr/0056-boop-clips-stay-local.md)):

- `TINT_COUNT` and `MAX_CLIPS` go to 10; one-tint-per-clip uniqueness **holds**
  in this regime (cycling arrives in ticket 05).
- The placements string indexes clips by single character: digits `1`-`9`,
  then the letter `a` for clip 10. Old strings are a strict subset; the writer
  emits a letter only once a 10th clip exists, keeping the stale-build blast
  radius as small as the layering amendment's.
- Decode stays total and all-or-nothing; a stale build meeting tint 5-9 or the
  letter `a` rejects the boop and discards the document - the accepted
  stale-build class from ADR 0032. Say so in the ADR amendment.
- Amend ADR 0032 (do not write a new ADR) and update CONTEXT.md's **Tint** and
  **Song** entries to the shipped model.

Acceptance criteria:

- [ ] A 10-clip song can be built, played, saved, reloaded, and shared; every
      clip keeps a distinct tint for its whole life (reorder/delete never
      recolours).
- [ ] Every pre-existing save and share link still decodes byte-honestly; a
      ≤9-clip, digit-only song is written byte-identically to today.
- [ ] The 11th clip is refused (button disabled, `addClip` no-op) - the cap is
      10 until ticket 05.
- [ ] Clip shelf, lanes, and song-position picker are fully reachable at 10
      clips on phone and laptop; playback never scrolls for the child.
- [ ] ADR 0032 amended; CONTEXT.md Tint/Song updated; the 5 new tints
      presented for Ed's veto.

## Comments
