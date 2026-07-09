/**
 * Pattern geometry — the generalized epicyclic ("summed-cosine") curve ported
 * verbatim from the Studio reference. A carrier circle of amplitude `R - W[0]`
 * plus one cosine/-sine term per wheel, sampled over `turns` revolutions and
 * scaled to fit the sand board. Pure TS: no React, no DOM, no Canvas.
 */
import { fullTurns } from './gears.ts'
import type { GardenConfig } from './state.ts'

export interface Geom {
  pts: [number, number][]
  tMax: number
  full: number
  /** The fit factor applied to the raw curve (`boardR / (maxReach·1.03)`), so a
   * renderer can reconstruct intermediate epicycle joints on the same scale. */
  scale: number
}

/**
 * Build the scaled curve for `config`, fit to a circular board of radius
 * `boardR`. Point count grows with revolutions and term frequency, clamped to
 * `[400, 8000]`. The curve is scaled by `boardR / (maxReach * 1.03)` so it sits
 * just inside the board.
 */
export function geom(config: GardenConfig, boardR: number): Geom {
  const R = config.ring
  const W = config.wheels
  const d = config.offset
  const carrierAmp = R - (W[0] ?? 0)
  const terms = W.map((w, i) => ({
    f: ((R - w) / w) * (i % 2 === 0 ? 1 : -1),
    a: d * w * Math.pow(0.56, i),
  }))
  const full = fullTurns(R, W)
  // The summed-cosine curve is retained only for reference / the N=1 regression
  // anchor (plan 0008 D2); it always draws the full closed period now.
  const revs = full
  const tMax = Math.PI * 2 * revs
  const maxF = terms.reduce((m, t) => Math.max(m, Math.abs(t.f)), 1)
  const n = Math.max(400, Math.min(8000, Math.round(revs * Math.max(150, R * 1.7, maxF * 60))))
  const raw: [number, number][] = []
  let maxReach = 1
  for (let i = 0; i <= n; i++) {
    const t = (tMax * i) / n
    let x = carrierAmp * Math.cos(t)
    let y = carrierAmp * Math.sin(t)
    for (const term of terms) {
      x += term.a * Math.cos(term.f * t)
      y -= term.a * Math.sin(term.f * t)
    }
    raw.push([x, y])
    const rr = Math.hypot(x, y)
    if (rr > maxReach) maxReach = rr
  }
  const scale = boardR / (maxReach * 1.03)
  const pts = raw.map((p) => [p[0] * scale, p[1] * scale] as [number, number])
  return { pts, tMax, full, scale }
}

/**
 * Per-point unit normals via central difference of neighbours. Returns one
 * normal per input point; degenerate (zero-length) segments yield the fallback
 * direction of the tangent it derives from.
 */
export function normals(pts: [number, number][]): [number, number][] {
  const N = pts.length
  const out: [number, number][] = []
  for (let i = 0; i < N; i++) {
    const cur = pts[i] ?? [0, 0]
    const a = pts[i - 1] ?? cur
    const b = pts[i + 1] ?? cur
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    out.push([-dy / len, dx / len])
  }
  return out
}
