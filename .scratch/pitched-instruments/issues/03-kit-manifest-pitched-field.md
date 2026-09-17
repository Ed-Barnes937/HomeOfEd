# 03 - Kit manifest: the `pitched` instrument config

**Status:** ready-for-human (built, PR open)
**Blocked by:** 01

**What to build:** `KitInstrument` and `kit.json` parsing gain an additive,
optional `pitched` config carrying what the lane and driver need: the
instrument's register (which absolute pitch its root sample is, so "do"
lands where the manifest says) and the anchor semantics from spec §3 (the
root sample IS the anchor pitch "so"; semitone offsets for the 8 lane
pitches derive from it in one place). Kits stay pure data: nothing outside
the manifest enumerates instruments, and an entry without `pitched` is
one-note exactly as today. `role`/`group` are untouched taxonomy. No launch
instrument is flagged pitched in this ticket (activation is ticket 10) -
manifest parsing, types, and the derivation are what land here.

Decisions this implements: spec §3; grill Q3 consequence (pitched is its own
field, role stays taxonomy).

Acceptance criteria:

- [x] Manifest parse accepts entries with and without `pitched`; malformed
      `pitched` fails the kit load the same way other manifest corruption
      does today.
- [x] One pure function maps (instrument, pitchIndex 0-7) to a semitone
      offset from the root sample, anchored at so = the sample; unit-tested
      including the octave ends (do and high do an octave apart).
- [x] `public/kits/launch/kit.json` unchanged in behaviour (no entry flagged).
- [x] `apps/boop/CLAUDE.md`'s "kits are pure data" rule still true - adding a
      pitched instrument later means editing kit.json + dropping files only.

## Comments

**2026-09-17 (build):** The config is a register and nothing else -
`pitched: { "rootNote": "G3" }` in `kit.json`, parsed to
`{ rootNote, rootMidi }`. Rationale: the ladder, the anchor rule and the
zero-semitone root are identical for every instrument and already live in
`pitch.ts`, so the only per-instrument fact is *where* that ladder sits, and
that is exactly what ticket 04 measures off a wav. Note names rather than a
MIDI integer because ticket 04 authors this by ear.

Two functions compose with ticket 01 rather than duplicating it:
`semitonesForInstrument(instrument, pitchIndex)` (the ticket's "one pure
function" - `semitonesFromAnchor` for a flagged instrument, **zero at every
pitch** for an unflagged one, so a document claiming pitches for a drum cannot
repitch it) and `laneNoteMidi(register, pitchIndex)` (register + ladder, the
"do lands where the manifest says" rule).

The parser validates well-formedness only. The ensemble key is a property of
the registers *together*, so C major is asserted over the shipped kit in
`kitManifest.test.ts` (vacuous today, armed for tickets 04/10) rather than
baked into the engine, which knows no key.

Dormant per spec §11: `kit.json` untouched, and a test asserts the shipped kit
is still all one-note - ticket 10 rewrites that expectation.
