export interface GridPoint {
  x: number
  y: number
}

/**
 * The stamp centres a stroke needs between two pointer samples: from `from`
 * (exclusive, it was stamped by the previous event) to `to` (inclusive),
 * evenly spaced along the line. Pointer events arrive at a fixed rate however
 * fast the hand moves, so a quick drag lands samples many cells apart —
 * stamping only at the samples leaves a dotted stroke.
 *
 * Spacing scales with the brush: a footprint `width` cells across can be
 * stamped every `width / 5` cells and still overlap into a solid line, so
 * wider brushes stamp less often. Never less than one cell, or a 1-wide brush
 * would stamp the same cell repeatedly.
 */
export function strokeSteps(from: GridPoint, to: GridPoint, width: number): GridPoint[] {
  const spacing = Math.max(width / 5, 1)
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const count = Math.ceil(distance / spacing)
  const steps: GridPoint[] = []
  for (let i = 1; i <= count; i++) {
    steps.push({
      x: Math.round(from.x + ((to.x - from.x) * i) / count),
      y: Math.round(from.y + ((to.y - from.y) * i) / count),
    })
  }
  return steps
}
