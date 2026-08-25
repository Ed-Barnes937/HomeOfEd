/** `(dx, dy)` offsets covering a centred round brush of this cell diameter
 * (odd, so it has a centre); 1 = single cell. A cell is in if its centre lies
 * within the circle of diameter `width`, so width 3 still covers the full 3x3
 * while wider brushes lose their square corners. */
export function brushOffsets(width: number): readonly { dx: number; dy: number }[] {
  const half = (width - 1) / 2
  const lo = Math.floor(half)
  const hi = Math.ceil(half)
  const radiusSq = (width / 2) ** 2
  const offsets: { dx: number; dy: number }[] = []
  for (let dy = -lo; dy <= hi; dy++) {
    for (let dx = -lo; dx <= hi; dx++) {
      if (dx * dx + dy * dy <= radiusSq) {
        offsets.push({ dx, dy })
      }
    }
  }
  return offsets
}
