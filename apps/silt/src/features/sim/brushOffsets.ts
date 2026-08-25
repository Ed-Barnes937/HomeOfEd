/** Whether a cell `(dx, dy)` from the brush centre is inside a round brush of
 * this cell diameter: in if its centre lies within the circle of diameter
 * `width`, so width 3 still covers the full 3x3 while wider brushes lose their
 * square corners. The one definition of the brush's shape — the paint
 * footprint below and the spawner erase sweep (`isUnderBrush`) both use it, so
 * they can never disagree. */
export function isWithinBrush(dx: number, dy: number, width: number): boolean {
  return dx * dx + dy * dy <= (width / 2) ** 2
}

/** `(dx, dy)` offsets covering a centred round brush of this cell diameter
 * (odd, so it has a centre); 1 = single cell. */
export function brushOffsets(width: number): readonly { dx: number; dy: number }[] {
  const half = (width - 1) / 2
  const lo = Math.floor(half)
  const hi = Math.ceil(half)
  const offsets: { dx: number; dy: number }[] = []
  for (let dy = -lo; dy <= hi; dy++) {
    for (let dx = -lo; dx <= hi; dx++) {
      if (isWithinBrush(dx, dy, width)) {
        offsets.push({ dx, dy })
      }
    }
  }
  return offsets
}
