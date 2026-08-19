# 01 — The engine can be told where to go

**What to build:** A `seek(tick: number)` on `SequencerEngine`, so the transport
can be moved to a tick in tick space whether it is playing or stopped.

Nothing else in the effort can start without it: `songPos()` is derived, and
every layer above just reads it.

The mechanics, in `createSequencerEngine.ts`:

- Set `nextTick` to the target, so the next scheduled step sounds from there.
- Re-anchor: while playing, `anchor = { pos: target, audioTime: driver.now() }`,
  the same move `setTempo` already makes so `songPos()` does not jump. While
  stopped, set `frozenPos` instead — a seek while stopped must be where a later
  `start()` resumes from.
- `driver.cancelDraws()`, so draws for the pre-jump steps never fire and no
  stale position reaches the UI.
- Emit nothing new on the transport channel. A seek is not a start or a stop,
  and `HomePage` already reacts to both.

**Audio already scheduled is allowed to sound** — up to one lookahead of it. See
spec §7.1: the `AudioDriver` contract does not change, and this is the decision
most likely to be vetoed, so prove it by ear before closing the ticket.

Spec: §5 (the engine), §7.1.

**Blocked by:** —


**By-hand check waived (2026-08-19).** The spec owner chose to ship without it
and fix forward. The box below is left unticked deliberately: it records a check
that was *not performed*, not one that passed.

Spec §7.1's veto trigger stays live: if the stale audio ever reads as a stutter
or a wrong note rather than a smear, the fix is to widen `AudioDriver` with a
cancel-scheduled-audio call.

**Status:** resolved

- [x] `seek(tick)` exists on the `SequencerEngine` interface, documented on the
      contract in `sequencerEngine.ts`, with Tone.js still not leaking through it
- [x] Seeking while playing: `songPos()` reads the target immediately and keeps
      advancing from there; no jump, no double-count against the old anchor
- [x] Seeking while stopped: `songPos()` reads the target, and a later `start()`
      resumes from it rather than from where the transport last stopped
- [x] Draws for pre-jump steps do not fire after a seek
- [x] A seek emits no `started` / `stopped` / `tempoChanged` event
- [x] Negative and non-finite targets are refused the way `setTempo` refuses
      them — no throw, no corrupt anchor
- [x] Unit-tested against `FakeAudioDriver`, never a real AudioContext
- [x] ADR 0024 amended: a new engine capability, the driver seam unchanged, with
      spec §7.1's reasoning and its veto trigger recorded
- [ ] **Human, by ear:** seek repeatedly mid-playback and confirm the stale
      audio reads as a smear, not a stutter or a wrong note (spec §7.1's veto
      trigger)
