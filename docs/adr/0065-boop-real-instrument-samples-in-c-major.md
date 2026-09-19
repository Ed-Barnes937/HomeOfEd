# 0065 - boop: the pitched instruments are real recordings, and the key is C major

- **Status:** Accepted
- **Date:** 2026-09-19
- **Supersedes:** [ADR 0059](0059-boop-pitched-lane-is-in-f-major.md) (the
  pitched lane is in F major, because the marimba says so)
- **Related:** [ADR 0024](0024-boop-sequencer-engine-seam.md) as amended
  2026-09-17 (the anchor rule and the `pitched` register), [ADR 0058](0058-boop-save-format-pitches.md)
  (the saved form of a pitch), [ADR 0062](0062-boop-a-chord-costs-one-voice.md)
  (the chord gain law and the level budget these samples had to fit),
  [ADR 0064](0064-boop-the-export-resamples-linearly.md) (its aliasing
  measurements are re-taken below). Implements
  [pitched-lane ticket 14](../../.scratch/pitched-instruments/issues/14-real-instrument-samples-and-c-major.md);
  spec §3, §11.

## Context

Ed played ticket 04's activation preview and said the four instruments are in
tune and sit well together, but **they do not sound like the instruments they
are labelled**. They were synthesized - additive harmonic stacks under
hand-drawn envelopes - because ticket 18 could not reach any usable CC0 audio
from this environment: freesound gated every download behind a login,
opengameart's CC0 pack had no tuned content, and kenney's packs are the wrong
genre. The kit's `ATTRIBUTION.txt` records all three dead ends.

That blocker is gone. [nbrosowsky/tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)
serves multi-sampled orchestral instruments over raw.githubusercontent.com, and
its own `LICENSE.md` releases the audio under **CC BY 3.0** - the same licence
the shipped artwork already carries, so the attribution pattern exists.

Two things then become one piece of work, because **a sample is sourced at a
root and the root is what sets the key**. ADR 0059 chose F major for exactly
one reason: marimba's shipped sample measured an exact C5 and retuning it would
have changed every saved boop. Ed has since ruled **assume no real users**, so
that constraint is gone and the grill session's original C major is available
again.

The risk was never the licence. It was length. Measured on the actual files:
trumpet G4 is **7.20 s**, piano G3 **8.36 s**, contrabass C2 **10.41 s**,
xylophone G4 **3.62 s**. Boop's one-shots are capped at **400 ms** with a
retrigger rule at 200 bpm, and ADR 0062's chord budget sat at 0.998 of full
scale with no headroom. A trumpet is a sustained instrument; chopping one to
400 ms could easily give a blip no more trumpet-like than the synth it
replaces.

## Decision

**The four pitched instruments are real VSCO2 Community Edition recordings, and
the ensemble is in C major.** Every root sample is a **G**, which is the "so"
of C, so each lane runs C..C.

`ANCHOR_PITCH_INDEX` stays **4**. Moving it to 0 is the other route to C major
and is rejected for the reason it always was: it would make every lane
transpose 0..+12 upward instead of today's symmetric -7..+5, thinning the top
of every lane.

### Registers, for ticket 10 to copy

| instrument   | `rootNote` | `rootMidi` | lane (do..high do) | upstream file             |
| ------------ | ---------- | ---------- | ------------------ | ------------------------- |
| `marimba`    | **G4**     | 67         | C4..C5             | `xylophone/G4.wav`        |
| `trumpet`    | **G4**     | 67         | C4..C5             | `trumpet/G4.wav`          |
| `piano`      | **G3**     | 55         | C3..C4             | `piano/G3.wav`            |
| `doublebass` | **G2**     | 43         | C2..C3             | `contrabass/C2.wav`, +7st |

This is ADR 0059's approved layout moved **down a perfect fourth**, which
preserves every relationship Ed accepted by ear: marimba and trumpet together
at the top, piano an octave under them, doublebass an octave under that. Down
five semitones is the smaller of the two moves onto a G; up seven was the
alternative and would have put the trumpet's lane at C5..C6 with no G5 in the
library to root it on.

