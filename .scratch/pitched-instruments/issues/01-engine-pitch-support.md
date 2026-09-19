# 01 - Engine & driver: pitch-aware patterns and playback

**Status:** ready-for-human (built, PR #141 open)
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
- 2026-09-17: **built** on branch `pitched-01-engine` (PR #141). Verify loop
  green (`pnpm lint`, `pnpm typecheck`, boop's full suite: 525 vitest + 267
  playwright-ct). Vitest only, per the ticket's testing note - no UI paints a
  pitch yet.

  **The in-memory shape** (the ticket's design call): `PatternRow` gains an
  optional `pitches` - 16 bitmasks of lane notes, one per step, bit 0 = pitch
  index 0 = the bottom = do - with `steps` staying the any-note projection,
  which `setPattern` now enforces. A bitmask rather than a `Set` per step: it
  is plain data, compares with `===`, cannot hold the same note twice (most of
  the unison guard), and is the shape ticket 02's document already wants, so
  there is no translation layer between memory and disk.

  **The field is absent, not empty, until a note is painted**, and absent reads
  as the anchor "so" on every on step - applied in one place, `pitch.ts`'s
  `rowPitchMasks`. The anchor is **zero semitones**, so an on step with no note
  data and a one-note row are the *same driver call*: that is what makes the
  change dormant and converted instruments byte-identical, and it is why the
  engine needs to know nothing about which instruments are pitched (ticket 03).

  `Hit` gains `pitchIndex` and a chord is one hit and one `play` per note;
  `AudioDriver.play` gains plain semitones and `ToneAudioDriver` repitches by
  `playbackRate` on its existing one-source-per-hit pattern. `setCell` and
  `audition` take an optional pitch; without one they address the whole column,
  which is today's behaviour exactly. Recorded as an amendment to
  [ADR 0024](../../../docs/adr/0024-boop-sequencer-engine-seam.md).

  **One thing outside the ticket:** `mergePatterns` (`song/song.ts`) now unions
  *notes*, not just steps. Layering is the only way one instrument sounds from
  two clips at once, so it is the only real route to the double-scheduled
  unison this ticket's third criterion forbids - and left alone it would have
  silently degraded every layered pitched row to the anchor.

  **Flagged for a ticket:** `export/renderSequence.ts` renders `steps` only, so
  a pitched row would export at the root pitch. Nothing is pitched until ticket
  10, but no ticket in the epic covers it and it is now the one `Pattern`
  consumer pitch has left behind.
