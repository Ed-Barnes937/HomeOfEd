# 01 - Engine & driver: pitch-aware patterns and playback

**Status:** ready-for-agent
**Blocked by:** None - can start immediately.

**What to build:** The `SequencerEngine` contract and both drivers learn
pitch. In-memory `Pattern` rows gain per-step pitch sets for pitched
instruments (`pitchIndex` 0-7 from the bottom; the shape is this ticket's
design call - keep one-note rows' shape untouched). `Hit` gains its
long-anticipated additive pitch field; the schedule-time beat event carries
one hit per sounding note. Cell toggling takes an optional pitch index and
audition-on-toggle sounds that pitch; `audition(instrumentId)` gains an
optional pitch for the lane's tap-to-hear. `AudioDriver.play` gains an
optional semitone offset; `ToneAudioDriver` implements it as one
`ToneBufferSource({ url, playbackRate: 2 ** (semi / 12) })` per note at the
hit's `audioTime` - the existing one-source-per-hit pattern, extended
(spec §5; Sampler/GrainPlayer rejected by the 2026-09-17 research).
`FakeAudioDriver` records the pitch so contract tests assert it.

Decisions this implements: spec §4 (in-memory model), §5 (mechanism).

Acceptance criteria:

- [ ] Contract tests (against `FakeAudioDriver`) cover: a pitched step
      schedules one play per painted note at the same audioTime; chords of
      n notes are n plays; one-note instruments schedule exactly as today;
      toggling a pitched cell auditions that pitch when stopped.
- [ ] Tone.js still never leaks through the seam (ADR 0024); only
      `toneAudioDriver.ts` imports `tone`.
- [ ] The same pitch of the same instrument can never be double-scheduled on
      one step (unison +6dB guard, spec §5).
- [ ] `pitchIndex` semantics (0 = bottom = do) documented on the types.
- [ ] Existing engine suites green untouched; no behaviour change for
      one-note rows.

## Comments
