/**
 * Latched drag-paint decision (spec: "The grid" — touch model). Pointer-down
 * decides add-or-remove from that cell's current state; the whole drag then
 * repeats that decision on every cell it crosses, regardless of each cell's
 * own state.
 */
export type PaintMode = 'add' | 'remove'

/** The mode a pointer-down on a cell latches, from that cell's current state. */
export function decidePaintMode(cellIsOn: boolean): PaintMode {
  return cellIsOn ? 'remove' : 'add'
}

/** The on/off state a latched mode paints onto every cell it touches. */
export function paintModeToOn(mode: PaintMode): boolean {
  return mode === 'add'
}
