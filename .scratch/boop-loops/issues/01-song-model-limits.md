# Song model limits

Type: grilling
Status: resolved

## Question

The prototype fixes the song at 16 positions and shows one lane per clip in a
*pinned* song bar. Decide the model's limits:

- Song length: fixed 16 positions, or grow on demand? If grow, what's the
  interaction and the ceiling?
- Clip count: a ceiling (the tint list cycles at 5), or unbounded? What does
  the song bar do vertically as lanes stack up — it is pinned chrome, so
  height is precious (ADR 0030: neither bar may scroll away, the grid region
  is the only scroller)?
- If lanes overflow: internal scroll, cap the count, or shrink rows?

## Answer

- **Song length: fixed at 16 positions.** No grow-on-demand — it would need a
  new control (the handoff allows none), and 16 positions × 4 bars ≈ 2 minutes
  at default speed is generous for the age group. Raising the ceiling later is
  additive.
- **Clip count: capped at 5.** Every clip keeps a unique tint (the tint list
  has exactly 5 colours), which is what lets a pre-reader trace a lane square
  back to its chip. At the cap, **"+ New clip" stays visible but disabled** —
  the same pattern as "Delete clip" at one clip. A vanishing button reads as
  "where did it go?"; a greyed one reads as "full".
- **No lane overflow handling needed.** The cap bounds the song bar at ~434px
  of pinned chrome. On short windows the grid region simply shows less and
  scrolls — it is already the one vertical scroller (ADR 0030). No internal
  lane scroller, no row shrinking.
