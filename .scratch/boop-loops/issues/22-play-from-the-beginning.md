# 22 — Play always starts at the beginning

**What to build:** Pressing play starts the clip or the song from its first
step, every time. Today it resumes from wherever the transport stopped.

Two separate causes, both in `engine/createSequencerEngine.ts`:

- `nextTick` (line 50) never resets. The audible step is `nextTick % 16`, so a
  stop at step 7 makes the next play start at step 8.
- `start()` (lines 111–122) deliberately re-anchors the playhead at
  `frozenPos`. The comment there calls this out as resume behaviour.

**The rule, agreed with the driver:** rewind lives inside `start()` and applies
everywhere — clip play, song play, and the spacebar alike. There is no pause,
only stop and play-from-the-top. A 6-year-old does not need two concepts.

- `start()` resets `nextTick`, `frozenPos` and the anchor to 0 before it starts
  the driver's transport.
- `frozenPos` is now always 0 when stopped — check whether it and `rawPos()`'s
  no-anchor branch can go entirely rather than being left as a field that only
  ever holds one value.
- **The takeover paths change.** `toggleSong` (`HomePage.tsx:272`) and
  `toggleClipPlay` (line 255) currently switch mode over a *running* transport
  without stopping it, so the swap is gapless. Both must now stop and start, so
  the takeover also begins at the top. This is a deliberate trade: a small
  audible gap buys one rule with no exceptions.
- The `songConductor` already begins at `sequence[0]`, so song play lands on
  the leftmost placement once the transport itself rewinds — no conductor
  change expected. Confirm rather than assume.

**Deviates from:** spec §9's "starting either play stops the other" wording,
which was written on the assumption the transport keeps running. Update the
spec line. Amend [ADR 0024](../../../docs/adr/0024-boop-sequencer-engine-seam.md)
to record that the engine seam has no resume semantics — `start()` is always
"start from the top".

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Engine unit test (against `FakeAudioDriver`): stop at step 7, `start()`, the next beat event is step 0
- [ ] Engine unit test: `songPos()` reads 0 immediately after a `start()` that follows a mid-loop stop
- [ ] `.iwft`: clip play from a stopped mid-loop transport puts the playhead on step 1 of bar 1
- [ ] `.iwft`: song play always begins at the leftmost placed position, including when it takes over from a running clip loop
- [ ] `.iwft`: the spacebar follows the same rule
- [ ] Spec §9 and ADR 0024 updated
