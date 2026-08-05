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

**Status:** resolved

- [x] 6 × 16 grid renders to the design geometry at laptop and tablet
      breakpoints; tap toggles a cell on/off
- [x] Row labels come from the kit manifest (real instrument names +
      row-colour-tinted artwork plates)
- [x] One play/pause button; loop is unconditional — no stop, restart, or
      record, and nothing that resets the pattern
- [x] First press satisfies the gesture-gated audio start
- [x] Grid state drives the engine pattern; edits while playing are heard on
      the next pass
- [x] Whole-frontend test (`*.iwft`): toggle cells, play, verify the loop
      fires beat events / audible hits

## Comments

Resolved 2026-08-05 (agent, Sonnet). Landed in `e4fa9ad` on `music-app`.
Tracer bullet: 6x16 grid + play/pause wired to the engine via a new
`EngineProvider` (injectable AudioDriver — iwft tests hand-crank a
`FakeAudioDriver` through `page.evaluate`). TopBar (fridge back-glyph,
wordmark, inert My grooves/Share/? chrome with aria-disabled), grid well to
the handoff geometry at laptop/tablet (1280px breakpoint), transport bar
with just play/pause. Greeting demo UI removed; backend layer kept.
Known limitation flagged: row colours are positional until kit.json carries
a colour field (ticket 18). Gate re-verified by orchestrator: lint/typecheck
clean, vitest 48/48, playwright CT 4/4.