Measured back off the shipped `.wav` files rather than asserted from what was
downloaded (`pitchedRoots.test.ts`, harmonic-product over a chromatic sweep of
the 60-260 ms window):

| instrument   | measured | off by |
| ------------ | -------- | ------ |
| `marimba`    | G4 +12c  | +12c   |
| `trumpet`    | G4 -6c   | -6c    |
| `piano`      | G3 +0c   | 0c     |
| `doublebass` | G2 -6c   | -6c    |

`scripts/measureSamplePitch.mjs` agrees on piano (G3 +0c) and doublebass
(G2 -3c) and misreads the other two, for reasons worth writing down: its
energy-weighted average reads trumpet **15 cents sharp**, because a real
trumpet's attack transient is the loudest part of a 340 ms clip, and it loses
the xylophone entirely, because a struck bar's partials are inharmonic and its
autocorrelation wanders in the tail. Both are measurement artefacts, not tuning
errors - the sources themselves measure trumpet G4 -3c and piano G3 +1c over
their full length.

### One root needed a nudge, and it is not the one expected

The library has **no G2 contrabass**, and it is not simply the nearest
neighbour that fills the gap. Every contrabass upstream is **bowed, not
plucked**, and the bow's swell is what decides which one is usable: `Gs2` is one
semitone away but takes **450 ms** to reach full level, so a 360 ms one-shot
would end before the note arrived. `C2` blooms in **120 ms**, the fastest in the
set, and transposing it up 7 semitones shortens that to **80 ms** - which
`holdMs` then keeps whole, so the onset the lane hears is a real bow attack and
not a fade of ours. The nudge is therefore a transpose of a fifth, chosen for
envelope, not a semitone chosen for proximity.

Trumpet needed no nudge at all: `trumpet/G4` exists.

### The tail budget: what it cost

The 400 ms cap is not a style preference - `kitLevels.test.ts` enforces
duration, per-voice peak and a 200 bpm 16th-note retrigger check. Each sample
is cut to length and given an envelope by
`scripts/sourceInstrumentSamples.mjs`: `holdMs` of the natural note survives
untouched, then an exponential fall of `decayDb`, then a raised-cosine release.

| instrument   | length | held   | fall  | release | what the source gave us          |
| ------------ | ------ | ------ | ----- | ------- | -------------------------------- |
| `marimba`    | 390 ms | all    | none  | 40 ms   | already a one-shot: -23 dB by 400 ms |
| `trumpet`    | 340 ms | 70 ms  | 48 dB | 80 ms   | flat sustain for 7 s, no decay at all |
| `piano`      | 320 ms | 45 ms  | 46 dB | 70 ms   | real hammer, -6 dB by 400 ms      |
| `doublebass` | 360 ms | 80 ms  | 42 dB | 90 ms   | bowed swell, no percussive onset  |

The imposed decay is what makes this fit, and the trumpet is the proof. Cut to
400 ms with a release fade and nothing else, its repitched retrigger buildup
reaches **2.72x** against a 1.4x rule - eight copies of a steady tone add almost
in phase. With 48 dB of fall over 270 ms it reaches **1.53x**, which is exactly
where ADR 0059's synthesized trumpet sat (1.50x). The envelope buys back the
entire difference.

Worst repitched retrigger per instrument, against ADR 0059's figures for the
samples these replace:

| instrument   | ADR 0059 | now       |
| ------------ | -------- | --------- |
| `marimba`    | 1.44x    | **1.15x** |
| `trumpet`    | 1.50x    | **1.53x** |
| `piano`      | 1.45x    | **1.41x** |
| `doublebass` | 1.53x    | **1.36x** |

Unrepitched, every voice is under the 1.4x rule the test enforces (1.00x to
1.07x).

### Levels: chords got quieter, one drum case got louder

Re-measured with `scripts/measureChordLevels.mjs`, raw sums at the shipped
`1/sqrt(n)` law, 4 bars of solid 16ths at 200 bpm:

