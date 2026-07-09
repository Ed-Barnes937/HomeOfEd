/**
 * Field placement (spec §5.2). PURE TS — RNG injected, no DOM.
 *
 * Lays a fresh field of non-overlapping blots for a viewBox: count and size
 * come from the layout formulas; a single blot sits near centre, multiple blots
 * are rejection-sampled so no pair overlaps.
 */

import { generateBlot } from './blot.ts'
import { blobCount, blobRadiusFraction } from './layout.ts'
import type { Blot, Rng, ViewBox } from './types.ts'

export function generateField(vb: ViewBox, rng: Rng): Blot[] {
  const count = blobCount(vb.width, vb.height)
  const frac = blobRadiusFraction(count)
  const min = Math.min(vb.width, vb.height)

  const radius = (): number => min * frac * (0.85 + rng() * 0.3)

  if (count === 1) {
    const cx = vb.width / 2 + (rng() - 0.5) * 0.12 * vb.width // ±0.06·width
    const cy = vb.height / 2 + (rng() - 0.5) * 0.12 * vb.height // ±0.06·height
    return [generateBlot(cx, cy, radius(), rng)]
  }

  const margin = min * 0.14
  const maxAttempts = 400 * count
  const blots: Blot[] = []

  for (let attempt = 0; attempt < maxAttempts && blots.length < count; attempt++) {
    const r = radius()
    const x = margin + rng() * (vb.width - 2 * margin)
    const y = margin + rng() * (vb.height - 2 * margin)
    const fits = blots.every(
      (b) => Math.hypot(b.cx - x, b.cy - y) > (b.r + r) * 1.15,
    )
    if (fits) blots.push(generateBlot(x, y, r, rng))
  }

  return blots
}
