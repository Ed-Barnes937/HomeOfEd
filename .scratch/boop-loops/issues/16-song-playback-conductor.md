# 16 — Song playback: the conductor

**What to build:** The song play button works: tapping it plays the song's
placements left to right, looping, gapless — empty positions skipped. As each
position starts, the grid switches to that clip and its lane square gets the
playing ring (same hard-cut timing as the grid playhead). Only one mode plays
at a time; tapping a chip while the song plays stops the song. Speed drives
both modes.

Mechanics per the spec — **no `SequencerEngine` contract change**. The
conductor is a ~30-line layer above the existing seam, lifted in shape from
the `prototype/03-song-mode` branch: it subscribes to `onBeat` and at step 15
calls `setPattern` with the next position's clip, which lands before tick 16
is scheduled — gapless by construction. The sounding clip/position shown to
the child must come from the draw channel (`onDrawBeat`), never by re-reading
`getPattern()` at swap time, or the grid flashes the next clip one lookahead
(~0.1–0.15s) early.

Spec: §9 (playback).

**Blocked by:** 15 — Laptop clip lanes.

**Status:** ready-for-agent

- [ ] Song mode plays placements left to right, skips empty positions, and loops the song; an all-empty song's play behaviour matches the spec (song sequence is the non-empty placements)
- [ ] Gapless swaps proven deterministically against `FakeAudioDriver` (unit tests) and by ear against the real driver
- [ ] The grid follows the sounding clip via the draw channel; no early flash of the next clip
- [ ] The playing ring walks the lane squares in step with the sound
- [ ] One mode at a time: starting either play stops the other; tapping a chip during song play stops the song
- [ ] Speed changes affect both modes and count as edited
