# 04 - Root samples and registers for the five pitched instruments

**Status:** needs-info - **escalated**: the measurement in the comments fires
spec §3's C-major clash rule. Neither converted sample is a C-major anchor, so
the key has to be settled before the three new roots can be pitched at all.
Back to ready-for-agent the moment Ed picks a resolution.
**Blocked by:** 03; now also Ed's key call (see Comments)

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
      comments; C-major compatibility confirmed or **escalated** (it is).
- [ ] Three new root samples in `public/kits/launch/sounds/`, loudness-normal
      against the kit (kitLevels-style measurement, before ticket 09's chord
      re-pin).
- [ ] Registers recorded in the manifest config (values inert until
      ticket 10 flips `pitched` on).
- [ ] Repitch quality across the full octave spot-checked at both ends for
      all five (offline render or dev listen); anything gnarly noted for the
      ear check.
- [ ] Ed's ear check requested with concrete listening steps (this ticket
      flips to ready-for-human at that point).

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
C-major "so" in the whole kit is `chime`:

| sample  | measured | implied key if pitched |
| ------- | -------- | ---------------------- |
| `chime` | **G5 +0c** | **C major** (lane C5..C6) |
| `bell`  | **C4 +3c** fundamental (C6 partial dominates the spectrum) | F major |
| `pluck` | E4 +1c | A major |
| `bass`  | ~F#2 +23c, glides 1.2st | none - not on a note |

### Resolutions for Ed

Marimba is a C, so **C major and a pitched marimba cannot both hold.** Ranked:

**A - the ensemble key becomes F major (recommended).** Marimba fits exactly
and byte-identically, at zero risk. Trumpet/bass/piano are synthesized here,
so their roots go on **C** (the "so" of F) for free. No note name is ever shown
in the UI (spec §10 puts note names out of scope), so C-vs-F is inaudible as a
label - all that matters is that the five agree. Boop still cannot join any
shared key; two sub-options:

- **A1 - swap boop for `bell`.** Bell measures an exact C, so it fits F major
  as cleanly as marimba, keeps the roster at five, needs no new artwork, and
  drops the one sample that has no pitch to speak of. Recommended.
- **A2 - drop boop, ship four pitched instruments.** Spec §10 already makes
  converting more one-note instruments a cheap follow-up.

**B - keep C major, swap boop for `chime` (exact G5), drop marimba.** Key
holds perfectly, but it costs the kit's flagship melodic voice from the lane.

**C - keep C major and pitch marimba anyway.** Its lane is then F major
against everyone else's C. Same-index notes land a perfect 4th apart, which is
consonant in parallel, but the note sets differ by one accidental (Bb vs B),
so independent melodies occasionally sour. Boop still cannot join.

Recommendation: **A1**. The key is a label nobody sees; the sample pitches are
facts nobody may change.

### Also needs a call: `bass` already exists

`kit.json` already ships a one-note `bass` (a ~90 Hz pluck, artwork
`guitar-bass-head.svg`), but spec §1 and ticket 10 both list bass among the
**new** instruments, and ticket 05 drew a *separate* `double-bass.svg` rather
than reusing the existing icon. So the pitched bass looks like a new
instrument, not a conversion - which means a new `instrumentId` and a new
sound file, because overwriting `sounds/bass.wav` would change shipped audio
under every saved boop that uses it. Proposed: id `doublebass`, name
"Double bass", `sounds/doublebass.wav`, artwork `double-bass.svg`; the
existing `bass` stays exactly as it is. Confirm before ticket 10 writes it.

### What is blocked, and what is not

Every remaining AC depends on the key: the three new roots cannot be pitched,
the registers cannot be chosen, and there is no point spending Ed's ear check
on a provisional key. Work stopped here deliberately (spec §3's resolution
rule). `kit.json` is untouched, per spec §11 - the registers land as data for
ticket 10 once the key is settled, alongside ADR 0059 recording the measured
anchors and the key decision together.
