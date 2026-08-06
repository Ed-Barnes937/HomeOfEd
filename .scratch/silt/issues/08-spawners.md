# 08 — Spawners

**What to build:** The continuous-emitter spawner, per
`.scratch/sand-sim/spec.md` §7 and the design brief:

- Spawners are **entities, not cells**: `{x, y, element}`
- Spawner mode (the rail toggle from ticket 07 goes live): a ghost preview
  follows the cursor; click places a spawner for the selected element; the
  status bar names the element being placed and counts spawners
- Rendered as a white-outlined box with the element's colour inside, drawn
  over the world so it never reads as painted cells; hover turns it red with
  a minus; one click removes it
- While the sim runs, each spawner continuously emits its element; emission
  stops while paused (placement still works paused)
- Reset (second-click confirm) removes spawners along with cells

**Blocked by:** 07 — UI shell: rail, header, status bar

**Status:** resolved

- [x] Place, see, and remove spawners per the brief's chrome (ghost, white outline, red-minus hover)
- [x] A water spawner placed while paused emits once the sim runs, and stops when paused
- [x] Status bar spawner count and mode readouts update
- [x] Reset clears spawners as well as cells
- [x] Behavioural test for emission; `*.iwft` for place/remove; lint/typecheck/tests green

## Comments

Resolved in commit `b565bda` (Sonnet agent). `features/spawners/spawners.ts`
holds the `{x,y,element}` entity and `emitSpawners(sim, spawners)` — a plain
function called from inside the same `timestep.advance` callback as `sim.tick`,
gated by the existing running check, so emission stops when paused with no
separate flag. Deliberately outside `src/sim`: spawners are feature entities,
not engine state, and no engine file was touched. `useSimLoop` gained
`mode: 'paint'|'spawner'`, `toggleSpawner` (click places, click on an existing
one removes), `onSpawnersChange`, plus `gridToCanvasPoint`/`cellSize` so the
page can draw chrome at arbitrary grid coords. Reset clears spawners.

Deviations (both intentional and sound): emission only fires into an EMPTY cell,
so a spawner can't erase a grain still on its source cell (Sandspiel Cloner
behaviour per the prior-art doc); and selecting erase forces mode back to
`paint` while entering spawner mode forces the tool back to `paint`. The second
came from a real bug both code-review axes caught independently — you could
otherwise place a spawner with `element: EMPTY` that rendered and counted like a
working one but silently never emitted.

Orchestrator gate: lint/typecheck clean, 87 vitest + 16 iwft green.
