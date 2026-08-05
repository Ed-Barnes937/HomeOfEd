# 13 — First sound: tap-to-toggle grid + play/pause

**What to build:** The tracer bullet. A 6-row × 16-step grid where tapping a
cell toggles it, plus a single play/pause control; pressing play loops the
pattern audibly through the engine. A child can make a beat and hear it. No
drag-paint, tempo, or playhead yet.

**Design:** build to the handoff (`docs/reference/boop-design/README.md`) —
laptop and tablet layouts, high-fidelity: grid-well geometry, cell sizes and
states, instrument rail with artwork plates (placeholder artwork tinted to
the row colours via CSS mask), bar-numeral row, top bar with wordmark and
button styles. The small-phone treatment is a separate ticket (27).

**Blocked by:** 12 — SequencerEngine + Tone.js implementation.

**Status:** claimed

- [ ] 6 × 16 grid renders to the design geometry at laptop and tablet
      breakpoints; tap toggles a cell on/off
- [ ] Row labels come from the kit manifest (real instrument names +
      row-colour-tinted artwork plates)
- [ ] One play/pause button; loop is unconditional — no stop, restart, or
      record, and nothing that resets the pattern
- [ ] First press satisfies the gesture-gated audio start
- [ ] Grid state drives the engine pattern; edits while playing are heard on
      the next pass
- [ ] Whole-frontend test (`*.iwft`): toggle cells, play, verify the loop
      fires beat events / audible hits
