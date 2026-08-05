# 12 — SequencerEngine + Tone.js implementation + kit manifest

**What to build:** The sound engine behind the whole app: a `SequencerEngine`
TypeScript interface inside `apps/boop` with a Tone.js (tree-shaken)
implementation, loading its six instruments from a JSON kit manifest with
placeholder one-shot samples. No UI in this ticket — verified by unit tests.
The full contract is in the beat-event system ticket
([05](05-beat-event-system.md)) and the spec's Architecture section.

**Blocked by:** 11 — Scaffold `apps/boop`.

**Status:** claimed

- [ ] `SequencerEngine` interface; Tone.js never leaks through it
- [ ] Schedule-time beat events are the canonical seam; a draw-time
      convenience subscription also exists
- [ ] Payload `{ tick, step, audioTime, hits: [{ instrumentId }] }`, one
      event per step including empty steps; `tick` monotonic, `step` = tick
      mod 16
- [ ] `songPos()` continuous query, re-anchored each scheduled beat
- [ ] Transport events `started`/`stopped` and `tempoChanged { bpm }`
- [ ] Pattern is readable state, not an edit stream; audition-on-toggle is
      engine-internal (plays the sample when a cell is turned on while
      stopped)
- [ ] Kit loaded from a JSON manifest (opaque `instrumentId`, display name,
      artwork ref, sound file, optional `role`); six placeholder one-shots
      ship so the engine is audible
- [ ] Gesture-gated audio start; iPad `interrupted` AudioContext state
      handled; no DOM work in scheduler callbacks
- [ ] Engine contract unit-tested (`*.test`): event payloads, tick
      monotonicity, tempo change, transport, audition
