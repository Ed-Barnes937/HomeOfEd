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

**Status:** resolved

- [x] Slider labelled "Tempo" with "Slow" and "Fast" endpoints
- [x] Logarithmic mapping per the design formula over 60–200; integer BPM
      after rounding; default 100 BPM
- [x] Small live BPM readout beside the label
- [x] Engine `tempoChanged` fires; tempo changes audibly while playing
- [x] No swing control anywhere
- [x] Mapping unit-tested; slider interaction covered in a whole-frontend
      test

## Comments

Resolved 2026-08-05 (agent, Sonnet). Landed in `5a25576` on `music-app`.
Pure `tempoScale.ts` (bpmToPercent/percentToBpm, design log formula, clamp
60-200, integer rounding, default 100 -> 42%) unit-tested 9/9; native range
input re-skinned to the handoff's track/fill/thumb values via a
`--tempo-percent` custom property; live BPM readout beside the "Tempo"
label; Slow/Fast endpoints; wired to the existing setTempo/tempoChanged
contract, no engine changes. No swing control. Gate re-verified by
orchestrator: lint/typecheck clean, vitest 60/60, playwright CT 5/5.
