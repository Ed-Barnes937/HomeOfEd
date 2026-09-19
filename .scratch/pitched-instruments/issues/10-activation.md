# 10 - Activation: four pitched instruments go live

**Status:** ready-for-agent (merge gated ready-for-human: ear check + art eye)
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

- [ ] A pre-epic save-document fixture (built from today's `saveFormat` output
      with marimba rows) loads with every old hit at the anchor pitch; an
      offline render of that boop is sample-identical to the pre-epic render.
- [ ] Old share links round-trip the same way.
- [ ] Fresh-grid defaults, sample clips and the first-visit seed still make
      sense, checked **on a phone** against the vertical budget above. Any
      change to the default rows is a decision to note here for Ed.
- [ ] Picker: four pitched instruments appear in Notes with artwork; adding one
      to a clip renders the lane; audition sounds the anchor.
- [ ] `kitLevels.test.ts` roster and `PITCHED_IDS` updated; the chord budget
      still closes with the roster live.
- [ ] Ear check (ticket 04's gate) and art eye check (ticket 05's gate) both
      passed by Ed - **this PR does not merge before both.**
- [ ] Full verify loop plus a play-check script for Ed (what to tap, what to
      listen for), per the house merge ritual.

## Comments

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
