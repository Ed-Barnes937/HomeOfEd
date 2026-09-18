# 0059 - boop: the pitched lane is in F major, because the marimba says so

- **Status:** Accepted
- **Date:** 2026-09-18
- **Related:** [ADR 0024](0024-boop-sequencer-engine-seam.md) as amended
  2026-09-17 (the anchor rule and the `pitched` register this fixes values
  for), [ADR 0058](0058-boop-save-format-pitches.md) (the saved form of a
  pitch, and the byte-identical promise this protects). Implements
  [pitched-lane ticket 04](../../.scratch/pitched-instruments/issues/04-sounds-and-registers.md);
  spec §3, §5, §9 and §11. **Reverses** the grill session's C major (R2-4).

## Context

A pitched row's lane is one major octave, do to high do, and its anchor - what
an on step with no pitch data means - is **"so"**, pitch index 4. So a lane's
`do` sits **seven semitones below the instrument's root sample**, and the root
sample of a *converted* instrument is a file already on disk that every saved
boop and every share link depends on sounding exactly as it does today.

That makes the key a measured fact, not a choice. The 2026-09-17 grill session
settled on **C major** before anyone had measured anything, and wrote the
resolution rule into spec §3: measure marimba and boop first, and if either is
not a C-major-compatible anchor, bring the clash back rather than retune a
shipped sample.

Measured (`apps/boop/scripts/measureSamplePitch.mjs`, per-frame autocorrelation
averaged in semitones and weighted by level, octave-corrected against a
Goertzel probe, cross-checked to within 3 cents by spectral peak):

| sample    | measured                 | stable?                            | implied key |
| --------- | ------------------------ | ---------------------------------- | ----------- |
| `marimba` | **C5 +0c** (523.4 Hz)    | yes, dead steady                   | F major     |
| `boop`    | **~D#5 +22c** (630.2 Hz) | **no** - glides 3.2st, E5 to ~C5   | Ab major    |

A C-major lane needs a **G** root. Marimba is an exact **C** - the "so" of F
major. Boop has no stable pitch at all: ~90% of its energy is in its first
50 ms, where f0 falls 660 to 615 Hz.

So C major and a pitched marimba cannot both hold, and no key whatsoever holds
for boop.

## Decision

**The ensemble is in F major.** Every pitched instrument's root sample is a
**C**, which is the "so" of F, so each lane runs F..F.

**Marimba converts unchanged.** Its shipped `C5 +0c` is the register; nothing
is retuned, nothing is re-rendered, and every saved boop and share link using
it stays byte-identical, which is the entire point of the anchor rule.

**Boop is not pitched.** It stays one-note exactly as it is today. It is the
one voice in the kit with no pitch to anchor to, so there is no key in which
it could join, and retuning it is exactly what spec §3 forbids.

**New roots are recorded at mid-lane**, so the octave costs -7..+5 semitones
of repitch and never more - the range the 2026-09-17 research measured as
clean for a one-shot.

Registers, for ticket 10 to copy:

| instrument | `rootNote` | lane (do..high do) | why this octave                                  |
| ---------- | ---------- | ------------------ | ------------------------------------------------ |
| `marimba`  | **C5**     | F4..F5             | measured, not chosen - the anchor rule fixes it   |
| `trumpet`  | **C5**     | F4..F5             | the brass singing register; bright, and it cuts   |
| `piano`    | **C4**     | F3..F4             | an octave under the other two, so the ensemble has a low end and a two-octave spread |

**The bass is deliberately absent.** The shipped `bass` measures ~F#2 +23c with
a 1.2 semitone glide, so converting it would put its lane in B major against
everyone else's F - the same defect that disqualified boop. Whether the pitched
bass is a new instrument (new id, new root sample on a C) or nothing at all is
an open question at the time of writing, and a slot ticket 10 can fill without
disturbing anything above.

## Consequences

- **The key is inaudible as a label, so this costs nothing.** No note name is
  ever shown in the UI (spec §10 puts note names out of scope) and there is no
  user-settable register. F versus C is a fact about numbers in `kit.json`;
  what a child hears is only whether the five instruments agree, and they do.
- **The launch roster is smaller than the grill session planned.** Four pitched
  instruments were specified (five with the bass); three are ready here, and
  spec §10 already sanctions converting further one-note instruments as a cheap
  follow-up once the lane exists. `bell` measures an exact C6 and `chime` an
  exact G6, so bell is the natural next conversion in F major.
- **Pitched retrigger buildup exceeds the one-shot rule at some pitches, for
  every instrument including the converted one.** `kitLevels.test.ts` caps a
  voice at 1.4x when retriggered on 200bpm 16ths; repitching moves a voice's
  period, and where it goes coherent with the 75 ms step the tails add nearly
  in phase. Worst case measured per instrument: marimba **1.44x** at `mi`,
  trumpet **1.50x** at `mi`, piano **1.45x** at `do`. The marimba figure is a
  shipped sample being repitched, so this is a property of the lane, not of the
  new samples, and it is ticket 09's to re-pin (spec §5 already charters that).
  Trumpet and piano were shortened to 260 ms and 300 ms to bring them level
  with marimba rather than past it.
- **Activating these two voices puts the roster's dense worst case at 3.105
  raw against a budget pinned at 3.1.** Gain staging still closes
  (3.105 x `MASTER_GAIN` 0.3 = 0.932, under full scale), so this is a constant
  to re-pin and not a clipping risk - again ticket 09, which has to re-measure
  for chords regardless.
- **Nothing here is user-visible.** `kit.json` is untouched; the two new WAVs
  are unreferenced files on disk, exactly as ticket 05's artwork is
  (spec §11's dormancy rule).

## Alternatives considered

- **Keep C major; drop marimba from the pitched roster.** The key would hold
  perfectly - `chime` even measures an exact G6 - but it costs the kit's
  flagship melodic voice, the one a child is most likely to want to play a
  tune on. Rejected.
- **Keep C major and pitch marimba anyway, in its own F.** Same-index notes
  land a perfect 4th apart, which is consonant played in parallel, but the note
  sets differ by one accidental (Bb against B), so independent melodies sour.
  Rejected: "ensemble-consonant" was the brief.
- **Retune marimba to a G.** Forbidden by spec §3, and rightly - it would
  silently change every saved boop and every share link already in the world.
- **Pitch boop in its own Ab.** Its lane would clash with all four others, and
  its 3.2 semitone glide means it has no note to be in tune with in the first
  place.
