# 0062 - boop: a chord costs one voice, not eight

- **Status:** Accepted
- **Date:** 2026-09-18
- **Related:** [ADR 0024](0024-boop-sequencer-engine-seam.md) (the driver seam
  the gain is applied at), [ADR 0042](0042-boop-dynamic-clip-rows.md) (why a
  step can carry the whole roster), [ADR 0059](0059-boop-pitched-lane-is-in-f-major.md)
  (the registers these levels were measured at). Implements
  [pitched-lane ticket 09](../../.scratch/pitched-instruments/issues/09-chord-loudness.md);
  spec §5, research finding #1.

## Context

`MASTER_GAIN = 0.3` is the only gain either audio path applies, and it was
sized against one invariant: **at most one voice per instrument per step.** A
clip owns its rows and layered clips sound their `instrumentId` union, so that
capped the whole thing at the roster - 20 one-shots, measured at 3.035 raw
painted solid on every 16th at 200 bpm, 0.91 after the gain. The `Limiter(-1)`
behind it inherits a 30 dB knee and cannot catch coincident one-shot attacks,
so the gain has to hold the raw sum under full scale on its own.

A lane column is a chord (spec §6), and that breaks the invariant. Eight notes
of one instrument are **eight sources over one buffer**, all starting on the
same audio frame, and they are the same sample repitched - so their attack
transients add close to coherently rather than washing out the way twenty
different drums do.

Measured offline (`apps/boop/scripts/measureChordLevels.mjs`; raw sums, every
voice at the kit's 0.5 per-voice peak, 4 bars of solid 16ths at 200 bpm, the
four instruments [ADR 0059](0059-boop-pitched-lane-is-in-f-major.md) gives
registers to playing a full lane):

| case                                            | raw   | x0.3      |
| ----------------------------------------------- | ----- | --------- |
| roster today, 20 voices, no chords               | 3.035 | 0.910     |
| activated roster, 23 voices, no chords           | 3.168 | 0.950     |
| activated roster, four full-lane chords, no law  | 4.553 | **1.366** |

1.366 is 2.7 dB into the clip, in a pattern a child can paint. The budget has
to cover chords, and `MASTER_GAIN` cannot pay for them: cutting it dulls the
drums too, and Ed's loudness verdict on this app is already owed.

## Decision

**A column of `n` notes is played at `1/sqrt(n)` per note** - `chordGain` in
`audioDriver.ts`, applied by `ToneAudioDriver` as the source's own start gain.
The invariant the master gain was sized against is restored by construction: a
chord costs one instrument's voice however many notes are in it.

`chordGain(1)` is **exactly 1**, so a drum row, an unchorded lane and every
audition tap are bit-identical to before. The law lives in `audioDriver.ts`
beside `MASTER_GAIN` - the Tone-free seam `ToneAudioDriver` and
`export/renderSequence.ts` both import and neither may import the other - so
playback and the offline export cannot land different laws.

`kitLevels.test.ts` re-pins the budget from the measured worst case:

| case                                              | raw   | x0.3  |
| ------------------------------------------------- | ----- | ----- |
| activated roster, four full-lane chords, at 1/sqrt | 3.325 | 0.998 |

`WORST_CASE_BUDGET` moves 3.1 -> **3.33**, and the existing drum-roster figure
keeps its own tight pin at 3.1 (`ROSTER_BUDGET`) so a re-tuned one-shot still
goes red at 2%, not 10%.

## Consequences

- **The budget is spent.** 3.33 x 0.3 = 0.999. The next instrument, register or
  louder sample has to buy its headroom from `MASTER_GAIN`, and the test goes
  red first. That is the intended tripwire, not an accident.
- **Chords are equal-power, not additive.** A chord's RMS sits within about
  1-3 dB of a single note whatever its size, and its peak runs +2.4 to +5.3 dB
  - bigger, not louder. Doublebass is the outlier at +5.2 dB, because its
  repitched low notes run long (509 ms at `do`) and its partials stay in step.
- **Ticket 10 inherits a green test.** The worst case is measured over every
  one-shot in the kit's sounds directory, so flagging instruments `pitched`
  changes nothing the test reads except the roster count.
- **Ticket 11 inherits the law, not a copy of it.** `renderSequence.ts` renders
  one unpitched sample per on step today, so there is no chord for it to scale;
  when it learns pitch it calls the same `chordGain`.
- **Level, not length.** Repitching also stretches a note - `do` runs 390-509 ms
  against the kit's 400 ms one-shot cap, and retrigger buildup reaches 1.53x
  against a 1.4x pin (ticket 04). Those pins measure the shipped `.wav` files,
  which are unchanged; the level consequence of the overlap is inside the 3.325
  above. Shortening a repitched tail would mean an envelope on the source, and
  that is a sound-design change, not a gain-staging one.

## Alternatives considered

- **Another `MASTER_GAIN` cut.** 1/sqrt(n) with the gain at 0.264 would also
  close. Rejected: it makes the whole app 1.1 dB quieter - drums included - to
  pay for a chord feature, after ticket 08 already spent 6 dB.
- **A stronger law, 1/n^0.75 or 1/n.** They give real headroom (0.936 and
  0.918) but make chords *quieter* than single notes: at 1/n a two-note chord
  loses 3.9 dB of RMS and a full lane 11 dB. Adding a note must not turn the
  volume down.
- **Leaning on the limiter.** Measured useless for this at ticket 08: Tone's
  `Limiter` has a 30 dB knee and `DynamicsCompressorNode` has no look-ahead, so
  a sample-aligned transient is through it before it reacts. A real fix is a
  look-ahead limiter in an `AudioWorklet` - a redesign, not a constant.
- **Staggering a chord's onsets by a few ms** to decorrelate the attacks. It
  would buy the headroom and keep chords loud, but it invents a timing
  mechanism the spec never asked for and puts playback and export one more step
  apart. Worth revisiting only if the budget needs to grow.

## What this does not fix

The budget is a *representative* dense case - every row solid - and never was a
searched maximum. Searching is much harder on it: hill-climbing over which of
today's 20 drum rows are on reaches **4.057 raw (1.217 after the gain) with no
pitch involved at all**, on `main` today. Chords do not make that worse (the
same search over chord shapes reaches 3.787 at this law), and fixing it means
real peak control rather than a constant, so it stays out of scope here and is
written down so nobody re-derives it.
