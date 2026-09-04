# 03 - Progression store: witnessed edges in localStorage

**Status:** done (built on silt-interaction-tree, 2026-09-04)
**Type:** task
**Blocked by:** 01
**Spec:** [../spec.md](../spec.md) §5

Global (not per-scene) persistence of the witnessed-edge set, plus the React
state that the rail, panel and moments read.

## Design

- Own localStorage key, versioned:
  `{ version: 1, edges: ["react:water+lava", ...] }`. Nothing else is stored -
  discovery, mastery and unlocks are recomputed via ticket 01's derivations on
  every load, so stored state can never disagree (spec §5).
- Talk to storage through an injected interface, PGlite-style fakes for tests -
  `sceneStore.ts` is the precedent (quota is a non-issue here: the blob is
  tiny and only ever grows to 37 short strings).
- Unknown keys on load are kept but ignored (ticket 01 already ignores them);
  a corrupt blob resets to empty with a warning, never a crash.
- Write-through on new witness; dedupe (a re-reported first is a no-op and
  must not touch storage).
- **Reset**: a "forget discoveries" action behind the existing two-click
  `useArmedConfirm` pattern. Resetting/clearing the world does NOT reset
  discoveries. (Where the control lives is ticket 05's panel footer;
  the store just exposes `reset()`.)
- A `useFieldNotes()` hook (or equivalent single seam) exposing: witnessed
  set, per-element counts, discovered/mastered/unlocked sets, totals, and
  `NEW since last opened` bookkeeping (last-opened watermark is UI state -
  persist it in the same blob as a second field if trivial, else in-memory
  per-session is acceptable for v1; decide in the PR and say so).

## Tests (vitest, fake storage)

- Round-trip; version field present; corrupt JSON -> empty + warning.
- Unknown key survives a save/load cycle (forward-compat).
- Dedupe: witnessing the same key twice writes once.
- Derivation wiring: storing mud's 5 keys yields unlocked mud after reload.
- Reset empties edges and derived sets; scene operations never touch the key.
