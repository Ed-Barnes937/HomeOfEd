# Sequencer + sound prototype

Type: prototype
Status: resolved
Blocked by: 01

## Question

Does the core creative loop feel good? Build a throwaway browser prototype: a
bare step-sequencer grid (a few instrument rows, one bar) making real sound on
loop, usable by touch on a tablet-sized screen. Answers: is toggling cells
while the loop plays satisfying, is timing tight enough on a tablet browser,
and are the sequencer dimensions (rows/steps/tempo) roughly right — feeding the
"sequencer dimensions" fog.

## Answer

Verdict (user, 2026-08-02, after trying all three variants live):

- **Dimensions: variant C** — 6 instruments × 16 steps, tempo slider. More
  instruments gives more options.
- **No swing toggle** — confusing for non-musical folk; drop it from the spec.
- **Instrument labels need to be better than emojis** — real names/artwork, a
  design-brief concern.
- Core loop and timing raised no complaints — toggling while playing and
  tablet timing were good enough that the discussion moved straight to
  dimensions.

Prototype (primary source): branch `prototype/sequencer-sound`, commit
`e76d9d0`, `.scratch/music-app/prototype-sequencer/index.html`.

## Comments

**2026-08-02 — prototype built, awaiting human verdict.** Three variants on
branch `prototype/sequencer-sound` (commit `e76d9d0`), single self-contained
page at `.scratch/music-app/prototype-sequencer/index.html` (working copy also
on `music-app`). Run: `python3 -m http.server 8090 -d
.scratch/music-app/prototype-sequencer`, then open
`http://<lan-ip>:8090/?variant=A` on the tablet. Variants (switchable via the
floating bar or `?variant=`): **A** Chunky 4×8 + tempo presets, **B** Classic
4×16 + BPM slider, **C** Dense 6×16 + swing toggle. Tone.js CDN + Kit8 samples
(needs internet), gesture-gated `Tone.start()`, playhead via `Tone.Draw`,
drag-to-paint cells. Headless smoke test passed on all three variants (grid,
toggle, audio context running, samples loaded). To judge: loop feel while
toggling, timing tightness on the tablet, which dimensions are right.
