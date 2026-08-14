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

**Status:** ready-for-human

- [x] Song mode plays placements left to right, skips empty positions, and loops the song; an all-empty song's play behaviour matches the spec (song sequence is the non-empty placements)
- [ ] Gapless swaps proven deterministically against `FakeAudioDriver` (unit tests — done) and by ear against the real driver (**pending the human listen** — see comment)
- [x] The grid follows the sounding clip via the draw channel; no early flash of the next clip
- [x] The playing ring walks the lane squares in step with the sound
- [x] One mode at a time: starting either play stops the other; tapping a chip during song play stops the song
- [x] Speed changes affect both modes and count as edited

## Comments

**2026-08-14 (agent)** — Implemented. The conductor is
`apps/boop/src/song/songConductor.ts`, lifted from the prototype exactly as
issue 03 proved it: `setPattern` swap at step 15 on `onBeat`, the sounding
position advancing only on `onDrawBeat`'s step 0, no `SequencerEngine` contract
change. Unit suite `songConductor.test.ts` (FakeAudioDriver: skip/loop, gapless
across wraps, draw-vs-schedule timing, dispose); whole-page suite
`songPlayback.iwft.tsx` (ring, grid-follow with no early flash, one mode at a
time, chip-stops-song, empty song, speed mid-song).

Decisions made here, for the spec owner to promote or veto:

- **Any song mutation stops song play**, not only a chip tap — a cell toggle,
  placement change, clip add/delete/rename, Clear grid, and loading anything.
  Forced by correctness: the engine runs one lookahead ahead of the sounding
  clip, so an edit mid-song could read the *next* clip's pattern back into the
  active clip. Clip play is untouched — live editing there still works.
- **"Play this clip" during song play switches mode without a transport stop**
  (the song ends, the grid clip keeps looping); the clip control reads
  not-playing while the song plays. The song button likewise takes over from a
  running clip loop.
- **An all-empty song plays the grid clip** (ADR 0032 decision 5), no
  conductor, no ring, button still reads Stop.
- **The grid switching clips while listening autosaves `gridClip`** (a
  debounced localStorage write per position change). Not marked edited; the
  restore lands on the clip that was sounding — treated as a feature.
- **Accepted limit:** `start()` resumes from the paused tick (existing engine
  behaviour, unchanged contract), so a song started after pausing mid-pattern
  begins part-way through its first position's 16 steps — the same
  resume-where-you-stopped rule clip play has always had. From a stopped-at-
  zero start (fresh page) the song plays exactly left to right.

Remaining for a human: **the by-ear check** — `pnpm dev --filter=boop`, build
two audibly different clips, place them, play the song and listen to the joins
(A→B, B→A wrap) for any seam, flam, or dropped beat. Issue 03 already passed
this by ear for the identical conductor shape, so this is confirmation, not
open risk.
