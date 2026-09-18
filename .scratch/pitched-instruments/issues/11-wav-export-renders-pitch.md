# 11 - The WAV export renders pitch

**Status:** ready-for-human - built and green; no ear check of Ed's is
blocked on it, but see the Comments for the one thing worth hearing.
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

- [x] Existing boops export byte-identically (regression test over the current
      fixtures, asserting sample equality, not a tolerance).
- [x] A pitched row exports with the right pitches: unit-assert the rendered
      f0 of each of the 8 degrees against the same ladder `pitch.ts` defines,
      reusing `scripts/measureSamplePitch.mjs`'s approach if it helps.
- [x] A chord exports at the same level as playback schedules it (ticket 09's
      law, one implementation).
- [x] No clipping at ticket 09's pinned worst case, measured on a rendered
      file rather than asserted by construction.

## Comments

### 2026-09-18 - built, measured, ADR 0064

`renderSequenceSamples` now reads masks through `rowPitchMasks`, transposes by
`semitonesForInstrument`, resamples each note by linear interpolation at
`2^(semitones/12)` and scales it by ticket 09's `chordGain`, imported from
`audioDriver.ts`. No second law, no second home for the anchor rule. **Nothing
is flagged `pitched` and `kit.json` is untouched** (spec §11).

**Byte-identity is literal, bytes included.** `renderSequence.test.ts` carries a
longhand copy of the old algorithm (`unpitchedReference`) and asserts exact
`toEqual` - not a tolerance - for an unpitched row, a pitched row with no
`pitches`, a pitched row whose every note is the anchor, and an unflagged
instrument whose row somehow carries notes. At the anchor `rate` is exactly 1,
so every interpolation fraction is exactly 0 and the loop is the old straight
copy; the aliasing script below reads **-375 dB** there, which is float noise.

This forced one real change beyond the mixing loop: the render's tail padding.
A note below the anchor runs longer (the bottom of a lane is 1.498x the
sample), so the tail is now the greater of the kit's longest sample and the
longest note actually painted. Sizing it from the lane's *possible* bottom note
instead would have made every pitched export ~200 ms longer than it needs to
be, and - the thing that caught it - would have changed the file length of a
pitched row sitting at the anchor. Keeping the old floor is what makes the
guarantee hold to the byte rather than to the last sounding sample.

**Pitch, measured through the export.** A synthetic 440 Hz sine rendered one
degree per step, f0 read back off the rendered buffer by interpolated zero
crossings: every one of the 8 degrees lands within **1 cent** of
`440 * 2^(semitonesFromAnchor(i)/12)`.

**Level, measured on the render rather than reconstructed.** ADR 0062's worst
case (all 23 rows of the activated roster solid on every 16th at 200 bpm, the
four pitched rows holding a full lane) put through `renderSequenceSamples`
peaks at **0.9976**, i.e. **3.3252 raw** - ADR 0062's 3.325 to the digit. The
test's lower bound is 0.97, above the 0.950 the same roster gives with no lane
painted, so a render that quietly dropped the chords fails it too.

**Linear interpolation stays, and here is what it costs.**
`apps/boop/scripts/measureExportAliasing.mjs` (new, same shape as
`measureChordLevels.mjs`) compares it against a 64-tap Blackman-windowed sinc
with a rate-scaled cutoff:

| instrument   | error vs. band-limited, -7st..+5st | energy above the +5st fold |
| ------------ | ---------------------------------- | -------------------------- |
| `marimba`    | -37.6 to -38.2 dB                  | -34.2 dB                   |
| `trumpet`    | -45.2 dB at every degree           | -85.5 dB                   |
| `piano`      | -64.8 dB at every degree           | -82.6 dB                   |
| `doublebass` | -38.4 to -39.0 dB                  | -34.6 dB                   |

The +5 end is **no worse than the -7 end** - the error is flat across the lane
because nearly all of it is linear interpolation's high-frequency droop, not
aliasing. True aliasing at +5 is bounded by what sits above 16.5 kHz in the
source and folds back no lower than 14.7 kHz: at worst -34 dB, at the top of
hearing, on a one-shot under half a second. Not worth a heavier resampler.
ADR 0064 records this and the rest.

**For ticket 10.** Two things:

1. The export asks `semitonesForInstrument`; `createSequencerEngine` still asks
   `semitonesFromAnchor` directly, so a row carrying pitches on an *unflagged*
   instrument would repitch live and not in the export. No document can be in
   that state, and ticket 10's call-site move closes it by construction - but
   it is now a real difference between the two paths rather than a theoretical
   one, so do the move.
2. Activation needs nothing from this ticket. The export reads `pitched` off
   the parsed manifest, so flagging the roster in `kit.json` turns it on with
   no code change, and `renderSequence.test.ts`'s worst-case test already
   renders the flagged roster.

**What Ed might want to hear** (nothing is blocked on it): export a boop with a
pitched lane once ticket 10 lands and check it against the app. The one known
difference is the resampler - the browser's is unspecified and better than
linear by the ~38 dB above - so if the exported file sounds duller at the top
of the lane than the app does, that is where it comes from and ADR 0064's first
alternative is the lever.
