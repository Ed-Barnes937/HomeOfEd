# 09 - Chord loudness: re-measure and re-pin the gain budget

**Status:** ready-for-agent
**Blocked by:** 01, 04

**What to build:** The `MASTER_GAIN = 0.3` budget and `kitLevels.test.ts`
were measured against a worst case of one voice per instrument per step; an
8-note chord of one instrument breaks that invariant, transients near-aligned
at onset, and the `Limiter(-1)` cannot absorb it (audioDriver.ts's own
comment). Re-measure the pitched worst case offline (8-note chord, solid
16ths at 200bpm, low register for the longest tails, plus the roster case)
and re-pin the budget. Expected shape (research recommendation): per-chord
gain scaling (~1/sqrt(n) per note via the source gain), applied in the
driver, rather than another global MASTER_GAIN cut that would dull the whole
app. Whatever lands, `kitLevels.test.ts` pins the new worst case and the
audioDriver.ts headroom comment is updated to the new invariant.

Decisions this implements: spec §5 (research finding #1).

Acceptance criteria:

- [ ] Offline-render measurement of the new worst case recorded in this
      ticket's comments (numbers, not vibes), before and after the fix.
- [ ] No clipping at the pinned worst case; single-note and drum-only
      loudness unchanged (or the change is stated and justified for Ed's
      standing loudness verdict).
- [ ] `kitLevels.test.ts` re-pinned; headroom comment updated.

## Comments
