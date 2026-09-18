# 09 - Chord loudness: re-measure and re-pin the gain budget

**Status:** ready-for-human - built and green; Ed's ear check on how a chord
sits against a single note is the open gate (steps below).
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

- [x] Offline-render measurement of the new worst case recorded in this
      ticket's comments (numbers, not vibes), before and after the fix.
- [x] No clipping at the pinned worst case; single-note and drum-only
      loudness unchanged (or the change is stated and justified for Ed's
      standing loudness verdict). **Unchanged** - `chordGain(1)` is exactly 1
      and a drum row passes no gain at all. Read "the pinned worst case"
      literally: a *shaped* chord still clips at 1.136 and is pinned rather
      than fixed - see "What is still over" below, which is the one thing in
      this ticket that needs a decision rather than a tick.
- [x] `kitLevels.test.ts` re-pinned; headroom comment updated.
- [ ] Ed's ear check on chord-versus-note balance. **This is the open gate.**

## Comments

### 2026-09-18 - measured, fixed, re-pinned

`apps/boop/scripts/measureChordLevels.mjs` (committed with this ticket) is the
measurement, alongside `measureSamplePitch.mjs` and `renderLaneAudition.mjs`.
Raw offline sums the `kitLevels.test.ts` way: every voice at the kit's 0.5
per-voice peak, four bars of solid 16ths at 200 bpm, peak read before any
master gain, `playbackRate` modelled as linear-interpolated resampling. The
pitched roster is the four instruments ADR 0059 gives registers to, using the
three off-manifest `.wav`s ticket 04 left on disk. **Nothing is flagged
`pitched` and `kit.json` is untouched** (spec §11). Run it with
`node apps/boop/scripts/measureChordLevels.mjs`.

Registers turn out not to matter to level: the lane transposes by the same
-7..+5 semitones whatever the root note is, so the measurement needs the ids,
not the notes.

**Before and after, the worst case being all 23 rows solid with every lane cell
painted:**

| case                                             | raw   | x `MASTER_GAIN` 0.3 |
| ------------------------------------------------ | ----- | ------------------- |
| roster today, 20 voices, no chords (the old pin)  | 3.035 | 0.910               |
| activated roster, 23 voices, no chords            | 3.168 | 0.950               |
| **before** - four full-lane chords, no law        | 4.553 | **1.366** (clips)   |
| **after** - the same, at `chordGain`              | 3.325 | **0.998**           |

1.366 is 2.7 dB into the clip, so this was a live clipping bug the moment a
lane could hold a chord - not just a constant to bump. Eight notes of one
instrument are eight sources over one buffer starting on the same audio frame,
and they are the same sample repitched, so their attacks add close to
coherently rather than washing out the way twenty different drums do.

