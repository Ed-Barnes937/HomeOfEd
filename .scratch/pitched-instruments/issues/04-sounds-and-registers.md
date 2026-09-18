# 04 - Root samples and registers for the five pitched instruments

**Status:** ready-for-human - Ed's ear check is the only thing left (listening
steps in the PR body and below). The C-major escalation this ticket raised is
resolved: **F major**, ADR 0059.
**Blocked by:** 03 (done)

**What to build:** Sound content for activation. (1) **Measure** the actual
pitch of the current `marimba.wav` and `boop.wav` - their pitch becomes their
anchor "so" (spec §3, old boops must sound byte-identical). If either is not
close to a C-major-compatible anchor, **stop and raise the cross-instrument
key clash to Ed** (spec §3 resolution rule) - do not retune a shipped sample.
(2) **Source/synthesize** trumpet, bass and piano root one-shots the same
route as the current kit's sounds, pitched at each instrument's mid-range
anchor in C major. (3) Choose each instrument's register by ear (kid-comfy,
ensemble-consonant at 100-200bpm) and record it in the manifest `pitched`
config. Deliver a way for Ed to hear the result (the dev app with a temporary
local flag is fine - nothing ships flagged).

Decisions this implements: R2-2 (anchor = current sample), R2-4 (C major,
registers by ear, Ed ear-checks), research §5 (mid-range root, ±6st max).

Acceptance criteria:

- [x] Marimba/boop sample pitches measured and written down in this ticket's
      comments; C-major compatibility **escalated**, and resolved as F major
      (ADR 0059).
- [x] Three new root samples in `public/kits/launch/sounds/`, loudness-normal
      against the kit (kitLevels-style measurement, before ticket 09's chord
      re-pin): trumpet, piano and doublebass.
- [x] Registers recorded, as copy-paste data for ticket 10 rather than in
      `kit.json` - writing a `pitched` block *is* what activates an
      instrument, so recording them in the manifest now would break spec §11's
      dormancy. ADR 0059 and "Ticket 10's copy-paste" below hold them.
- [x] Repitch quality across the full octave spot-checked at both ends
      (`renderLaneAudition.mjs`); the gnarly bits are noted below and in
      ADR 0059's consequences.
- [ ] Ed's ear check - requested, steps below. **This is the open gate.**

## Comments

### 2026-09-17 - measured anchors, and the C-major clash (escalated)

`apps/boop/scripts/measureSamplePitch.mjs` (committed with this ticket) reads
each shipped one-shot and reports a frame-by-frame autocorrelation f0: the
level-weighted centre in semitones, the onset, and how far the voice glides.
Cross-checked against a whole-sample spectral peak, which agreed within 3
cents on every stable voice. Run `node apps/boop/scripts/measureSamplePitch.mjs`.

**The two converted instruments:**

| sample    | measured pitch | stable? | implied lane (do..do) | implied key |
| --------- | -------------- | ------- | --------------------- | ----------- |
| `marimba` | **C5 +0c** (523.4 Hz) | yes, dead steady | F4 G4 A4 Bb4 **C5** D5 E5 F5 | **F major** |
| `boop`    | **~D#5 +22c** (630.2 Hz) | **no** - glides 3.2st, E5 down to ~C5 | Ab4 Bb4 C5 Db5 **Eb5** F5 G5 Ab5 | **Ab major** |

The anchor is pitch index 4, "so" (`ANCHOR_PITCH_INDEX`), so a lane's `do`
sits **7 semitones below the root sample**. A C-major lane therefore needs a
**G** root - which is what ticket 03's `"rootNote": "G3"` example encodes.

- Marimba is a **C**, not a G. Exact, but it is the "so" of **F major**.
- Boop has no stable pitch at all. Its energy is ~90% inside the first 50 ms,
  where f0 falls 660 -> 615 Hz; rounding the centre gives Eb5, which is the
  "so" of Ab major, and 22 cents sharp of that.

Neither is C-major compatible, so per spec §3 this goes back to Ed rather than
retuning a shipped sample. **Nothing here retunes anything** - `sounds/*.wav`
is untouched.

