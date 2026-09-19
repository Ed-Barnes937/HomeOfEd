# 10 - Activation: four pitched instruments go live

**Status:** ready-for-human - built, PR open, merge gated on Ed's ear check + art eye
**Blocked by:** 02, 04, 05, 06, 07, 08, 09, 11, 12, 13, 14, 15

**What to build:** The switch-flip. `kit.json` gains trumpet, piano and
doublebass (group `notes`, ticket 05 artwork, ticket 04 sounds) and flags those
three plus marimba as `pitched`. The instrument picker's Notes group now offers
four pitched sounds; audition in the picker plays the anchor pitch. Conversion
acceptance is the heart of the ticket: existing saved boops and share links
using marimba must sound **byte-identical** (anchor = current sample, spec §3)
and display their old hits at "so", mid-lane.

Decisions this implements: R2-1 roster (**as revised by ADR 0059**), R2-2
conversion rule, grill Q3.

## The roster is FOUR, not five - read ADR 0065 before anything

This ticket was written before ticket 04 measured the shipped samples, and its
original text is wrong in three ways that matter. The authority is
[ADR 0065](../../../docs/adr/0065-boop-real-instrument-samples-in-c-major.md),
which supersedes 0059 - **anything below citing 0059 or F major is stale**:

- **The key is C major.** The anchor is "so", so a lane's `do` sits 7
  semitones *below* the root sample: a C-major lane needs a **G** root. ADR
  0059 chose F major only because marimba's shipped C5 sample was immovable;
  Ed ruled "assume no real users" on 2026-09-19 and ticket 14 replaced all
  four samples, so that constraint is gone.
- **`boop` is dropped.** It has no stable pitch at all - it glides 3.2
  semitones with ~90% of its energy in the first 50ms. No key exists for it. It
  stays a one-note instrument and gains nothing.
- **`bass` is not converted.** It measures ~F#2 with a 1.2 semitone glide, so
  converting it would have put its lane in B major against everyone else's F
  *and* changed a sound saved boops already use. The pitched bass is a **new**
  instrument, `doublebass`, and the existing `bass` is untouched forever.
  **Two basses in the kit is deliberate - do not let anyone tidy them into
  one.** Merging them silently rewrites every saved boop that uses `bass`.

**Registers come from ticket 14, not ticket 04.** Ticket 04's C roots are
F-major and stale. The shipping layout is marimba **G4**, trumpet **G4**,
piano **G3**, doublebass **G2** - ADR 0059's approved arrangement moved down a
perfect fourth, so every relationship Ed accepted by ear survives. Take the
copy-paste `kit.json` entries from ticket 14's Comments.

**Inherited level finding, and it is yours to close or accept.** With the real
samples the app's *searched* worst cases all improved by 0.7-0.8 dB, but the
representative "23 rows solid, one voice each" case rose to 3.386 raw =
**1.016 after `MASTER_GAIN`** - a case that only becomes reachable when you
activate the roster, and the first one to cross full scale by activation
rather than by painting. It is recorded in `kitLevels.test.ts` as a comment,
not an assertion, because the roster it describes does not exist until this
ticket. Ticket 14 deliberately did not tune it away: the rise is phase
coincidence rather than loudness (the new marimba's RMS is *lower* than the
sample it replaces, and trimming 1 ms off its front swings the figure between
2.74 and 3.30). Do not close it with a constant. Either accept it - the app
already reaches 1.111 on drums alone with no pitch involved - or put peak
control to Ed, which is what ticket 09 concluded too.

## Carry-forwards from the rest of the epic

Recorded as they surfaced, so activation does not rediscover them:

- **Ticket 03** defined `semitonesForInstrument` but nothing calls it -
  `createSequencerEngine` still calls `semitonesFromAnchor` directly. Move the
  call sites, **and decide** what happens to pitches on an unflagged
  (one-note) instrument: zeroed, or refused. That decision needs recording.
- **Ticket 09** left `kitLevels.test.ts` green because it reads the roster from
  the sounds directory. To do here: roster count 20 -> 23, and delete
  `PITCHED_IDS` in favour of reading `pitched` off the manifest. If a register
  moves on the ear check, re-run `measureChordLevels.mjs` - doublebass at C3 is
  the loudest chord in the kit.