| case                                              | ADR 0062 | now       | x0.3      |
| ------------------------------------------------- | -------- | --------- | --------- |
| roster today, 20 voices, one each                  | 3.035    | **3.301** | 0.990     |
| activated roster, 23 voices, one each              | 3.168    | **3.386** | **1.016** |
| activated roster, four full-lane chords            | 3.325    | **3.088** | 0.927     |
| loudest of 625 shaped chords (searched)            | 3.787    | **3.477** | 1.043     |
| loudest drum subset, no pitch at all (searched)    | 4.057    | **3.703** | 1.111     |

**Every searched worst case improved**, the shaped chord by 0.7 dB and the
drums-only case by 0.8 dB, so the app's actual peak ceiling came down. Real
recordings have messier, less time-aligned attacks than synthesized tones, and
a chord of them adds less coherently.

**The representative "everything solid" cases went up by about 0.8 dB**, and
one of them - 23 rows solid with no chords, which only exists after ticket 10 -
crosses full scale at 1.016. This is the same pre-existing fact ADR 0062 wrote
down: the app has no peak control, only gain staging sized against a
representative case, and two cases already exceeded 1.0 before this change.
Both of those are now lower. `MASTER_GAIN` is untouched at 0.3 and
`WORST_CASE_BUDGET` stays at 3.33.

**That rise is phase coincidence, not loudness, and it is worth knowing.** A
xylophone's mallet transient is 19.6 dB above its own RMS and lands 5 ms in,
right on the other voices' bodies; the new marimba's RMS is *lower* than the
synthesized one it replaces (0.052 against 0.082 at the same 0.5 peak). Trimming
1 ms off the front of the file swings the 20-voice figure between **2.74 and
3.30**. Lowering the marimba's peak all the way to 0.40 only takes it to 3.24.
So `ROSTER_BUDGET` moves 3.1 -> **3.31** as a tripwire on a fixed set of files,
and not as a claim about the kit. Choosing the trim that lands it low would have
been tuning to the test.

### Export aliasing re-measured

ADR 0064's figures were taken on synthesized tones with much simpler spectra, so
`scripts/measureExportAliasing.mjs` was re-run on the real ones. Its decision -
linear interpolation, no heavier resampler - is unchanged, and on three of four
instruments the numbers got better:

| instrument   | error vs. band-limited (ADR 0064) | now              | fold at +5st |
| ------------ | --------------------------------- | ---------------- | ------------ |
| `marimba`    | -37.6 to -38.2 dB                 | -34.3 to -34.8dB | -54.3 dB     |
| `trumpet`    | -45.2 dB                          | **-57.7 dB**     | -66.2 dB     |
| `piano`      | -64.8 dB                          | -62.8 dB         | -84.4 dB     |
| `doublebass` | -38.4 to -39.0 dB                 | **-60.2 dB**     | -65.1 dB     |

The error is still flat across the lane, still almost entirely linear
interpolation's high-frequency droop rather than aliasing, and the worst fold
ceiling improved by 20 dB. At the anchor it still reads float noise, because
`rate` is exactly 1 and the loop is a straight copy.

### Licence

CC BY 3.0 requires credit, and the kit's `ATTRIBUTION.txt` now carries a block
naming the upstream repository, the recording (VSCO2 Community Edition, by
Versilian Studios), the exact upstream path for each of the four files, and
what was changed on the way in. Upstream's own `sample-source-info.txt` is
where the per-instrument provenance comes from; all four happen to be VSCO2.

## Consequences

- **Marimba's sample changed, and that is the one user-audible thing here.**
  Marimba is in the shipped roster, so this is not a dormant change like the
  other three: every existing saved boop using it now plays a real xylophone at
  G4 instead of a synthesized C5, a perfect fourth down. That is exactly what
  ADR 0059 refused to do and what "assume no real users" now permits. Spec
  §11's dormancy still holds for everything else - `kit.json` is untouched, no
  instrument is flagged `pitched`, and trumpet, piano and doublebass remain
  files on disk.
