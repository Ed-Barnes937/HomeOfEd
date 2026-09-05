# 24 - Erase mode has no visible way back to painting

**Status:** done (built on silt-erase-mode-exit, 2026-09-05)
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

## Outcome

Half the diagnosis was already stale: the rail was **not** lying. `aria-pressed`
on a swatch has read `tool === 'paint' && selectedElement === entry.id` since the
app shipped, and the EARNED control is handed `EMPTY` while erasing, so neither
lights up. What was actually missing was the toggle - the erase button and `e`
both set erase one way, so the only exit was picking another element, and with
nothing else lit the rail simply looked inert.

So the change is small: `toggleErase` flips the tool instead of setting it, and
`useSiltHotkeys`' option is renamed `onSelectErase` -> `onToggleErase` to say so.
`selectedElement` was never overwritten by erase, only shadowed, so the way back
needs no remembering of its own. Three iwft cases now pin all of it, the
already-true half included: the button round-trip, the `e` round-trip, and an
earned selection going dark and coming back.

Esc was **not** taken up: `useSiltHotkeys` already routes it to
`onDismissOverlays` and `ScenesPopover` consumes it too, so it is not free.
