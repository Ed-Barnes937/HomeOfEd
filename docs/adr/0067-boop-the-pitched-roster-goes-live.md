# 0067 - boop: the pitched roster goes live, and a one-note row ignores a melody

- **Status:** Accepted
- **Date:** 2026-09-19
- **Related:** [ADR 0065](0065-boop-real-instrument-samples-in-c-major.md) (the
  samples and the registers this writes into the manifest, superseding
  [ADR 0059](0059-boop-pitched-lane-is-in-f-major.md)),
  [ADR 0024](0024-boop-sequencer-engine-seam.md) as amended 2026-09-17 (the
  anchor rule and the `pitched` register),
  [ADR 0058](0058-boop-save-format-pitches.md) (the saved form of a pitch),
  [ADR 0062](0062-boop-a-chord-costs-one-voice.md) (the chord gain law and the
  level budget), [ADR 0063](0063-boop-pitched-lane-on-the-phone.md) (the phone's
  vertical budget this checks the default clip against),
  [ADR 0042](0042-boop-dynamic-clip-rows.md) (a clip's own rows).
  Implements [pitched-lane ticket 10](../../.scratch/pitched-instruments/issues/10-activation.md);
  spec §3, §4, §11.

## Context

Tickets 01 to 09, and 11 to 15, landed the whole pitched lane **dormant**: the
geometry, the save field, the chord gain law, the phone rail, the note-name
gutter and four real recordings are all on `main`, and none of it is reachable,
because `instrument.pitched !== undefined` is false for every entry in
`kit.json`. Spec §11 planned it that way so that no PR of the epic could change
what a child hears until one deliberate act did.

This is that act. It is small in the manifest and large in what it turns on, so
it is worth writing down what the switch was actually gated on, and the two
questions the epic left open for whoever threw it.

## Decision

**Four instruments are flagged `pitched` in `kit.json`, and three of them are
new entries.** Marimba converts; trumpet, piano and doublebass join the `notes`
group at the end of it, since manifest order is the picker's order. Registers
are ADR 0065's measured table verbatim - marimba G4, trumpet G4, piano G3,
doublebass G2 - so every lane runs C to C and the whole kit is in C major.

`bass` keeps no register, forever: saved boops name it, and `doublebass` is a
different instrument rather than a rename of it. `boop` keeps none either - it
glides 3.2 semitones and has no stable pitch to root.

### Conversion cost nothing, and that is asserted rather than argued

A row that stored no `pitches` reads as the anchor "so" (`rowPitchMasks`), the
anchor is zero semitones, and zero semitones is the untransposed sample. The
chain is short, but it runs through the decoder, the engine and the offline
render, so `pitchedActivation.test.ts` pins it end to end on a frozen pre-epic
save document: it re-serializes to the same bytes, its marimba row grows no
pitch data at decode, the engine hands the driver a call with no `semitones` and
no `gain` on it, and an offline render of it is **sample-for-sample identical**
to the same render through a kit with the `pitched` blocks stripped off.

That last comparison is against this build one commit earlier, deliberately, and
not against audio captured before the epic. Marimba's sample changed in
ticket 14, which is audible and which Ed accepted separately (ADR 0065); mixing
the two would measure that decision instead of this one.

### Pitch data on a one-note instrument is **ignored**, not zeroed and not refused

Ticket 03 defined `semitonesForInstrument` and left nothing calling it, with the
choice of what it should mean deliberately open. The engine now calls it, and
the answer for an unflagged instrument is **`undefined`** rather than `0`, with
one consequence carried into both playback and the export: a one-note row sounds
**once** per on step, on the base sample, whatever pitch data its column holds.

Zero was the obvious reading and it is wrong. A column holding a chord would
render as several copies of one untransposed sample starting on the same audio
frame - a coherent unison, worth up to +9 dB on eight notes, which the
`1/sqrt(n)` chord law is not sized for because that law assumes the notes are
different pitches.

Refusing loudly in `setPattern` is the other option the ticket named, and it is
worse. Pitch data reaches a one-note row by exactly one route: a newer build
flags another instrument, a child paints a melody on it, saves, and then opens
the document on this build or a cached one. `saveFormat`'s decode is
all-or-nothing (ADR 0025), so a refusal there discards the **whole** save
document - every boop the child has - over one row this build does not
understand. Spec §4 already ruled the other way for exactly this case: a stale
build "plays the rhythm on the base sample".

The data survives the read, which is one step better than spec §4 anticipated.
`getPattern` still returns the row's `pitches` and the save format still writes
them, so a round trip through this build hands the melody back intact to the
build that understands it. Spec §4 accepted losing it; nothing had to be done to
keep it.

### The roster's representative peak crosses full scale, and it is accepted

`ROSTER_BUDGET` moves 3.31 -> **3.39**, because the case it measures is now the
activated 23 rather than the 20 that preceded it. Measured 3.386 raw, which is
**1.016** after `MASTER_GAIN` - the figure ticket 14 recorded as a comment
because the roster it describes did not exist yet.

It is accepted rather than tuned away, for the reasons ADR 0065 set out at
length and which have not changed. The rise is phase coincidence rather than
loudness: the new marimba's RMS is *lower* than the sample it replaces, its
mallet transient is 19.6 dB above its own RMS and lands 5 ms in, and trimming
1 ms off the front of the file swings the figure between 2.74 and 3.30. Any
constant chosen here would be tuning to the test.

More to the point, this is not a new class of problem. The app has no peak
control, only gain staging sized against a representative case, and the loudest
thing it can build involves no pitch at all: `measureChordLevels.mjs` re-run on
the activated manifest hill-climbs to **3.849 raw, 1.155 after `MASTER_GAIN`**,
on a 19-row subset with every row playing one plain voice. That figure moved
from ADR 0065's 3.703 for the honest reason that three more voices can now be
rows, and it is still 1.1 dB above the case this ticket is accused of
introducing. The shaped-chord search came *down* with the real samples, to 3.477
(1.043) from 3.787.

So activation adds one more case over 1.0 to a list that already had two, and
does not create the loudest of them. Peak control is what would fix all of them,
it is what ADR 0062 and ticket 09 both concluded, and it is a separate piece of
work rather than a constant in this PR.

### The default clip keeps exactly one lane, and that is not an accident

Marimba is one of the six rows `blankPattern` gives a fresh clip and the
first-visit seed starts from, so activation adds 112px of grid to the first
thing a child sees. Measured at 390x844 with the roster live: **484px of content
against a 484px rows box**. It fits to the pixel and does not scroll, which is
ADR 0063's "one expanded lane fits the rows box exactly" confirmed on the real
manifest rather than a patched one.

A second pitched row in the default six would overflow it - a seven-row clip
with marimba and trumpet measures 646 against a 500px box - and shipping such a
clip pre-folded is impossible, because collapse is not persisted (spec §4,
grill Q8). So the default clip is left alone, and the other three pitched
instruments are reached the way any other sound is: through the picker.

## Consequences

- **The roster is 23 and the picker's Notes group is 9.** `kitManifest.test.ts`'s
  group counts move from 10 / 6 / 4 to 10 / 9 / 4, and its dormancy assertion is
  replaced by the register table it was always going to become.
- **Nothing outside `kit.json` lists which instruments are pitched any more.**
  `kitLevels.test.ts`'s `PITCHED_IDS`, `pitchedRoots.test.ts`'s `REGISTERS`, the
  same list in `renderSequence.test.ts`, and the copies in
  `renderLaneAudition.mjs`, `measureChordLevels.mjs` and
  `measureExportAliasing.mjs` all read the manifest instead. That is "kits are
  pure data" reaching the last places that had a private copy of the roster, and
  `measureChordLevels.mjs` actually needed it: it added its three unlisted
  voices on top of the manifest, so after activation it would have measured a
  26-voice roster with three of them counted twice.
- **`semitonesForInstrument` returns `number | undefined`.** Every caller has to
  say what it means for an instrument with no lane, which is the point; the two
  that mix audio answer it the same way, by sounding the column once.
- **A handful of suites moved off the marimba row.** It is a lane now, so tests
  that used it as a convenient drum cell (`grid.iwft`'s audition,
  `keyboard.iwft`'s Enter, `firstVisit.iwft`'s tablet reset) use a drum instead,
  and `verifyGridIsSixBySixteen` counts a row's step columns in either shape. A
  twelve-row clip's arrow walk costs seven extra presses, because down walks a
  lane's eight tiles before it leaves the row.
- **`samplePattern` no longer rebuilds its rows field by field.** It spread the
  blank row's `instrumentId` and `steps` and dropped everything else, which is
  the way `swapRowInstrument` used to lose a melody (ticket 13). No authored
  sample clip has a melody to lose today, and now none could.
- **`pitchedLane.iwft` still patches the manifest for most of its tests.** Each
  one states the register it measures, so a future re-rooting of the kit cannot
  quietly change what they mean; the two at the bottom are about the shipped
  manifest itself and route nothing.
- **Two human gates stand between this and `main`**: Ed's ear check on the fresh
  `renderLaneAudition.mjs` render, and his eye on ticket 05's trumpet, piano and
  double-bass artwork. Neither is a measurement, and neither can be discharged
  by this PR.

## Alternatives considered

- **Insert the three new instruments beside marimba in the manifest.** It would
  group the pitched voices together in the picker. Rejected: the classic six
  lead the manifest and their positions are load-bearing (`blankPattern`, the
  authored sample clips, the positional hue cycle), so anything inserted before
  `boop` shifts them. Appending is what an additive kit change looks like.
- **Convert a second default row so the lane reads as normal rather than as the
  odd one out.** Rejected on the phone measurement above: the default clip would
  open scrolling, and there is no way to ship it folded.
- **Drop `MASTER_GAIN` to 0.29 so the 23-voice case lands under 1.0.** It closes
  one case and leaves the two that were already over, quietens the whole app for
  a peak that a 1 ms trim moves by 20%, and would have to move again on the next
  sample change. Peak control is the fix; a smaller number is a smaller version
  of the same gap.
- **Refuse a pitched row on an unflagged instrument at `setPattern`.** Covered
  above: it turns a newer build's document into the loss of every boop a child
  has, which is the opposite of what the degradable-additive save format is for.
- **Keep `semitonesForInstrument` returning 0 and gate the unison separately in
  each mixer.** The rule would then be written twice, in the engine and in the
  export, with nothing tying them together - the exact drift `rowPitchMasks`
  exists to prevent one layer down.
