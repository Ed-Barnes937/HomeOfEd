# 16 — Tempo slider

**What to build:** A tempo control a non-musical child can drive: a slider
labelled "Tempo" (never "BPM") with Slow/Fast word endpoints, logarithmic
mapping (equal travel = equal tempo ratio), and a small live BPM number
beside the label — not on the thumb. Moving it changes the loop speed live.

**Blocked by:** 13 — First sound: tap-to-toggle grid + play/pause.

**Status:** ready-for-agent

- [ ] Slider labelled "Tempo" with "Slow" and "Fast" endpoints
- [ ] Logarithmic mapping over roughly 60–200; integer BPM after rounding
- [ ] Small live BPM readout beside the label
- [ ] Engine `tempoChanged` fires; tempo changes audibly while playing
- [ ] No swing control anywhere
- [ ] Mapping unit-tested; slider interaction covered in a whole-frontend
      test
