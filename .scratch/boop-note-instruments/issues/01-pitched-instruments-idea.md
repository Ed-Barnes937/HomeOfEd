# 01 - Idea: instruments with notes (pitch)

**Status:** resolved
**Type:** grilling
**Reported:** 2026-09-06, Ed - "just a sparky idea", parked deliberately

Instruments that play *notes*, not just one fixed sound per row. Ed has no
feasibility or UX position yet; nothing should be built off this ticket. The
next step is a shaping conversation (and possibly a feasibility spike ticket
coming out of it).

Grounding for that conversation:

- The engine already distinguishes `melodic` roles in the kit manifest
  (boop-instruments ticket 01) but V1 ignores roles; every voice is one
  pre-rendered wav triggered per step.
- Pitch could mean: pitch-shifting the existing samples (Tone.js can
  playback-rate shift - cheap, kid-simple, detunes timbre), a per-row note
  lane (grid becomes 3D - big UX question for the 16-step grid), or
  scale-locked rows (each row of an instrument is a note in a fixed
  pentatonic - the Groove-Pizza-adjacent, kid-safe answer).
- The 200 bpm retrigger budget and gain budget (boop-instruments ticket 08)
  were tuned per-voice; pitched variants multiply voices.

Questions to shape: who is it for (the kid mashing, or an older kid
composing)? Does it live inside a clip or as a new clip type? What does the
grid look like on a phone?

## Answer

The shaping conversation happened: a claude.ai/design exploration produced a
high-fidelity handoff (`docs/reference/design_handoff_pitched_lane/`), and the
2026-09-17 grill session settled every open question. Of the three shapes
this ticket sketched, the one that won is the **per-row note lane** (8
stacked cells per step, height = pitch, one major octave do-to-do) - not
scale-locked rows and not a new clip type; it lives inside a clip as an
ordinary row. Pitch is produced by playback-rate shifting one root sample
(this ticket's "cheap, kid-simple" instinct, confirmed by research against
tone 15.1.22). The gain-budget worry was real: 8-note chords break the
per-voice measurement and get their own re-pin ticket. The phone-grid
question is in scope, engineering-led with a kick-back-to-design tripwire.

Spec and build tickets: `.scratch/pitched-instruments/` (spec.md + issues
01-10). Roster: trumpet, bass, piano new; marimba and boop converted with
old saves sounding byte-identical.

## Comments