**Rest of the kit, for the option space** (same script). The only exact
C-major "so" in the whole kit is `chime`. (These two were first reported an
octave low: autocorrelation locks to the period of the whole waveform, and a
voice built only from high partials has no energy there. The script now
octave-corrects with a Goertzel probe, and both agree with their recipes in
ATTRIBUTION.txt. Marimba and boop are genuine fundamentals and did not move.)

| sample  | measured | implied key if pitched |
| ------- | -------- | ---------------------- |
| `chime` | **G6 +0c** | C major (lane C6..C7 - very high) |
| `bell`  | **C6 +3c** | **F major** - agrees with marimba |
| `pluck` | E4 +1c | A major |
| `bass`  | ~F#2 +23c, glides 1.2st | none - not on a note |

### 2026-09-18 - resolved: F major, and what shipped

Ed picked **F major, boop dropped** (option A2). Recorded in
**[ADR 0059](../../../docs/adr/0059-boop-pitched-lane-is-in-f-major.md)**,
which is the durable home for the reversal - the grill session had settled on
C major before anything was measured.

- A lane's `do` is 7 semitones under the root sample, so an F-major lane needs
  a **C** root. Marimba already is one, exactly.
- **marimba converts unchanged.** Not regenerated, not retuned; old boops and
  share links stay byte-identical.
- **boop stays one-note.** No key exists for a sample that glides 3.2
  semitones. `bell` (exact C6) is the natural next conversion under spec §10's
  cheap-follow-up clause, but that is not this ticket.
- **trumpet, piano and doublebass** are new, synthesized by the kit's own
  generator (`generatePlaceholderSamples.mjs`, new `harmonics` block) - no
  third-party audio, same route as the other fourteen.

Measured after generating, with the same script:

| sample    | `rootNote` | measured    | lane   |
| --------- | ---------- | ----------- | ------ |
| `marimba` | **C5**     | C5 +0c      | F4..F5 |
| `trumpet` | **C5**     | C5 +0c      | F4..F5 |
| `piano`   | **C4**     | C4 +3c      | F3..F4 |
| `doublebass` | **C3**  | C3 +2c      | F2..F3 |

Piano's +3c is the inharmonicity stretch pulling the measured centre a hair
sharp; ~5 cents is the just-noticeable difference, so it is inaudible.

Registers by ear: trumpet at C5 puts its lane in the brass singing register
where it is bright and cuts; piano at C4 sits an octave under it; doublebass at
C3 an octave under that again. Three octaves of spread rather than four voices
stacked in one place. C2 was tried for the doublebass and rejected - it puts
`do` at F1, 44 Hz, which a tablet speaker simply cannot reproduce.

### Loudness

Measured the `kitLevels.test.ts` way (`VOICE_PEAK` 0.501, <400 ms,
retrigger <1.4x at 200bpm 16ths):

| voice     | duration | peak   | retrigger |
| --------- | -------- | ------ | --------- |
| `trumpet`    | 260 ms | 0.5000 | 1.061x |
| `piano`      | 300 ms | 0.5000 | 1.030x |
| `doublebass` | 340 ms | 0.5000 | 1.295x |

Both at the kit's exact per-voice peak - loudness-normal, not quietly ducked.

**One number for ticket 09:** activating these three takes the whole-roster
dense worst case from 3.035 to **3.168**, against a `WORST_CASE_BUDGET` pinned
at 3.1. Gain staging still closes (3.168 x `MASTER_GAIN` 0.3 = 0.950 < 1.0), so
it is a constant to re-pin rather than a clipping risk - and ticket 09 has to
re-measure for chords anyway. The committed test is **green today** because it
reads the roster from `kit.json`, which this ticket does not touch.

### Repitch spot-check, both ends

`node apps/boop/scripts/renderLaneAudition.mjs` prints the full table. The
octave costs -7..+5 semitones, and nothing sounds torn or aliased at either
end. Two things to note:

1. **Note length scales with pitch** - spec §5's accepted sampler physics.
   `do` is the longest: marimba 420 ms, trumpet 390 ms, piano 449 ms,
   doublebass 509 ms, all past the 400 ms one-shot cap once repitched. Expected, not fixable without
   giving up the anchor rule.
