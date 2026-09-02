# 08 - Gain budget re-verification and export over uneven rows

**What to build:** The two whole-system checks the row model changes.

**Gain.** `ToneAudioDriver`'s `MASTER_GAIN` (0.6) + Limiter(-1) were tuned
against six voices at peak 0.5 summing to ~1.83 raw. The worst case is now
the biggest simultaneous union of instruments across **layered clips** (up to
5 clips, each with its own rows, sounding the same step) - potentially far
more than six voices. Measure the realistic worst case (spec §3: measured,
not assumed), retune `MASTER_GAIN` if the limiter would pump audibly, and
rewrite the `kitLevels` dense-hit budget test to assert the **new** stated
budget (coordinating with ticket 01's interim change so the test never
silently weakens). Record the tuning rationale where the current one lives
(the driver comment + kitLevels).

**Export.** `renderSequence`/`renderBoopWav` iterate pattern rows already;
verify WAV export against a song whose clips have uneven row sets (different
counts, different instruments, layered placements) and against a
picked-but-unpainted clip. No redesign expected - this is a verification
ticket that fixes what it finds.

Spec: §3 (gain), §6 (export).

**Blocked by:** 01 (the 20 voices), 03 (mixed-row songs decode); layering
worst cases also want 04.

**Status:** ready-for-agent

- [ ] The worst-case simultaneous union is stated (with the measurement method) in the driver comment, and `MASTER_GAIN` is retuned or confirmed against it
- [ ] `kitLevels` budget test asserts the new stated budget over the new worst case
- [ ] An ear check at 200 bpm with a deliberately dense layered song: no audible pumping or clipping (note the result in this ticket)
- [ ] WAV export unit tests cover uneven row sets across layered clips and an all-off row; output matches live playback's row semantics
