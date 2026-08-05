# 17 — Playhead + hit motion

**What to build:** While playing, a column highlight sweeps the grid in time,
and cells react with motion (bounce/squash — never a flash of light) when the
playhead strikes them. Driven by the engine's draw-time subscription so
visuals stay in sync with audio; final motion polish waits for design, this
ticket makes the mechanism work.

**Blocked by:** 13 — First sound: tap-to-toggle grid + play/pause.

**Status:** ready-for-agent

- [ ] Moving column highlight follows the current step while playing,
      driven by the draw-time channel (no DOM work in scheduler callbacks)
- [ ] Active cells under the playhead animate with motion, not
      strobe/flash
- [ ] Playhead disappears (or rests) cleanly when stopped; play resumes
      without resetting the pattern
- [ ] Stays visually in sync after tempo changes
- [ ] Whole-frontend test asserts the playhead advances during playback
