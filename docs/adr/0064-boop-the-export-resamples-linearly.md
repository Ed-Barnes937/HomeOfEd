# 0064 - boop: the WAV export resamples linearly, and that is the whole cost

- **Status:** Accepted
- **Date:** 2026-09-18
- **Related:** [ADR 0062](0062-boop-a-chord-costs-one-voice.md) (the gain law
  this reuses rather than restates), [ADR 0024](0024-boop-sequencer-engine-seam.md)
  (the Tone-free seam both audio paths read), [ADR 0059](0059-boop-pitched-lane-is-in-f-major.md)
  (the registers the measurements were taken at; superseded by
  [ADR 0065](0065-boop-real-instrument-samples-in-c-major.md), which re-runs
  the aliasing table below on the real samples and leaves this decision
  standing). Implements
  [pitched-lane ticket 11](../../.scratch/pitched-instruments/issues/11-wav-export-renders-pitch.md);
  spec §3, §5.

## Context

`renderSequenceSamples` built its per-step map from `row.steps` and copied each
sample into the mix at unity rate. Nothing in tickets 01-10 touches it, so a kid
could paint an F-major melody, export it, and get sixteen identical notes at the
root pitch. The export had to learn pitch before ticket 10 activates anything.

Live playback repitches by handing Web Audio a `playbackRate` and letting the
browser resample. The offline render has no AudioContext and therefore has to
resample itself, which is a choice the browser makes for us everywhere else.

## Decision

**The export reads pitch through the same functions playback does, and
resamples each note by linear interpolation at `2^(semitones/12)`.**

- Masks come from `rowPitchMasks` - the one home of the anchor-degrade rule, so
  the export cannot answer "a row with no `pitches`" differently from the grid,
  the engine or the save format.
- Semitones come from `semitonesForInstrument`, so only a manifest `pitched`
  block can transpose anything. An unflagged instrument renders at unity
  whatever its row carries.
- The per-note gain is `chordGain` from `audioDriver.ts`, imported, not
  reimplemented (ADR 0062). Rate and gain compose the obvious way: each note is
  resampled, then scaled, then summed - which is what `ToneAudioDriver` asks the
  browser for when it sets `playbackRate` and starts the source at `chordGain`.

**Linear interpolation, measured rather than assumed.**
`scripts/measureExportAliasing.mjs` compares it against a 64-tap
Blackman-windowed sinc with a rate-scaled cutoff, over the four instruments
ADR 0059 gives registers to:

| instrument   | error vs. band-limited, -7st..+5st | source energy above the +5st fold |
| ------------ | ---------------------------------- | --------------------------------- |
| `marimba`    | -37.6 to -38.2 dB                  | -34.2 dB                          |
| `trumpet`    | -45.2 dB at every degree           | -85.5 dB                          |
| `piano`      | -64.8 dB at every degree           | -82.6 dB                          |
| `doublebass` | -38.4 to -39.0 dB                  | -34.6 dB                          |

Two things fall out. The error is **flat across the lane** - the +5 semitone end
is no worse than the -7 end - because almost all of it is linear
interpolation's high-frequency droop, not aliasing. And the aliasing ceiling at
+5 is what sits above `nyquist / 1.335` = 16.5 kHz in the source, which folds
back no lower than 14.7 kHz: at worst -34 dB, at the top of hearing, on a
one-shot lasting under half a second. Nothing there is worth a heavier
resampler.

At the anchor the same measurement reads **-375 dB**, which is float noise:
`rate` is exactly 1, every interpolation fraction is exactly 0, and the loop is
the straight copy it always was.

## Consequences

- **The byte-identical guarantee survives literally, bytes included.** An
  unpitched row, a pitched row with no `pitches`, and a pitched row sitting at
  the anchor all render sample-for-sample what they rendered before this ADR -
  pinned by comparing against a longhand copy of the old algorithm in
  `renderSequence.test.ts`, with exact equality and not a tolerance.
- **The tail is sized from the notes actually painted.** A note below the anchor
  runs longer (the bottom of a lane is 1.498x the sample), so the render's
  padding is now the greater of the kit's longest sample and the longest note in
  the piece. Keeping the old floor is what stops an unpitched export changing
  length by a byte.
- **Export and playback use different resamplers, by ~38 dB.** The browser's is
  unspecified and varies; matching it exactly is not a thing that can be done.
  The measurement above is the size of the gap, and it is below the level of the
  16-bit WAV the file is written as.
- **The export is stricter than the engine about what may be transposed.** It
  asks `semitonesForInstrument`; `createSequencerEngine` still asks
  `semitonesFromAnchor` directly, so today a row carrying pitches on an
  *unflagged* instrument would repitch live and not in the export. No document
  can be in that state - nothing paints a pitch until the lane exists - and
  ticket 10 moves the engine's call sites over, which closes it by construction.
  Until then the export is the conservative side of the difference.
- **Nothing is activated.** No manifest entry gains a `pitched` block here
  (spec §11); the capability is dormant until ticket 10.

## Alternatives considered

- **Windowed-sinc resampling in the export.** It is the reference the table
  above is measured against, so we know exactly what it buys: 38 dB of droop
  that is inaudible on a one-shot, at 64x the arithmetic per note and a
  resampler nobody else in the app owns. Revisit only if the kit ever ships a
  sustained or bright-tailed sample, where the droop would be heard.
- **Reading `row.pitches` directly and applying the ladder here.** Two lines
  shorter and a second home for the anchor rule. Rejected on the same grounds
  ticket 01 put the rule in `pitch.ts` in the first place.
- **A second gain law for the offline path.** Never seriously - a kid's exported
  WAV sounding different from what they made is the failure this whole seam
  exists to prevent.