- **The marimba is a xylophone, and in this register that may be a feature.**
  The library has no marimba. Pitched into a C4..C5 lane the xylophone reads
  darker and closer to marimba than a concert xylophone would; whether it reads
  as the right instrument beside the other three is Ed's ear check, not a
  measurement.
- **The doublebass is bowed, not plucked.** Every contrabass upstream is arco,
  so the instrument keeps a real contrabass timbre but loses the pizzicato
  attack the synthesized one had. Its lane bottoms at C2, 65 Hz, against
  ADR 0059's F2 at 87 Hz - and a bowed contrabass is fundamental-dominated
  (91% of the note's energy below 200 Hz at that register, and no better an
  octave up), so ADR 0059's tablet-reproduction criterion does not separate the
  register options here. It is a property of the source. Ed's ear check on a
  tablet is what decides whether the bass speaks.
- **`generatePlaceholderSamples.mjs` no longer rebuilds these four.** Its
  default run was already the fourteen new voices plus the three pitched roots;
  it is now the fourteen alone. The synthesized recipes stay in the file as the
  record of what ticket 04 shipped, exactly as the classic six's do.
- **Ticket 10 inherits new registers and an unchanged shape.** The table above
  is the copy-paste; `kitManifest.test.ts`'s key assertion has already moved
  from F to C, and `pitchedRoots.test.ts` holds the same assertion against the
  audio until the manifest can carry it.
- **The next cheap conversion flips from `bell` to `chime`.** Spec §10 sanctions
  converting further one-note instruments once the lane exists, and ADR 0059
  named `bell` (an exact C6, F major's "so") with `chime` explicitly ruled out.
  In C major it is the other way round: `chime` measures an exact **G6 +0c** and
  `bell`'s C6 no longer fits. Neither is in scope here, but whoever picks that
  follow-up should not read 0059's sentence.
- **`ROSTER_BUDGET` has no slack left.** It was a tight pin at 3.1 against a
  3.035 measurement; it is 3.31 against 3.301. The next re-tuned drum trips it,
  which is the tripwire working, but whoever trips it should read the phase-
  coincidence note above before treating the number as loudness.

## Alternatives considered

- **Keep F major and only replace the samples.** The library has xylophone C5,
  trumpet C4/C6, piano C4 and contrabass C2, so an all-C roster is sourceable.
  Rejected because the only reason F major existed was a sample that is now
  being replaced anyway: keeping it would preserve a workaround after its cause
  had gone, and C major was the grill session's choice on the merits.
- **Move `ANCHOR_PITCH_INDEX` to 0.** The other route to C major, and rejected
  for the reason ADR 0059 gave: it costs the lane its symmetric -7..+5 range.
- **Root the roster a fifth higher (G5, G5, G4, G3).** Preserves the same
  relationships and puts the bass lane at C3 rather than C2, which is safer on
  a small speaker. Rejected: +7 is a bigger move from the registers Ed approved
  than -5, the library has no trumpet G5 so the brightest voice would need a
  two-semitone transpose, and the low-end measurement did not actually favour
  it - the bowed contrabass is fundamental-dominated at either register.
- **Use `contrabass/Gs2` and transpose down one semitone.** The obvious nudge,
  and the one the ticket anticipated. Rejected on measurement: its bow takes
  450 ms to bloom, so a 360 ms one-shot is all onset and no note.
- **Use `bass-electric` for the doublebass**, which is plucked and would sit
  far better in a step sequencer. Rejected: the instrument is labelled
  Doublebass, ships `double-bass.svg`, and ADR 0059 was explicit that `bass` and
  `doublebass` are different instruments that must not converge. Sourcing an
  electric bass for the upright would do exactly that by the back door.
- **Normalise the marimba below 0.5 to buy back the roster budget.** Measured:
  even at 0.40 the figure only falls from 3.30 to 3.24, because the voice
  contributes about 0.3 to a coincident peak. It would make the kit's flagship
  melodic voice quieter for almost nothing.
- **Cut the samples shorter still.** Length is not what drives the roster
  figure - the peak is in the attack, and shortening the marimba from 390 ms to
  280 ms moves it not at all. It would cost realism and buy nothing.