2. **Retrigger buildup spikes where the repitched period goes coherent with
   the 75 ms step.** Worst per instrument: marimba **1.44x** at `mi`, trumpet
   **1.50x** at `mi`, piano **1.45x** at `do`, doublebass **1.53x** at `la`. Trumpet's `mi` is A4 = 440 Hz,
   and 440 x 0.075 = exactly 33 cycles, so its tails add nearly in phase.
   **The marimba figure is a shipped sample**, so this is a property of the
   lane rather than of the new samples; trumpet and piano were shortened (from
   300/360 ms) specifically to sit level with it rather than past it. Ticket 09
   owns the re-pin.

### Two basses, on purpose

`kit.json` already ships a one-note `bass` - an electric-ish ~90 Hz pluck. It
measures ~F#2 +23c with a 1.2 semitone glide, so **converting** it would have
put its lane in B major against everyone else's F (boop's exact defect) *and*
changed a sound saved boops already use. Ed ruled it a new instrument instead:

- `bass` is untouched. Same id, same `sounds/bass.wav`, same
  `guitar-bass-head.svg`, **no `pitched` config, ever.**
- `doublebass` is new: upright, pizzicato, rooted C3, artwork
  `double-bass.svg` from ticket 05.

**Do not let anyone "tidy up" these two into one later** - merging them, or
pointing `bass` at the new sample, silently rewrites every saved boop that uses
it.

### Ticket 10's copy-paste

Add to each entry in `apps/boop/public/kits/launch/kit.json`:

```json
"marimba":    { "pitched": { "rootNote": "C5" } },
"trumpet":    { "pitched": { "rootNote": "C5" } },
"piano":      { "pitched": { "rootNote": "C4" } },
"doublebass": { "pitched": { "rootNote": "C3" } }
```

concretely, the three new entries in full:

```json
{
  "instrumentId": "trumpet",
  "name": "Trumpet",
  "artwork": "/kits/launch/artwork/trumpet.svg",
  "sound": "/kits/launch/sounds/trumpet.wav",
  "role": "melodic",
  "group": "notes",
  "pitched": { "rootNote": "C5" }
},
{
  "instrumentId": "piano",
  "name": "Piano",
  "artwork": "/kits/launch/artwork/piano.svg",
  "sound": "/kits/launch/sounds/piano.wav",
  "role": "melodic",
  "group": "notes",
  "pitched": { "rootNote": "C4" }
},
{
  "instrumentId": "doublebass",
  "name": "Double bass",
  "artwork": "/kits/launch/artwork/double-bass.svg",
  "sound": "/kits/launch/sounds/doublebass.wav",
  "role": "melodic",
  "group": "notes",
  "pitched": { "rootNote": "C3" }
}
```

and `marimba`'s existing entry gains `"pitched": { "rootNote": "C5" }` and
nothing else. **`boop` gains nothing** and **`bass` gains nothing** - both stay
one-note. Ticket 10 will also need to bump `kitLevels.test.ts`'s roster count
from 20 (to 23) and its `WORST_CASE_BUDGET` past 3.168, unless ticket 09 has
already re-pinned it. The key assertion in `kitManifest.test.ts` is **already**
F major - this ticket corrected it, along with the stale C-major doc comments
in `pitch.ts` and `sequencerEngine.ts`, so ticket 10 inherits no surprise.

### Listening steps for Ed

```bash
node apps/boop/scripts/renderLaneAudition.mjs ~/Desktop/boop-lane
```

Four WAVs, plus the repitch table printed to the terminal:

- **`marimba-octave.wav`** - the converted instrument walking F4 up to F5 and
  back. *The one that matters most:* the 5th note up (`so`, C5) is the
  untransposed shipped sample, so every old boop sounds exactly like that note.
  Listen for whether the ends (F4, F5) still sound like the same instrument.
- **`trumpet-octave.wav`**, **`piano-octave.wav`**,
  **`doublebass-octave.wav`** - same walk, new voices. Are they kid-comfy? Is
  the doublebass too low to hear on a laptop, the trumpet too high?
- **`ensemble.wav`** - all four playing an F major phrase in a round, then the
  whole 8-note lane as one chord each. This is the consonance check: do the
  three registers sit together, or does anything poke out or muddy?

If a register is wrong, the fix is one note name in ADR 0059's table and a
re-run - no re-synthesis for marimba, and a one-line change for the other two.
