# 17 — Playhead + hit motion

**What to build:** While playing, a column highlight sweeps the grid in time,
and cells react with motion (bounce/squash — never a flash of light) when the
playhead strikes them. Driven by the engine's draw-time subscription so
visuals stay in sync with audio.

**Design:** the motion spec is now final — see the handoff
(`docs/reference/boop-design/README.md`): the playhead is a soft cyan column
that hard-cuts step to step (never fades or pulses — the jump is the
rhythm); struck cells squash 1.2/0.82 over 320ms with the given keyframes;
the row label bobs 4px/180ms on every hit in its row; cell under-playhead
states and the playhead column geometry/gradient are specified exactly.
Honour `prefers-reduced-motion: reduce` (playhead moves, no squash).

**Blocked by:** 13 — First sound: tap-to-toggle grid + play/pause.

**Status:** resolved

- [x] Cyan playhead column hard-cuts step to step, driven by the draw-time
      channel (no DOM work in scheduler callbacks); bar numerals track the
      current bar
- [x] Struck cells squash per the design keyframes; row labels bob on hits
      in their row; no strobe/flash anywhere
- [x] `prefers-reduced-motion` disables the squash/bob but keeps the
      playhead moving
- [x] Playhead disappears (or rests) cleanly when stopped; play resumes
      without resetting the pattern
- [x] Stays visually in sync after tempo changes
- [x] Whole-frontend test asserts the playhead advances during playback

## Comments

Resolved 2026-08-06 (agent, Sonnet). Landed in `90b3e2f` on `music-app`.
Pure reducer (`playheadMotion.ts`, unit-tested) folds draw-time beat events
into `{ step, cellStrikes, rowStrikes }`; `usePlayheadMotion` is the only
onDrawBeat/onTransport subscriber — onBeat (schedule-time) is never touched
by UI. Playhead column built to the handoff geometry per breakpoint,
hard-cut (no transition), unmounts when stopped; squash (exact keyframes)
and row-label bob replay via epoch-keyed remounts; both behind
prefers-reduced-motion while the playhead keeps moving. 4 new iwft tests
incl. a tempo-change sync test added after code review flagged the gap.
Gate re-verified by orchestrator: lint/typecheck clean, vitest 101/101,
playwright CT 14/14.

Follow-up flagged (not in scope here): `FakeAudioDriver.fireStep` float
drift — `clock + 0.1` accumulation makes `advanceTo`'s `<=` drop draws
after 3+ chained fireSteps; future multi-step iwft tests will hit it.
Candidate fix: epsilon or ms-rounding in the comparison.
