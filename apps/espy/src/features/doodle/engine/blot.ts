/**
 * Procedural ink-blot shape (spec §5.3). PURE TS — RNG injected, no DOM.
 *
 * A blot is an organic closed outline (evenly-spaced angular points at jittered
 * radii) plus a few satellite droplets. The variety enhancement (decision Q1.8)
 * adds a random rotation offset and mild independent x/y anisotropy about the
 * centre, so consecutive shuffles feel visibly different.
 *
 * All randomness is rolled once here and frozen into the returned `Blot` —
 * replay never re-rolls (spec §3.1).
 */

import type { Blot, Point, Rng, Satellite } from './types.ts'

/** Generate a resolved blot centred at `(cx, cy)` with base radius `r`. */
export function generateBlot(cx: number, cy: number, r: number, rng: Rng): Blot {
  const n = 9 + Math.floor(rng() * 5) // 9–13 outline points

  // Variety enhancement: rotation offset + mild per-axis anisotropy (0.82–1.18),
  // applied about the centre.
  const theta0 = rng() * Math.PI * 2
  const scaleX = 0.82 + rng() * 0.36
  const scaleY = 0.82 + rng() * 0.36

  const points: Point[] = []
  for (let i = 0; i < n; i++) {
    const angle = theta0 + (i / n) * Math.PI * 2
    const dist = r * (0.62 + rng() * 0.62)
    points.push({
      x: cx + Math.cos(angle) * dist * scaleX,
      y: cy + Math.sin(angle) * dist * scaleY,
    })
  }

  const satellites: Satellite[] = []
  const satCount = Math.floor(rng() * 3) // 0–2
  for (let i = 0; i < satCount; i++) {
    const angle = rng() * Math.PI * 2
    const dist = r * (1.05 + rng() * 0.5)
    satellites.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      r: r * (0.05 + rng() * 0.12),
    })
  }

  return { cx, cy, r, points, satellites }
}