- **Ticket 13** found a trap with a trigger rather than a bug, and left it
  alone deliberately: `samplePattern` rebuilds a sample clip's rows as
  `{ instrumentId, steps }`, dropping `pitches` exactly the way
  `swapRowInstrument` did. It is correct today because every authored sample
  clip is step-only. **If activation gives any sample clip or the first-visit
  seed a melody, that line silently flattens it.** Either keep the clips
  step-only or fix the line; do not leave it to chance.
- **Ticket 08** found the phone's vertical budget: on a 390x844 phone **one**
  expanded lane fits the rows box exactly; **two overflow by 96px** and scroll.
  So the default clip's composition is now a real decision - if it ships two
  pitched instruments, the phone opens on a scrolling grid, and shipping them
  pre-folded is impossible today because collapse is not persisted (spec §10,
  ADR 0061). **Sanity-check the default clip on a phone before flipping the
  roster**, and put the options to Ed rather than choosing silently.

Acceptance criteria:

- [x] A pre-epic save-document fixture (built from today's `saveFormat` output
      with marimba rows) loads with every old hit at the anchor pitch; an
      offline render of that boop is sample-identical to a render through the
      manifest as it was one commit earlier. (**Corrected wording:** this bullet
      said "the pre-epic render", which ticket 14 made impossible to mean
      literally - marimba's sample changed then, so a pre-epic render would
      differ for a reason that is not this ticket's. See the build comment.)
- [x] Old share links round-trip the same way.
- [x] Fresh-grid defaults, sample clips and the first-visit seed still make
      sense, checked **on a phone** against the vertical budget above. Any
      change to the default rows is a decision to note here for Ed.
- [x] Picker: four pitched instruments appear in Notes with artwork; adding one
      to a clip renders the lane; audition sounds the anchor.
- [x] `kitLevels.test.ts` roster and `PITCHED_IDS` updated; the chord budget
      still closes with the roster live.
- [ ] Ear check (ticket 04's gate) and art eye check (ticket 05's gate) both
      passed by Ed - **this PR does not merge before both.**
- [x] Full verify loop plus a play-check script for Ed (what to tap, what to
      listen for), per the house merge ritual.

## Comments

### 2026-09-19 - built: the roster is live, and the three open calls are answered

[ADR 0067](../../../docs/adr/0067-boop-the-pitched-roster-goes-live.md) holds the
reasoning; this is the shape of it and the handover. Every acceptance criterion
is met except the two human gates, which is why the PR is open and not merged.

**The switch.** `kit.json` gains trumpet, piano and doublebass at the end of the
`notes` group, and those three plus marimba carry ADR 0065's registers verbatim
(G4, G4, G3, G2). Appended rather than inserted beside marimba, because the
classic six lead the manifest and their positions are load-bearing -
`blankPattern`, the authored sample clips and the positional hue cycle all read
them. `bass` and `boop` are untouched.

**Conversion acceptance is a test, not a claim.** `src/pitchedActivation.test.ts`
holds a frozen pre-epic save document - two clips, marimba rows, the pre-layering
`placements` form - and asserts four things about it: it re-serializes to the
same bytes, its marimba row grows no `pitches` at decode and reads as the anchor
at every on step, the engine hands the driver a call with no `semitones` and no
`gain`, and an offline render is **sample-for-sample identical** to the same
render through a kit with the `pitched` blocks stripped. The share link
round-trips to the same document. The comparison is deliberately against this
build one commit earlier rather than against pre-epic audio: marimba's sample
changed in ticket 14, and folding that in would measure a decision Ed already
took separately.

### 2026-09-19 - fresh-context review round

A Sonnet reviewer went over the branch with the ticket, the spec and the ADRs
and nothing of my reasoning. It found nothing blocking and no standards
violations, and it re-derived the level constants independently rather than
taking them on trust - tightening `ROSTER_BUDGET` and `SINGLE_HIT_BUDGET` by
hand and watching the tests fail at exactly the measured values (3.386 and
3.1106), which is the check that would have caught a loosened pin. Three
observations, all acted on:

- **The acceptance criterion's own wording was stale.** It asked for a render
  "sample-identical to the pre-epic render", and ticket 14 made that impossible
  to mean literally. The bullet is corrected above.
- **The "before" kit in the identity test was the 23 with registers stripped,
  not the real 20.** A fair catch, and it mattered more than it looked: the
  render pads its tail by the longest sample in the kit, so three new voices
  could have lengthened an old boop's exported file without changing a note.
  The test now drops the three entries as well, and asserts the length. They
  turn out not to have mattered - cymbal and marimba are both 390 ms and both
  predate this ticket - but that is now measured rather than assumed.
- **`setCell` does not refuse a pitch on a one-note row.** Unreachable from the
  UI, since lanes only render for pitched instruments, and deliberate: accepting
  and then ignoring is what `setPattern` and the save format both do, so
  refusing here would be the only write in the app that behaved differently.
  There is now a comment saying so.

### The three calls you asked me to bring back

**1. The default clip on a phone - no change needed, and it is close.** Measured
at 390x844 with the roster actually live: the default six rows are **484px of
content in a 484px rows box**. It fits to the pixel and does not scroll, because
marimba is the only pitched row in the default six. A second one would overflow
- a seven-row clip with marimba and trumpet measures 646 against a 500px box -
and pre-folding is impossible while collapse is unpersisted. So the recommendation
is ship as is, and the measurement is now an iwft
(`phonePitchedLane.iwft.tsx`, "the shipped default clip on a phone") rather than
a number in a comment. Worth knowing: activation costs the default clip 112px, so
at 640 and below the rows box scrolls where it previously scrolled less. It
already scrolled there on all drums (372 into 320), so this is a degree, not a
new behaviour, and `playBarPinned.iwft` still has clip play reachable at every
height down to 380.

**2. The ticket 03 carry-forward - ignored, not zeroed and not refused.**
`semitonesForInstrument` now returns `number | undefined`, the engine and the
offline render both call it, and an unflagged row sounds **once** per on step on
the base sample whatever pitch data its column holds.

Zero is the obvious reading and it is the wrong one: a column holding a chord
would become several copies of one untransposed sample starting on the same
frame, a coherent unison worth up to +9 dB that the `1/sqrt(n)` law is not sized
for, because that law assumes the notes differ. Refusing in `setPattern` is
worse still - the only way pitch data reaches a one-note row is a newer build's
document, and `saveFormat`'s all-or-nothing decode would turn that into the loss
of every boop the child has. Spec §4 had already ruled: a stale build "plays the
rhythm on the base sample". One bonus over what §4 anticipated - the data
survives the read, so a round trip through this build hands the melody back
intact to the build that understands it.

**3. The 1.016 finding - accepted, and peak control is worth chartering.**
`ROSTER_BUDGET` moves 3.31 -> 3.39 because the case it measures is now the
activated 23, measured 3.386 raw and 1.016 after `MASTER_GAIN`. No constant was
touched to hide it, for the reason ticket 14 gave: the rise is phase
coincidence, a 1ms front trim swings it between 2.74 and 3.30, and picking the
trim that lands it low is tuning to the test.

The wider point is that this is not a new class of problem, and activation does
not create the loudest case. I re-ran `measureChordLevels.mjs` on the activated
manifest: the hill-climbing search over which rows are on, with no pitch
involved anywhere, reaches **3.849 raw = 1.155**, which is 1.1 dB above the case
this ticket is accused of introducing. That figure did move - ADR 0065 had it at
3.703 - for the honest reason that three more voices can now be rows. The shaped
chord search came *down* to 3.477 (1.043) from 3.787.

ADR 0062 and ticket 09 both landed on peak control as the fix and both put it
out of scope. I have done the same rather than escalating it as a blocker on
this ticket, but it is now the third time it has come up, so **it wants a ticket
of its own** and that is a call for you and Ed rather than for me.

### What else moved, and why

- **Nothing outside `kit.json` lists which instruments are pitched.**
  `kitLevels.test.ts`'s `PITCHED_IDS` is gone, `pitchedRoots.test.ts`'s
  `REGISTERS` is gone, the same list in `renderSequence.test.ts` is gone, and
  `renderLaneAudition.mjs`, `measureChordLevels.mjs` and
  `measureExportAliasing.mjs` read the manifest too. Roster count 20 -> 23,
  picker groups 10 / 6 / 4 -> 10 / 9 / 4. `measureChordLevels.mjs` needed it:
  it added its three unlisted voices on top of the manifest, so after activation
  it would have measured 26 voices with three counted twice.
- **`samplePattern`'s trap is closed structurally**, not by care: it spreads the
  authored row over the blank one instead of naming `instrumentId` and `steps`,
  so a `pitches` added to `SampleRowSteps` later cannot be dropped there. The
  clips themselves are still step-only.
- **Some suites moved off the marimba row**, which is a lane now: `grid.iwft`'s
  audition, `keyboard.iwft`'s Enter and `firstVisit.iwft`'s tablet reset use a
  drum instead, and `verifyGridIsSixBySixteen` counts a row's step column in
  either shape. A twelve-row clip's arrow walk costs seven extra presses,
  because down walks a lane's eight tiles before it leaves the row.

**Verify loop:** `pnpm lint`, `pnpm typecheck`, `pnpm --filter boop run test` all
green - 631 unit, 314 iwft.

### The play check, once the ear check and the art check are done

Fresh audition render at `~/Desktop/boop-lane-audition/` - an octave walk per
instrument plus `ensemble.wav`. It is genuinely new work even though there was a
preview: the samples are different, the key moved to C, and the double bass went
from plucked to bowed.

Then, in the app:

1. **Open it cold.** The grid should show marimba as a lane and the other five
   rows as cells, with `C D E F G A B C` down the lane's gutter. On a phone the
   grid should not scroll at all at full height.
2. **Load an old boop from My boops** (or open a share link you sent before this
   week). Every marimba hit should sit mid-lane, on the "so" row, and the boop
   should sound exactly as it did. This is the one thing the whole ticket is
   about.
3. **Add a sound** from the picker: Trumpet, Piano and Double bass are at the
   bottom of Notes. Each should arrive as its own lane, and each lane's gutter
   should read `C D E F G A B C` - the same letters at different octaves, which
   is the point of the key.
4. **Play a tune across all four.** Paint the same shape on each lane and listen
   for whether they agree; then stack a chord in one column and check the level
   does not jump.
5. **Tap the double bass low** (the bottom two cells) on the tablet and then on
   the phone speaker. Does it speak, or is it a rumble? This is the register
   question ADR 0065 flagged and it is the one only you can answer.

### 2026-09-19 - Ed's play-through added three blockers, and the key changed

Ed previewed the activated roster locally (a temporary uncommitted `kit.json`)
and the registers passed: the instruments sound in tune alone and together.
Three things came out of it, all chartered rather than folded in here:

- **13** - swapping a pitched row's instrument drops its `pitches` and
  flattens the melody. A defect in the epic's own work, dormant on main.
- **14** - real sourced samples (CC BY 3.0) replacing the synthesized ones,
  **and the key moves to C major**. Ed ruled "assume no real users", which
  removes the single constraint that made ADR 0059 pick F major. Ticket 14
  supersedes 0059 and re-roots every pitched instrument on G.
- **15** - note names down the left of the lane, reversing spec §10.

**Two things here are now stale and ticket 14 replaces them.** The registers
in ticket 04's Comments are F-major roots on C and must not be copy-pasted;
take the C-major roots from ticket 14 instead. And the ear check in the
criteria below is **not** discharged by the play-through above - it has to be
redone against the samples that actually ship.

The `kitLevels` and chord-budget carry-forwards below still stand, but ticket
14 re-runs those measurements first, so read its numbers rather than ticket
09's.

### 2026-09-18 - ticket text corrected to match ADR 0059

Rewritten by the orchestrator, not by a build agent: the original said five
instruments including `boop`, and named `bass` as a conversion target. Both
were settled otherwise by ticket 04's measurements and Ed's ruling. Blocked-by
also gained 11 and 12, which were chartered after this ticket was written.
