# 0024 — boop: the SequencerEngine seam and its Tone.js driver

- **Status:** Accepted
- **Date:** 2026-08-05
- **Related:** the beat-event contract
  [`.scratch/music-app/issues/05-beat-event-system.md`](../../.scratch/music-app/issues/05-beat-event-system.md)
  and the sound-engine research
  [`.scratch/music-app/issues/01-sound-engine-research.md`](../../.scratch/music-app/issues/01-sound-engine-research.md);
  [ADR 0008](0008-apps-without-a-database.md) (boop is stateless).
  Implements ticket 12.

## Context

The beat-event contract fixed the *seam boop exposes* — schedule-time beat
events, `songPos()`, transport events, pattern-as-state — and deliberately left
no ADR, because the spec was the artifact. Building it raised three decisions
the contract does not cover, all of which outlive the ticket: how Tone.js is
kept out of the contract, how the engine is testable without an AudioContext,
and how kits are described on disk.

## Decision

1. **A second, inner seam: `AudioDriver`.** The engine owns the sequencing logic
   (tick counting, hit derivation, `songPos()` anchoring, event fan-out); the
   driver owns the AudioContext, the sixteenth-note clock and sample playback.
   `ToneAudioDriver` is the only file in the repo that imports `tone` (named
   imports, so the bundle stays tree-shaken); `FakeAudioDriver` is a
   hand-cranked clock, and the whole contract is unit-tested against it — fakes
   over mocks, no AudioContext in tests, per the repo's testing rule.
2. **Pause, not stop.** The transport is play/pause; stopping pauses the Tone
   transport and never rewinds. `tick` therefore stays monotonic for the whole
   session, `step` stays `tick mod 16`, and nothing can reset a child's place
   in the loop. `songPos()` freezes while paused and resumes from where it was,
   re-anchored at resume and on every tempo change so the playhead never jumps.
3. **Draws are cancelled on pause.** Steps already scheduled inside the
   lookahead still sound (they sit on the audio clock, not the transport), but
   their draw-time deliveries are dropped, so the visible playhead stops the
   instant the child presses pause.
4. **The kit manifest is versioned.** `kit.json` carries a `version` the parser
   refuses to read past. Kits are pure data — the app enumerates instruments
   nowhere else — and a version gate means a stale build fails loudly rather
   than half-reading a newer kit. Instrument ids stay opaque; `role` is parsed
   and carried but ignored by V1.
5. **Tempo is clamped in the engine** to the design range (60–200, integer),
   not just in the slider, so no caller can drive the transport somewhere the
   toy cannot recover from.
6. **Master gain staging.** Every hit is routed through a shared gain and a
   limiter rather than straight to the destination: six rows can land on the
   same step, and the spec requires a dense pattern not to clip.

## Consequences

- Adding instruments or a whole kit is a manifest edit plus audio files; the
  engine does not change. A V2 world layer rides the existing schedule-time
  events and `role` without a contract change.
- Swapping Tone.js for something else means writing one more `AudioDriver`;
  nothing else in boop knows it exists.
- The engine cannot be tested for real audio output by unit tests — that risk
  sits with the placeholder samples (verified as decodable and audible in
  Chromium) and, later, the whole-frontend tests.
- V1 ships synthesized placeholder one-shots
  (`apps/boop/scripts/generatePlaceholderSamples.mjs`) rather than sourced CC0
  audio, so the repo carries no third-party samples until the real kit lands.

## Amendment (2026-08-15): the engine borrows the driver, it does not own it

`SequencerEngine.dispose()` used to dispose the injected `AudioDriver` too.
That is the wrong ownership: the driver is a constructor dependency, and React's
dev double-mount builds **two** engines over the one driver and throws the first
away. Whichever engine lost the race took the shared driver's sample buffers and
output bus down with it, leaving the live engine with a moving playhead and no
sound — silent, because `play()` returns early when there are no buffers, and
therefore invisible in the console.

