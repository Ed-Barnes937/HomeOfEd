# 03 — The conductor can be told where to go

**What to build:** A `seek(globalBar: number)` on `SongConductor`, jumping the
song to that bar with the right clip loaded and the right position reported.

The conductor advances monotonically today: `scheduled` and `sounding` are
closure counters, and the step-15 `setPattern` swap on `onBeat` is *how* the
pattern for a position ever gets loaded. A jump breaks both assumptions, so a
seek must:

- Resolve the global bar to a sequence index via ticket 02's timeline — not by
  re-deriving the placed sequence, which would be a second copy of it.
- Set `scheduled` **and** `sounding` to that index, and `announced` so the next
  draw reports the new position rather than swallowing it as unchanged.
- `engine.setPattern` the target position's merged pattern immediately. The
  step-15 swap is not going to do it.
- `engine.seek` (ticket 01) to the tick for that global bar.

The ordering matters: the pattern must be in place before the engine schedules
its next step from the new tick, or the first step after a jump sounds the old
clip.

Watch the layering rule. A position holding several clips sounds them merged and
the grid shows its topmost lane — a seek into a layered position must behave
exactly as arriving there by playback does, not almost.

Seeking a conductor for a song whose placements have since changed is not a case
to handle: `HomePage` disposes and rebuilds the conductor on every mutation, and
a scrub is not a mutation (spec §2).

Spec: §5 (the conductor), §2.

**Blocked by:** 01, 02


**By-hand check waived (2026-08-19).** The spec owner chose to ship without it
and fix forward. The box below is left unticked deliberately: it records a check
that was *not performed*, not one that passed.

**Status:** resolved

- [x] `seek(globalBar)` on the `SongConductor` interface, documented on it
- [x] After a seek the target position's pattern is loaded before the next step
      is scheduled — the first step after a jump sounds the *new* clip
- [x] `soundingPosition()` reads the target immediately
- [x] The next draw announces the new position even when the sequence index is
      unchanged (a jump within one position must still move the readout's bar)
- [x] Playback continues from the target and the step-15 swap picks up correctly
      from there — a seek does not desynchronise `scheduled` from `sounding`
- [x] Seeking into a layered position loads the merged pattern and reports the
      topmost lane, identically to arriving by playback
- [x] Seeking to the last bar of the last placed position wraps to the first on
      the next swap
- [x] Out-of-range bars clamp via the timeline rather than throwing
- [x] Unit-tested in `songConductor.test.ts` against `FakeAudioDriver`
- [ ] **Human, by ear:** scrub across a position boundary during playback and
      confirm the clip changes cleanly (this is where ticket 01's stale audio
      and a clip swap coincide — the worst case for spec §7.1)
