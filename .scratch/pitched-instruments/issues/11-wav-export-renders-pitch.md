# 11 - The WAV export renders pitch

**Status:** ready-for-agent
**Blocked by:** 09 (shares `renderSequence.ts`'s gain line)

**Why this ticket exists:** the spec (written before the code was surveyed)
never mentions the WAV export, and no ticket 01-10 touches it.
`export/renderSequence.ts:51` builds its per-pass map from `row.steps` alone
and copies each sample at unity rate, so **every note on a pitched row would
export at the root pitch**. A kid records an F-major melody, exports it, and
gets sixteen identical notes. That has to close before ticket 10 activates
anything.

**What to build:** `renderSequenceSamples` reads pitch the same way playback
does and resamples each hit.

- Read masks through `engine/pitch.ts`'s `rowPitchMasks` - the single home of
  the anchor-degrade rule. Do **not** restate the rule, and do not read
  `row.pitches` directly.
- Semitones per note come from `kitManifest.ts`'s `semitonesForInstrument`, so
  an unflagged (one-note) instrument stays exactly as it renders today.
- Resample by `2^(semitones/12)`, matching `toneAudioDriver.ts`'s
  `playbackRate`. Linear interpolation is the expected answer; if you measure
  audible aliasing at the +5 semitone end, say so with numbers before reaching
  for anything heavier.
- A chord is several notes on one step: they all sound, and they obey whatever
  per-chord gain law ticket 09 pinned. **Export and playback must agree** -
  ticket 09 owns the law and applies it in both places; this ticket must not
  invent a second one.

**The byte-identical guarantee holds here too** (spec §3): an unpitched row, or
a pitched row at the anchor, must render sample-for-sample what it renders
today. Pin that as a test - it is the cheapest guard against a resampler that
is subtly wrong at rate 1.0.

Acceptance criteria:

- [ ] Existing boops export byte-identically (regression test over the current
      fixtures, asserting sample equality, not a tolerance).
- [ ] A pitched row exports with the right pitches: unit-assert the rendered
      f0 of each of the 8 degrees against the same ladder `pitch.ts` defines,
      reusing `scripts/measureSamplePitch.mjs`'s approach if it helps.
- [ ] A chord exports at the same level as playback schedules it (ticket 09's
      law, one implementation).
- [ ] No clipping at ticket 09's pinned worst case, measured on a rendered
      file rather than asserted by construction.

## Comments
