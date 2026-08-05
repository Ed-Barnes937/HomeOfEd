# 13 — First sound: tap-to-toggle grid + play/pause

**What to build:** The tracer bullet. A 6-row × 16-step grid where tapping a
cell toggles it, plus a single play/pause control; pressing play loops the
pattern audibly through the engine. A child can make a beat and hear it. Rows
show the manifest's instrument names (placeholder marks fine — real artwork
comes with design). Functional visuals only; no drag-paint, tempo, or
playhead yet.

**Blocked by:** 12 — SequencerEngine + Tone.js implementation.

**Status:** ready-for-agent

- [ ] 6 × 16 grid renders; tap toggles a cell on/off
- [ ] Row labels come from the kit manifest (real instrument names)
- [ ] One play/pause button; loop is unconditional — no stop, restart, or
      record, and nothing that resets the pattern
- [ ] First press satisfies the gesture-gated audio start
- [ ] Grid state drives the engine pattern; edits while playing are heard on
      the next pass
- [ ] Whole-frontend test (`*.iwft`): toggle cells, play, verify the loop
      fires beat events / audible hits
