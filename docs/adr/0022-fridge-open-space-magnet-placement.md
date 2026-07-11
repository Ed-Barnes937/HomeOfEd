# 0022 — fridge: place new magnets in open space, shove only as a full-board fallback

- **Status:** Accepted
- **Date:** 2026-07-11
- **Related:** [0003-fridge-implementation-plan.md](../plans/0003-fridge-implementation-plan.md)
  §3 (engine boundary); `packages/magnet-kit`; `apps/fridge`

## Context

Adding a magnet spawned it near the top-centre of the door
(`spawnPlacement`) and then called `relax(magnets, newId, …)` with the new
magnet as the **immovable** active box. That is the same rule that makes
dragging feel physical — the active box holds its ground and shoves its
neighbours — but on *add* it is the wrong rule: every new magnet displaces
whatever was already sitting under the top-centre, so a board the user has
deliberately arranged gets rearranged just by adding one more tile.

The fix has to stay behind the engine boundary (all placement/collision maths
lives in `@hoe/magnet-kit`, the app only calls it — plan §3) and must not
introduce a new gesture, because a mobile UI is in progress and drag-and-drop
from the tray would complicate it.

## Decision

- **Add a pure `findOpenPlacement()` to `@hoe/magnet-kit`.** Given the existing
  boxes, the bounds, the new magnet's size, and a preferred spawn point, it
  returns a placement that clears every existing magnet by a small gap (6px).
  It tests the preferred point first, then grid-scans candidate positions
  **nearest-to-preferred first** and returns the closest clear one — so a
  newcomer drops into free space near the top-centre rather than on top of a
  placed magnet.
- **Wire it into `buildAddAction` only.** `spawnPlacement` still computes the
  top-centre origin (same jitter/tilt); `findOpenPlacement` then relocates it
  to a gap. The `add` reducer is unchanged: `relax()` still runs, but on a
  clear placement it finds no overlaps, so nothing already placed moves.
- **Full-board fallback = today's behaviour.** When no gap exists,
  `findOpenPlacement` returns the raw (unclamped) preferred point, and the
  reducer's `relax()` shoves neighbours exactly as before. A packed board
  degrades to the old shove rather than failing to place.

## Consequences

- Adding a magnet no longer disturbs deliberately-placed magnets while the
  board has room — verified in the dev app (first magnet held its position
  across repeated adds; six magnets, zero overlapping pairs).
- No new gesture or UI; the mobile work is unaffected, and the change is
  contained to one pure function plus one call site.
- The search is a **grid scan** (step = `max(12, min(w,h)/2)` px), not
  exhaustive-pixel: on a *nearly* full board it can fall back to shoving even
  when a sub-step-sized sliver of space exists. Acceptable — the fallback is
  the old, correct behaviour, just triggered slightly early.
- Placement is now less predictable than "always top-centre": a newcomer may
  appear off to the side where the nearest gap is. This is the intended
  trade-off (don't-disturb beats fixed-position).

## Considered but not chosen

- **Settle the newcomer** (spawn top-centre, freeze existing magnets, nudge only
  the new one off overlaps). Smaller, but needs a new "frozen set" mode in
  `relax` and gives less controlled placement on a dense board.
- **No relax on add** (let the newcomer land on top, overlapping). Smallest
  possible change, but looks messy on spawn.
- **Tap-to-place / drag-and-drop from the tray.** Best placement *control*, but
  changes the add interaction to two steps (or a full DnD) — a UX change, not a
  bug fix, and drag-and-drop specifically risks the in-progress mobile UI.
  A deliberate-placement mode remains a possible additive follow-up.
