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

**Status:** claimed

- [ ] Place, see, and remove spawners per the brief's chrome (ghost, white outline, red-minus hover)
- [ ] A water spawner placed while paused emits once the sim runs, and stops when paused
- [ ] Status bar spawner count and mode readouts update
- [ ] Reset clears spawners as well as cells
- [ ] Behavioural test for emission; `*.iwft` for place/remove; lint/typecheck/tests green
