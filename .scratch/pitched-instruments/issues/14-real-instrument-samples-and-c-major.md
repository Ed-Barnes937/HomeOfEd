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
