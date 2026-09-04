# 24 - Erase mode has no visible way back to painting

**Status:** ready-for-agent
**Type:** task
**Source:** local testing feedback (Ed, 2026-09-04) - "There's no way to come
out of erase mode back to paint mode other than clicking spawner + paint."
**Spec:** rail behaviour - `apps/silt/src/pages/HomePage.tsx`.

Diagnosis: clicking any palette element already returns to paint
(`selectElement` sets the tool back, `HomePage.tsx:138-141`) - but while
erasing, the previously selected element STAYS HIGHLIGHTED in the rail
(selection is by id, the tool state does not reach the rail's aria-pressed),
so the rail looks like it is already in paint mode and re-clicking the lit
tile does not look like a way out. The eraser button itself is not a toggle.
The escape hatch exists; the UI hides it.

## Design

- **The erase button becomes a toggle**: clicking it while erase is active
  returns to paint with the previously selected element (aria-pressed
  follows).
- **The rail stops lying**: while erase is active, no palette element shows
  as selected (the selection is remembered, just not shown); selecting any
  element exits erase, as it already does.
- The erase hotkey (via useSiltHotkeys onSelectErase) toggles the same way.
- Esc as an additional exit is optional - only if Esc is not already taken by
  panel/popover close paths; do not overload it.

## Tests

- unit/iwft: enter erase, click erase again - painting resumes with the prior
  element; while erasing, no rail element reads as pressed; hotkey round-trip
  does the same.