`dispose()` now releases only what the engine itself holds: its listeners, its
driver-state subscription, and the transport if it is running. **The `App`
component owns the driver** — one per page, for the life of the page — and does
not dispose it. `AudioDriver.dispose()` stays on the interface for a caller that
genuinely owns one (the offline render path, tests).

## Amendment (2026-08-16): the seam has no resume semantics

Decision 2 above ("pause, not stop") is withdrawn. `start()` is always **start
from the top**: it resets `nextTick` and the playhead anchor to 0 before the
driver's transport runs, so the first beat of every run is tick 0, step 0. Stop
keeps nothing to resume from — the `frozenPos` field is gone, and `songPos()`
reads 0 whenever the transport is stopped. `tick` is therefore monotonic only
within a run, not for the whole session; `step` is still `tick mod 16`.

The toy has one transport concept, not two. Resume made the audible start
depend on where the last stop happened, which reads as a bug to a 6-year-old:
press play, hear the middle of the loop. Putting the rewind inside `start()`
rather than in the callers makes it true for clip play, song play and the
spacebar alike, with no path that can opt out.

The cost is the gapless takeover between clip play and song play (ticket 22,
spec §9). Both used to switch mode over a *running* transport; both now stop
and start, so the takeover begins at the top with a small audible gap. Draws
are still cancelled on stop (decision 3), and the UI drops its last drawn step
on the `started` event so the old position cannot flash before the new run's
first beat is drawn.

## Amendment (2026-08-17): `seek(tick)`, and the driver seam stays as it is

The playhead effort
([`.scratch/boop-playhead/spec.md`](../../.scratch/boop-playhead/spec.md),
ticket 01) makes the song's position settable, so the engine grows one
capability: **`seek(tick)`**. It sets the scheduler's `nextTick`, re-anchors
`songPos()` on the target (while stopped there is no anchor to hold, so the
floor below reports the target and `nextTick` is what the next `start()` sounds
from), and cancels pending draws. It emits **no** transport event — a seek is
neither a start nor a stop, and the position is a query, not an event stream. A
seek is the *only* way the tick moves other than by counting.

Two smaller calls the ticket left to the implementation:

- **A seek lands on a whole tick.** `nextTick` is the scheduler's counter and
  `step` is `tick mod 16`, so a fractional target would break the grid column.
  Fractional targets floor; the interface says so.
- **`songPos()` gained a floor, not just a zero clamp.** Steps are scheduled a
  lookahead early, so the raw position sits up to one lookahead *behind* the step
  about to sound — which is why `songPos()` already clamped at zero for the
  song's start. A seek raises that floor to its target, so the playhead holds
  there until the target's step sounds instead of stepping backwards under a
  child's finger. The floor is inert again as soon as the transport catches up.

**The `AudioDriver` seam does not change.** The driver can cancel pending draws
but has no way to unschedule a `play()` already queued at a future `audioTime`,
so up to one lookahead — ~0.1–0.15s, one or two sixteenths — of the pre-jump clip
may still sound after a jump. Accepted rather than widening the driver with a
cancel-scheduled-audio call (spec §7.1): the artefact lands while a child is
actively dragging, during which the design already expects a smear of audio, and
the precision a wider seam would buy is below what a 6-year-old notices. This
amendment is therefore a *narrowing of the engine*, not a change to the driver.

**Veto trigger:** if the by-ear check finds the stale audio reads as a stutter or
a wrong note rather than a smear, widen `AudioDriver` with a way to cancel
scheduled audio and amend this again.

### Where the rewind lives

The amendment above puts the rewind inside `start()`. A settable playhead needs
it inside **`stop()`** instead, and that is where it now is: `stop()` resets
`nextTick` and the position floor to 0, and `start()` anchors on whatever
`nextTick` holds.

Both rules survive intact. Stopping still discards the run's progress, so a stop
part way through the loop is followed by a play from the top — the whole point of
the 2026-08-16 amendment, and no caller can opt out of it any more than before.
What can now reach the next run is a **seek**, which is a child deliberately
putting the playhead somewhere and is the one thing that should be honoured. The
rewind on stop happens before that seek, not after it, so an explicit choice is
no longer wiped by the play meant to sound it.
