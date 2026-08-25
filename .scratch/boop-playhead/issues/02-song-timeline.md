# 02 — The song timeline: a global-bar axis

**What to build:** A pure module, `apps/boop/src/song/songTimeline.ts`, owning
the arithmetic every other ticket in this effort needs. No React, no engine, no
DOM — a sibling of `song.ts`, tested like it.

Bars are new to the codebase (spec §3). The engine counts ticks and 16-step
patterns; `song.ts` knows positions and clips. Something has to own the middle,
and putting it here is what keeps the two strips, the conductor and the readout
from each growing their own copy of the same off-by-one.

What it owns:

- The **placed timeline**: the non-empty placements in order — the same sequence
  the conductor builds, so the two must not disagree.
- **Global bar ↔ (position, bar)** both ways, over the placed timeline. A song
  with placements at 1–8 is 32 global bars, and global bar 5 is position 2,
  bar 1.
- **Clamping** to the last placed position (spec §4). Empty positions are drawn
  but not reachable.
- **Snap from a fraction of the track** to a global bar, for the strips: a
  pointer at 0–1 across the track lands on a bar.
- **Global bar ↔ tick**, so ticket 03 can hand ticket 01 a tick.
- The **readout string**'s parts: position, bar, bars-per-position.

Keep it total. A song with no placements at all has an empty timeline and every
query answers sensibly — that state is reachable (ADR 0032's all-empty song
plays the grid clip and has no conductor), so it cannot throw.

Spec: §3 (vocabulary), §5 (the timeline), §4 (clamping).

**Blocked by:** —

**Status:** resolved

- [x] `songTimeline.ts` is pure: no React, no engine import, no DOM
- [x] Global bar ↔ (position, bar) round-trips for every bar of a song with
      gaps in its placements
- [x] Scrubs past the end clamp to the last placed position; scrubs before the
      start clamp to global bar 0
- [x] Empty positions are absent from the timeline, so the mapping skips them
- [x] A song with no placements yields an empty timeline and no throw from any
      query
- [x] Global bar ↔ tick agrees with `STEPS_PER_PATTERN` and 4 bars per position
      — derived from those constants, not from a literal 4 or 16
- [x] The timeline's sequence matches `createSongConductor`'s own, asserted
      against it rather than by eye
- [x] Unit-tested in `songTimeline.test.ts`, table-driven over the awkward cases
      (gaps, one placement, all 16, none)
- [x] `apps/boop/CONTEXT.md` gains **Bar**, **Global bar** and **Scrub**
