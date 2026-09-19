# 0059 - boop: the pitched lane is in F major, because the marimba says so

- **Status:** Superseded by [ADR 0065](0065-boop-real-instrument-samples-in-c-major.md)
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
| `piano`    | **C4**     | F3..F4             | an octave under the marimba and trumpet |
| `doublebass` | **C3**   | F2..F3             | an octave under the piano again, so the roster spans three octaves. C2 was rejected: it puts `do` at F1, 44 Hz, which a tablet speaker cannot reproduce |

**There are two basses, on purpose.** The shipped one-note `bass` measures
~F#2 +23c with a 1.2 semitone glide, so *converting* it would have put its lane
in B major against everyone else's F - boop's exact defect - and would have
changed how it sounds in every boop already saved with it. So it is left
completely alone: same id, same sample, same artwork, no `pitched` config. The
pitched instrument is a **new** one, `doublebass`, with its own root sample on
a C and ticket 05's `double-bass.svg`. They are different instruments - an
electric-ish 90 Hz pluck and an upright played pizzicato - and **merging or
"tidying up" the pair later would break saved boops.**

## Consequences

- **The key is inaudible as a label, so this costs nothing.** No note name is
  ever shown in the UI (spec §10 puts note names out of scope) and there is no
  user-settable register. F versus C is a fact about numbers in `kit.json`;
  what a child hears is only whether the four instruments agree, and they do.
- **The launch roster is four, not the five the grill session planned.** Boop
  is the one that fell out. Spec §10 already sanctions converting further
  one-note instruments as a cheap follow-up once the lane exists: `bell`
  measures an exact C6, so it is the natural next conversion in F major
  (`chime` is an exact G6, which is C major's "so" and so does not fit).
- **Pitched retrigger buildup exceeds the one-shot rule at some pitches, for
  every instrument including the converted one.** `kitLevels.test.ts` caps a
  voice at 1.4x when retriggered on 200bpm 16ths; repitching moves a voice's
  period, and where it goes coherent with the 75 ms step the tails add nearly
  in phase. Worst case measured per instrument: marimba **1.44x** at `mi`,
  trumpet **1.50x** at `mi`, piano **1.45x** at `do`, doublebass **1.53x** at
  `la`. The marimba figure is a
  shipped sample being repitched, so this is a property of the lane, not of the
  new samples, and it is ticket 09's to re-pin (spec §5 already charters that).
  Trumpet and piano were shortened to 260 ms and 300 ms to bring them level
  with marimba rather than past it.
- **Activating the three new voices puts the roster's dense worst case at 3.168
  raw against a budget pinned at 3.1.** Gain staging still closes
  (3.168 x `MASTER_GAIN` 0.3 = 0.950, under full scale), so this is a constant
  to re-pin and not a clipping risk - again ticket 09, which has to re-measure
  for chords regardless.
- **This reversal invalidated three C-major assertions already on main**, all
  corrected here: `kitManifest.test.ts`'s key check (which asserted a pitch
  class of C and would have gone red the moment ticket 10 activated the roster,
  since it is vacuous while nothing is pitched), and doc comments in `pitch.ts`
  and `sequencerEngine.ts`.
- **Nothing here is user-visible.** `kit.json` is untouched; the three new WAVs
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
- **Convert the shipped `bass` instead of adding `doublebass`.** It measures
  ~F#2 with a glide, so its lane would be B major against everyone else's F,
  and flagging it pitched would change a sound that saved boops already use.
  Rejected for both reasons; a new instrument costs one sample and breaks
  nothing.
