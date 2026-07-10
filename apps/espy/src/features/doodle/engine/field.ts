/**
 * Field placement (spec §5.2). PURE TS — RNG injected, no DOM.
 *
 * Lays a fresh field of non-overlapping blots for a viewBox: count and size
 * come from the layout formulas. A single blot sits near centre (so the phone
 * case, which is almost always one blot, stays centred). Multiple blots use
 * best-candidate sampling: each blot keeps the sampled position farthest from
 * the blots already placed AND the canvas edges, so the field spreads evenly
 * across the canvas instead of clumping — with the first blot landing centrally.
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
  // Valid (non-overlapping) candidates to weigh per blot before placing it.
  const CANDIDATE_POOL = 12

  // Anchor the first blot near centre (keeps the composition centred as the
  // canvas shrinks toward the phone/single-blot case); spread the rest around it.
  const cx = vb.width / 2 + (rng() - 0.5) * 0.12 * vb.width // ±0.06·width
  const cy = vb.height / 2 + (rng() - 0.5) * 0.12 * vb.height // ±0.06·height
  const blots: Blot[] = [generateBlot(cx, cy, radius(), rng)]

  let attempts = 0
  while (blots.length < count && attempts < maxAttempts) {
    const r = radius()
    let best: { x: number; y: number } | null = null
    let bestScore = -Infinity
    let pool = 0
    while (pool < CANDIDATE_POOL && attempts < maxAttempts) {
      attempts++
      const x = margin + rng() * (vb.width - 2 * margin)
      const y = margin + rng() * (vb.height - 2 * margin)
      const fits = blots.every((b) => Math.hypot(b.cx - x, b.cy - y) > (b.r + r) * 1.15)
      if (!fits) continue
      pool++
      // Spread score: distance to the nearest placed blot, capped by distance to
      // the nearest edge — pushes blots apart without letting them hug the edges.
      let score = Math.min(x, vb.width - x, y, vb.height - y)
      for (const b of blots) score = Math.min(score, Math.hypot(b.cx - x, b.cy - y))
      if (score > bestScore) {
        bestScore = score
        best = { x, y }
      }
    }
    if (!best) break // couldn't fit another blot in the remaining budget
    blots.push(generateBlot(best.x, best.y, r, rng))
  }

  return blots
}
