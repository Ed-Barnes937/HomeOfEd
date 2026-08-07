# 12 — SequencerEngine + Tone.js implementation + kit manifest

**What to build:** The sound engine behind the whole app: a `SequencerEngine`
TypeScript interface inside `apps/boop` with a Tone.js (tree-shaken)
implementation, loading its six instruments from a JSON kit manifest with
placeholder one-shot samples. No UI in this ticket — verified by unit tests.
The full contract is in the beat-event system ticket
([05](05-beat-event-system.md)) and the spec's Architecture section.

**Blocked by:** 11 — Scaffold `apps/boop`.

**Status:** resolved

- [x] `SequencerEngine` interface; Tone.js never leaks through it
- [x] Schedule-time beat events are the canonical seam; a draw-time
      convenience subscription also exists
- [x] Payload `{ tick, step, audioTime, hits: [{ instrumentId }] }`, one
      event per step including empty steps; `tick` monotonic, `step` = tick
      mod 16
- [x] `songPos()` continuous query, re-anchored each scheduled beat
- [x] Transport events `started`/`stopped` and `tempoChanged { bpm }`
- [x] Pattern is readable state, not an edit stream; audition-on-toggle is
      engine-internal (plays the sample when a cell is turned on while
      stopped)
- [x] Kit loaded from a JSON manifest (opaque `instrumentId`, display name,
      artwork ref, sound file, optional `role`); six placeholder one-shots
      ship so the engine is audible
- [x] Gesture-gated audio start; iPad `interrupted` AudioContext state
      handled; no DOM work in scheduler callbacks
- [x] Engine contract unit-tested (`*.test`): event payloads, tick
      monotonicity, tempo change, transport, audition

## Comments

Resolved 2026-08-05 (agent, Opus). Landed in `8dba93b` on `music-app`.
`SequencerEngine` interface + `createSequencerEngine` with an inner
`AudioDriver` seam: `toneAudioDriver.ts` is the only file importing `tone`;
the contract is unit-tested against a hand-cranked `fakeAudioDriver` (no
AudioContext). Kit manifest (versioned JSON, opaque ids, optional role) with
six synthesized placeholder one-shots + handoff placeholder artwork.
Decisions in ADR 0024 (notably: stop is a pause — monotonic tick never
rewinds). Code review fixed four real songPos/tempo/draw-cancel faults, and
added a master gain + limiter so six simultaneous voices don't clip.
Deviations kept: `setPattern()` + 60–200 BPM clamping (needed by presets/
grooves/share links); synthesized rather than sourced placeholders (ticket
18 replaces them). Gate re-verified by orchestrator: lint/typecheck clean,
vitest 48/48, playwright CT 3/3.
