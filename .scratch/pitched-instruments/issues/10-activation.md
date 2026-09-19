# 10 - Activation: four pitched instruments go live

**Status:** ready-for-agent (merge gated ready-for-human: ear check + art eye)
**Blocked by:** 02, 04, 05, 06, 07, 08, 09, 11, 12

**What to build:** The switch-flip. `kit.json` gains trumpet, piano and
doublebass (group `notes`, ticket 05 artwork, ticket 04 sounds) and flags those
three plus marimba as `pitched`. The instrument picker's Notes group now offers
four pitched sounds; audition in the picker plays the anchor pitch. Conversion
acceptance is the heart of the ticket: existing saved boops and share links
using marimba must sound **byte-identical** (anchor = current sample, spec §3)
and display their old hits at "so", mid-lane.

Decisions this implements: R2-1 roster (**as revised by ADR 0059**), R2-2
conversion rule, grill Q3.

## The roster is FOUR, not five - read ADR 0059 before anything

This ticket was written before ticket 04 measured the shipped samples, and its
original text is wrong in three ways that matter. The authority is
[ADR 0059](../../../docs/adr/0059-boop-pitched-lane-is-in-f-major.md):

- **The key is F major, not C.** The anchor is "so", so a lane's `do` sits 7
  semitones *below* the root sample: an F-major lane needs a **C** root.
- **`boop` is dropped.** It has no stable pitch at all - it glides 3.2
  semitones with ~90% of its energy in the first 50ms. No key exists for it. It
  stays a one-note instrument and gains nothing.
- **`bass` is not converted.** It measures ~F#2 with a 1.2 semitone glide, so
  converting it would have put its lane in B major against everyone else's F
  *and* changed a sound saved boops already use. The pitched bass is a **new**
  instrument, `doublebass`, and the existing `bass` is untouched forever.
  **Two basses in the kit is deliberate - do not let anyone tidy them into
  one.** Merging them silently rewrites every saved boop that uses `bass`.

Ticket 04's Comments hold the copy-paste-ready `kit.json` entries and the
measured registers (marimba C5, trumpet C5, piano C4, doublebass C3). Use them
rather than re-deriving anything.

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

### 2026-09-18 - ticket text corrected to match ADR 0059

Rewritten by the orchestrator, not by a build agent: the original said five
instruments including `boop`, and named `bass` as a conversion target. Both
were settled otherwise by ticket 04's measurements and Ed's ruling. Blocked-by
also gained 11 and 12, which were chartered after this ticket was written.
