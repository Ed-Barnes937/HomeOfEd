# 16 — Tempo slider

**What to build:** A tempo control a non-musical child can drive: a slider
labelled "Tempo" (never "BPM") with Slow/Fast word endpoints, logarithmic
mapping (equal travel = equal tempo ratio), and a small live BPM number
beside the label — not on the thumb. Moving it changes the loop speed live.

**Design:** the handoff (`docs/reference/boop-design/README.md`) fixes the
exact mapping — `percent = log(bpm/60) / log(200/60) × 100`, range 60–200,
**default 100 BPM** (thumb at 42%) — plus the transport-bar layout, track/
thumb/readout styles, and the play-button press motion (2px, 90ms).

**Blocked by:** 13 — First sound: tap-to-toggle grid + play/pause.

**Status:** ready-for-agent

- [ ] Slider labelled "Tempo" with "Slow" and "Fast" endpoints
- [ ] Logarithmic mapping per the design formula over 60–200; integer BPM
      after rounding; default 100 BPM
- [ ] Small live BPM readout beside the label
- [ ] Engine `tempoChanged` fires; tempo changes audibly while playing
- [ ] No swing control anywhere
- [ ] Mapping unit-tested; slider interaction covered in a whole-frontend
      test
