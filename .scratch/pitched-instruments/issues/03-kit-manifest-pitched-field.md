# 03 - Kit manifest: the `pitched` instrument config

**Status:** ready-for-agent
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

- [ ] Manifest parse accepts entries with and without `pitched`; malformed
      `pitched` fails the kit load the same way other manifest corruption
      does today.
- [ ] One pure function maps (instrument, pitchIndex 0-7) to a semitone
      offset from the root sample, anchored at so = the sample; unit-tested
      including the octave ends (do and high do an octave apart).
- [ ] `public/kits/launch/kit.json` unchanged in behaviour (no entry flagged).
- [ ] `apps/boop/CLAUDE.md`'s "kits are pure data" rule still true - adding a
      pitched instrument later means editing kit.json + dropping files only.

## Comments
