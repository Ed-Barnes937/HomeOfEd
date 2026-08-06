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

**Status:** claimed

- [ ] Cyan playhead column hard-cuts step to step, driven by the draw-time
      channel (no DOM work in scheduler callbacks); bar numerals track the
      current bar
- [ ] Struck cells squash per the design keyframes; row labels bob on hits
      in their row; no strobe/flash anywhere
- [ ] `prefers-reduced-motion` disables the squash/bob but keeps the
      playhead moving
- [ ] Playhead disappears (or rests) cleanly when stopped; play resumes
      without resetting the pattern
- [ ] Stays visually in sync after tempo changes
- [ ] Whole-frontend test asserts the playhead advances during playback