**The law, and where it lives:** `chordGain(noteCount)` in
`apps/boop/src/engine/audioDriver.ts`, beside `MASTER_GAIN` - the Tone-free
seam that `toneAudioDriver.ts` and `export/renderSequence.ts` both import and
neither may import the other. `1/sqrt(n)`, and **exactly 1 for a single note**.
`createSequencerEngine` computes it once per column and hands it to
`driver.play(..., gain)`; `ToneAudioDriver` applies it as `ToneBufferSource`'s
own start gain (`start`'s fourth argument). ADR 0062 holds the rationale.

The framing that makes it simple: **a chord costs one instrument's voice,
however many notes are in it.** That is precisely the invariant `MASTER_GAIN`
was sized against ("at most one voice per instrument per step"), so the budget
model survives chords intact and the roster figure only moves 3.168 -> 3.325.

**What changed for single notes and drums: nothing, and here is the proof.**
`chordGain(1) === 1` is pinned in `kitLevels.test.ts`; the engine passes no
gain at all for a row with no pitch data, and `FakeAudioDriver` records a gain
only when it is not unity - so every existing `played` assertion in the suite
reads unchanged, which it does (282 tests green). An audition tap is one note
and is untouched. The drum-roster pin keeps its own tight constant.

**Re-pins in `kitLevels.test.ts`:**

- `WORST_CASE_BUDGET` 3.1 -> **3.33**, measured 3.3252, and still asserted
  against `MASTER_GAIN` (3.33 x 0.3 = 0.999).
- New `ROSTER_BUDGET = 3.1` keeps the drums-only figure on its old 2% tripwire,
  so the widened budget does not let a re-tuned one-shot drift 10%.
- New cases: the chord worst case inside the budget, the same case clipping
  without the law, and the law's shape.
- `audioDriver.ts`'s headroom comment now states the new invariant and points
  at ADR 0062 (and lost ~30 lines of ticket-08 measurement prose to it).

**The budget is now spent.** 3.33 x 0.3 = 0.999. The next instrument, register
or louder sample has to buy its headroom from `MASTER_GAIN`, and this test goes
red before anything ships. Intended tripwire, not an accident.

### Why 1/sqrt(n) and not something stronger

Swept the exponent. `x0.3` of the worst case, and what a chord then sounds like
against a single note of the same instrument - peak and RMS, as a range across
the four instruments, for the loudest chord of that size:

| law         | worst case | 2 notes, peak / RMS  | 8 notes, peak / RMS     |
| ----------- | ---------- | -------------------- | ----------------------- |
| none        | 1.366      | +5.4..+5.7 / +2.0..+3.3 | +8.4..+14.2 / +6.1..+6.9 |
| `1/sqrt(n)` | **0.998**  | +2.4..+2.7 / -1.0..+0.3 | -0.6..+5.2 / -2.1..-2.9 |
| `1/n^0.75`  | 0.936      | +0.9..+1.2 / -2.5..-1.2 | -5.1..+0.7 / -6.6..-7.4 |
| `1/n`       | 0.918      | -0.6..-0.4 / -4.0..-2.7 | -9.6..-3.8 / -11.1..-11.9 |

The stronger laws buy real headroom but make chords **quieter than single
notes** - at `1/n` a two-note chord loses 3.9 dB of RMS. Adding a note must not
turn the volume down, so `1/sqrt(n)` (equal power, the research recommendation)
it is, and the headroom comes out of the margin rather than out of chords.

The alternative that would also close is `MASTER_GAIN` 0.3 -> 0.264, which
makes the whole app 1.1 dB quieter, drums included, to pay for a chord feature.
Rejected - ticket 08 already spent 6 dB and Ed's loudness verdict is owed.

### What is still over, and the one decision left

The budget is the *representative* dense case - every row solid, every cell
painted - which is the same class of case ticket 08 measured, and never a
searched maximum. **Search it and one chord shape still clips.** Marimba
`0xce`, trumpet `0x7b`, piano full lane, doublebass `0xfd`, repeated in every
column with all 23 rows solid: **3.787 raw = 1.136 after the gain**, the
loudest of the 625 combinations the script searches. That is a child skipping a
cell or two while dragging, not an adversarial pattern, so I am not going to
dress it up as covered.

What makes it out of scope rather than a bug in the law: the same search says
the chord shape is not the thing that is wrong. Hill-climbing over which of
today's **20 drum rows** are on reaches **4.057 raw = 1.217, with no pitch
involved at all, on `main` today**. Both numbers are one pre-existing fact -
this app has no peak control, only gain staging sized against a representative
case - and closing either needs a look-ahead limiter in an `AudioWorklet`.
`kitLevels.test.ts` now pins the 3.787 as a named uncovered case so the law
cannot quietly make it worse.

**The decision, if you want it closed anyway:** it is one constant, the
exponent in `chordGain`. `1/n` takes the shaped case to 3.279 (0.984) and the
representative case to 3.061 - clean everywhere - at the cost of a two-note
chord losing 3.9 dB of RMS against a single note and a full lane losing 11 dB.
I would not: it makes adding a note turn the volume down, in an app for a
child, to buy a case that is already reachable without pitch. But it is a
one-line change if the ear check says otherwise.

### Carry-forward

- **Ticket 10 (activation)** inherits a green test: the chord worst case is
  measured over every `.wav` in the kit's sounds directory, so flagging
  instruments `pitched` changes nothing it reads. Still to do there: bump the
  manifest roster count 20 -> 23 in `kitLevels.test.ts`, and delete
  `PITCHED_IDS` from that file in favour of reading `pitched` off the manifest.
  If a register moves on Ed's ear check, re-run the script - doublebass at C3
  is the loudest chord in the kit (+5.2 dB at a full lane) because its
  repitched low notes run long, and dropping it lower would cost more.
- **Ticket 11 (export learns pitch)** inherits the law rather than a copy:
  `renderSequence.ts` renders one unpitched sample per on step today, so it has
  no chord to scale, and its header comment now says to call `chordGain` from
  the same `audioDriver.ts` it already takes `MASTER_GAIN` from. Applying it
  there is the whole coupling.
- **Not a level problem, but noted:** repitching stretches a note past the
  kit's 400 ms one-shot cap (`do` at 390-509 ms) and its retrigger buildup to
  1.53x against a 1.4x pin (ticket 04's figures). Those two pins measure the
  shipped `.wav` files, which are untouched, so they stay green; the level
  consequence of the longer overlap is inside the 3.325 above. Shortening a
  repitched tail means an envelope on the source - sound design, not gain
  staging.

### Ed's ear check

The numbers are all offline renders; nobody has heard this.

1. `pnpm dev --filter=boop`, and with a lane flagged pitched (ticket 10, or a
   temporary local edit), paint one note and play it, then add a second and a
   third in the same column. **The question: does the column stay roughly as
   loud as the single note, or does it feel like it ducks?** That is the whole
   tradeoff above - equal power keeps the loudness flat rather than letting a
   chord get bigger.
2. Fill a whole column (8 notes), on the doublebass especially. It should sound
   fuller, not louder, and must not distort.
3. **The uncovered case.** Fill the grid: every row on, every step on, and
   paint most but *not all* of each lane column - skip a cell here and there,
   which is what a drag does. Run it at 200 bpm. This is the 1.136 above, and
   it is the one thing offline measurement says can audibly clip. If it does,
   the fix is the exponent decision two sections up, not a tweak.
4. Drums and a one-note marimba row should sound **exactly** as they do on
   `main`. If anything there moved, that is a bug, not a decision.
