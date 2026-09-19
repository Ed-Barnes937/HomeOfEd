# 14 - Real instrument samples, and the key moves to C major

**Status:** ready-for-agent (merge gated ready-for-human: Ed's ear check)
**Blocked by:** nothing
**Blocks:** 10 - Ed ruled this lands **before** activation, so the registers,
the chord budget and his ear check are each done once against the samples that
actually ship.

Two changes that are one piece of work, because a sample is sourced *at* a
root and the root is what sets the key.

## Why

Ed played the activation preview and said the instruments sound fine in tune
and in ensemble, but **"they don't sound the labelled instrument"**. He pointed
at [tonejs-instruments](https://nbrosowsky.github.io/tonejs-instruments/demo.html).

This is not a reversal of an earlier decision. The kit's own
`public/kits/launch/ATTRIBUTION.txt` records that real sourced one-shots were
the **first** choice and synthesis was a forced fallback: freesound gated every
download behind a login, opengameart's CC0 pack had no tuned or percussive
content, and kenney's packs were the wrong genre. That blocker is gone.

## Sourcing - what I verified so you do not have to

- **Licence: CC BY 3.0.** The same licence the shipped artwork already carries,
  so `ATTRIBUTION.txt` has a pattern to follow. Attribution is **required** -
  add a `sounds/*.wav` block for the sourced voices and keep the synthesized
  ones' block intact for the voices you do not replace. Upstream's
  `sample-source-info.txt` carries the per-sample provenance; carry it across
  rather than writing "various public domain sources".
- **Reachable from this environment** (the thing that failed last time),
  verified 2026-09-19 by direct fetch:
  `https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/<instrument>/<Note>.mp3`.
  Sharps are spelled `As1`, `Cs3` and so on. A missing note returns a 14-byte
  `404: Not Found` body with HTTP 200 from the raw host, so **check the body,
  not the status code**.
- **Available notes**, read off the GitHub contents API:
  - `xylophone` - C5 C6 C7 C8, G4 G5 G6 G7
  - `trumpet` - F3 A3 C4 Ds4 F4 G4 As4 D5 F5 A5 C6
  - `piano` - fully chromatic, C1 to C8
  - `contrabass` - Fs1 G1 As1 C2 D2 E2 Fs2 A2 Gs2 Cs3 E3 B3 Gs3
- Our instrument is named **Marimba** but ships `xylophone.svg`; the library has
  xylophone only. Use it. If it reads as the wrong instrument next to the other
  three, say so rather than renaming anything.

## The key moves to C major

The anchor is "so", so a lane's `do` sits **7 semitones below the root**: a
C-major lane needs a **G** root. [ADR 0059](../../../docs/adr/0059-boop-pitched-lane-is-in-f-major.md)
chose F major for exactly one reason - marimba's shipped C5 sample was
immovable, because retuning it would rewrite saved boops. **Ed has ruled
"assume no real users"**, so that constraint is gone and C major (the grill
session's original choice) is back. Supersede ADR 0059; do not amend it.

- **`ANCHOR_PITCH_INDEX` stays 4.** Moving it to 0 is the other route to C
  major and it is rejected: it would make every lane transpose 0..+12 upward
  instead of today's symmetric -7..+5, thinning the top of every lane.
- Registers are yours to propose and **Ed's to approve by ear**. The F-major
  layout Ed already accepted was marimba and trumpet together at the top,
  piano an octave down, doublebass an octave below that, and doublebass root
  C2 was **rejected** because its `do` at ~44 Hz was below tablet
  reproduction. Preserve those relationships.
- Two roots need a nudge, because the library does not carry them: contrabass
  has no G2 (only G1 at ~49 Hz, too low) and trumpet has no G5. Shifting a
  neighbour by one semitone is inaudible and fine. Say which you did.
- F major is asserted in exactly two places: `kitManifest.test.ts:151` and a
  doc comment at `sequencerEngine.ts:83`.

## The real risk: these samples are 6x to 18x too long

Measured on the actual files, 2026-09-19: trumpet G4 is **7.25s**, piano G4 is
**4.67s**, xylophone G5 is **2.58s**. The kit's budget is **under 400ms** with
no long tails, and that is not a style preference - `kitLevels.test.ts`
enforces duration, per-voice peak, and a 200 bpm 16th-note retrigger check,
and ADR 0062's chord budget now sits at 0.998 of full scale with **no
headroom left**. Longer samples overlap more, and overlap is what that budget
is made of.

A trumpet is a sustained instrument. Chopping it to 400ms may well give a blip
that sounds no more like a trumpet than the synth does, which would defeat the
whole ticket.

**So measure this first, before doing anything else.** Take one instrument end
to end - truncate with a release fade, run it through `kitLevels` and
`measureChordLevels.mjs`, and listen. Then report back to the orchestrator with
what you found and what it cost, **before** converting the other three. If the
honest answer is that real samples cannot fit boop's envelope budget without
sounding synthetic, that is a finding worth having early and Ed will want to
rule on it. Do not quietly ship something that technically passes the tests.

If the fit is tight rather than impossible, the levers, roughly in the order I
would reach for them: a longer cap than 400ms bought back by re-running the
retrigger check; a shorter release fade; picking the brightest available note
and transposing rather than the nearest. Raising `MASTER_GAIN` is **not** a
lever, and `MAX_BPM` must never be lowered.

## The rest of the work

- The kit ships `.wav`; the library ships `.mp3`. Convert, and normalise to the
  same per-voice peak the existing voices use (0.5).
- Re-run every measurement the new audio invalidates:
  `measureSamplePitch.mjs` (roots), `measureChordLevels.mjs` (the chord
  budget), and `kitLevels.test.ts`'s numbers. `measureExportAliasing.mjs` is
  worth a re-run too, since ADR 0064's droop figures were taken on synthesized
  tones with much simpler spectra.
- `generatePlaceholderSamples.mjs` keeps its definitions for every voice you do
  **not** replace. Read its header before touching it: a bare run deliberately
  rebuilds only fourteen of the twenty, because the classic six on disk came
  from a generator that was never committed. Do not regenerate the six.
- **Drums are explicitly out of scope.** Ed raised the drum kit separately and
  scoped it to its own epic. The library is orchestral and has no drums.
- **Dormancy still holds (spec §11).** Nothing here flags an instrument
  `pitched` or edits `kit.json`'s roster. You are replacing audio and changing
  what root each of the four will be given when ticket 10 activates them.
  Record the roots as copy-paste-ready data for ticket 10, the way ticket 04
  did.

Acceptance criteria:

- [ ] One instrument taken end to end and reported to the orchestrator before
      the other three are converted.
- [ ] Four real samples shipped as `.wav`, rooted so every lane is C major.
- [ ] `ATTRIBUTION.txt` carries the CC BY 3.0 block with per-sample provenance
      from upstream's `sample-source-info.txt`.
- [ ] `kitLevels.test.ts` green on the new audio, with any changed budget
      justified by measurement rather than relaxed to fit.
- [ ] The chord budget still closes; `measureChordLevels.mjs` re-run and its
      numbers recorded.
- [ ] Roots measured back off the shipped files with `measureSamplePitch.mjs`,
      not asserted from what was downloaded.
- [ ] ADR written, superseding 0059, covering the key change, the sourcing, the
      licence, and whatever the tail budget forced.
- [ ] A fresh `renderLaneAudition.mjs` render for Ed's ear check. **This PR
      does not merge before he has heard it.**
- [ ] Full verify loop.

## Comments

### 2026-09-19 - built: four real samples, C major, and what the tails cost

Shipped. [ADR 0065](../../../docs/adr/0065-boop-real-instrument-samples-in-c-major.md)
supersedes 0059 and holds the full reasoning; this is the numbers and the
handover.

**Answer to the gate question first.** Real samples do fit, comfortably, and
the trumpet - the hardest case and the one the ticket flagged - is the proof.
Truncated to 400 ms with only a release fade it retriggers at **2.72x** against
a 1.4x rule, because eight copies of a steady tone add almost in phase. Given
70 ms of its natural body and then a 48 dB exponential fall over the remaining
270 ms, it lands at **1.53x**, which is where the synthesized trumpet it
replaces already sat (1.50x). The envelope is what makes this work, and it is
not a cheat: the source is a flat 7.2 s sustain with no decay of its own, so
every one-shot cut from it is a staccato note by construction.

### Roots, measured off the shipped files - ticket 10 copies this verbatim

| instrument   | `rootNote` | `rootMidi` | lane (do..high do) | measured | source                    |
| ------------ | ---------- | ---------- | ------------------ | -------- | ------------------------- |
| `marimba`    | **G4**     | 67         | C4..C5             | G4 +12c  | `xylophone/G4.wav`        |
| `trumpet`    | **G4**     | 67         | C4..C5             | G4 -6c   | `trumpet/G4.wav`          |
| `piano`      | **G3**     | 55         | C3..C4             | G3 +0c   | `piano/G3.wav`            |
| `doublebass` | **G2**     | 43         | C2..C3             | G2 -6c   | `contrabass/C2.wav`, +7st |

ADR 0059's approved layout moved **down a perfect fourth** - the smaller of the
two moves onto a G (+7 was the alternative) - so every relationship Ed accepted
by ear is preserved: marimba and trumpet together, piano an octave under, bass
an octave under that. `ANCHOR_PITCH_INDEX` is untouched at 4.

Measurement is by harmonic product over a chromatic sweep, in the new
`pitchedRoots.test.ts`, which also asserts every lane's `do` and high `do` land
on a C. `measureSamplePitch.mjs` agrees on piano (G3 +0c) and doublebass
(G2 -3c) and misreads the other two: it reads trumpet 15 cents sharp because a
real attack transient dominates a 340 ms clip's energy-weighted average, and it
loses the xylophone entirely because a struck bar's partials are inharmonic.
Both are artefacts of that script, not tuning errors - the sources measure
trumpet G4 -3c and piano G3 +1c over their full length.

### The nudge was not the one the ticket expected

Trumpet needed none: `trumpet/G4` exists. Contrabass has no G2, and the
one-semitone neighbour is the wrong answer - **every contrabass upstream is
bowed, not plucked**, and `Gs2` takes 450 ms to bloom, so a 360 ms one-shot
would end before the note arrived. `C2` blooms in 120 ms, the fastest in the
set, and +7 semitones shortens that to 80 ms, which `holdMs` keeps whole so the
onset is a real bow. So the nudge is a transposed fifth chosen for envelope,
not a semitone chosen for proximity.

### What the tail budget cost

| instrument   | length | held  | fall  | release | lane retrigger (was) |
| ------------ | ------ | ----- | ----- | ------- | -------------------- |
| `marimba`    | 390 ms | all   | none  | 40 ms   | **1.15x** (1.44x)    |
| `trumpet`    | 340 ms | 70 ms | 48 dB | 80 ms   | **1.53x** (1.50x)    |
| `piano`      | 320 ms | 45 ms | 46 dB | 70 ms   | **1.41x** (1.45x)    |
| `doublebass` | 360 ms | 80 ms | 42 dB | 90 ms   | **1.36x** (1.53x)    |

Three of four improved. Unrepitched every voice is 1.00x to 1.07x, well under
the 1.4x the test enforces. The xylophone needed no envelope at all - a struck
bar is already a one-shot, -23 dB by 400 ms.

### Levels - read this before touching the budget again

| case                                            | before | now       | x0.3      |
| ----------------------------------------------- | ------ | --------- | --------- |
| roster today, 20 voices, one each                | 3.035  | **3.301** | 0.990     |
| activated roster, 23 voices, one each            | 3.168  | **3.386** | **1.016** |
| activated roster, four full-lane chords          | 3.325  | **3.088** | 0.927     |
| loudest of 625 shaped chords (searched)          | 3.787  | **3.477** | 1.043     |
| loudest drum subset, no pitch at all (searched)  | 4.057  | **3.703** | 1.111     |

Every **searched** worst case improved, by 0.7 to 0.8 dB, so the app's real
ceiling came down; the representative "everything solid" cases rose by about
0.8 dB. `MASTER_GAIN` is untouched and `WORST_CASE_BUDGET` stays 3.33.
`ROSTER_BUDGET` moves 3.1 -> 3.31.

The rise is **phase coincidence, not loudness**. The new marimba's RMS is
*lower* than the one it replaces (0.052 against 0.082 at the same 0.5 peak),
but its mallet transient is 19.6 dB above its own RMS and lands 5 ms in, right
on the other voices' bodies. Trimming 1 ms off the front swings the 20-voice
figure between 2.74 and 3.30; dropping its peak to 0.40 only reaches 3.24.
Neither lever was used, because picking the trim that lands it low is tuning to
the test. Whoever trips the new pin should read this before treating it as
loudness.

### Export aliasing re-run

ADR 0064's decision stands and three of four instruments got better: error vs.
a band-limited reference is marimba -34.4 dB, trumpet -57.7 dB, piano -62.8 dB,
doublebass -60.2 dB, flat across the lane, with fold ceilings all at or below
-54 dB. 0064's table was taken on synthesized spectra; 0065 carries the new one.

### What ticket 10 needs to know

- The register table above is the copy-paste. Nothing here flags an instrument
  `pitched` or edits `kit.json` - spec §11's dormancy holds.
- `kitManifest.test.ts`'s key assertion already moved F -> C and is still
  vacuous; it arms the moment ticket 10 writes a `pitched` block.
  `pitchedRoots.test.ts` holds the same assertion against the audio meanwhile,
  and ticket 10 should delete its `REGISTERS` list once the manifest carries it.
- **`.scratch/pitched-instruments/issues/10-activation.md` is now stale** - its
  "The key is F major, not C" section and its ADR 0059 citations. Correcting it
  is a separate act, the way PR #152 was; not done here.
- **Marimba's sample changed and marimba is in the shipped roster**, so unlike
  tickets 04 and 05 this one is audible today. Every saved boop using it now
  plays a real xylophone at G4 instead of a synthesized C5, a fourth down. That
  is what "assume no real users" bought.

### For Ed's ear check

Fresh render at `~/Desktop/boop-lane-audition/`: one octave walk per
instrument, plus `ensemble.wav`. Three specific things, in order of how likely
they are to be wrong:

1. **The doublebass is bowed, not plucked.** Every contrabass in the library is
   arco, so it keeps a real contrabass timbre but has lost the pizzicato attack
   the synthesized one had. Its lane also bottoms at C2 (65 Hz) against
   ADR 0059's F2 (87 Hz), and a bowed bass is fundamental-dominated - 91% of the
   note's energy sits below 200 Hz, and that is no better an octave up, so it is
   the source and not the register. **Play it on the tablet**: does the bass
   speak at all, and does it read as a bass line or as a rumble?
2. **The marimba is a xylophone.** The library has no marimba. In a C4..C5 lane
   it reads darker and closer to a marimba than a concert xylophone would, but
   it is the one voice a child already hears today, so it is also the one change
   with a before and after.
3. **The trumpet is staccato.** Its whole envelope is imposed. Does it read as a
   trumpet, or as a synth with a brassy attack? This was the instrument Ed
   pointed at, so it is the one the ticket lives or dies on.

One more for whoever picks up spec §10's "convert another one-note voice"
follow-up: in C major that candidate flips. `chime` measures an exact **G6
+0c** and now fits; `bell` (C6) no longer does. ADR 0059 said the reverse, for
F major.
