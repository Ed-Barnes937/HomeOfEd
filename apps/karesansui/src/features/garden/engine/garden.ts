/**
 * The "many pens, one garden" curve builder — one groove per cog (plan 0008).
 *
 * Each cog `i` is an independent planet rolling inside the ring: a classic
 * single-wheel spirograph (the honest math from `geom()`), rigidly rotated by
 * `phaseᵢ = i·2π/N` so the N rosettes layer a full turn apart. All cogs share
 * one fit factor so their relative sizes stay true. Pure TS: no React, no DOM,
 * no Canvas.
 */
import { fullTurns } from './gears.ts'
import type { GardenConfig } from './state.ts'

export interface CogCurve {
  /** The cog's tooth count (its identity in the train + palette key). */
  w: number
  /** Scaled curve points, fit to the shared board scale. */
  pts: [number, number][]
  /** `2π · full` — the parameter span drawn (one complete period). */
  tMax: number
  /** Carrier revolutions before this cog's rosette closes. */
  full: number
}

export interface Garden {
  curves: CogCurve[]
  /** Shared fit factor (`boardR / (maxReach · 1.03)`) across all cogs. */
  scale: number
}

/**
 * Build one single-wheel rosette per cog in `config.wheels`, all on a common
 * scale, each rotated by its phase so they layer evenly. `boardR` is the sand
 * board radius. For `N = 1` this is the classic single-wheel spirograph.
 */
export function gardenCurves(config: GardenConfig, boardR: number): Garden {
  const R = config.ring
  const d = config.offset
  const wheels = config.wheels
  const N = wheels.length

  // Shared scale from the analytic max reach (carrierAmp + a) so relative cog
  // sizes are true regardless of where each rosette happens to be sampled.
  let maxReach = 1
  for (const w of wheels) {
    const reach = R - w + d * w
    if (reach > maxReach) maxReach = reach
  }
  const scale = boardR / (maxReach * 1.03)

  const curves: CogCurve[] = wheels.map((w, i) => {
    const carrierAmp = R - w
    const a = d * w
    const f = (R - w) / w
    const phase = (i * Math.PI * 2) / N
    const cos = Math.cos(phase)
    const sin = Math.sin(phase)

    const full = fullTurns(R, [w])
    const tMax = Math.PI * 2 * full
    const n = Math.max(400, Math.min(8000, Math.round(full * Math.max(150, R * 1.7, Math.abs(f) * 60))))

    const pts: [number, number][] = []
    for (let k = 0; k <= n; k++) {
      const t = (tMax * k) / n
      const rx = carrierAmp * Math.cos(t) + a * Math.cos(f * t)
      const ry = carrierAmp * Math.sin(t) - a * Math.sin(f * t)
      // Rigidly rotate the whole rosette by its phase, then fit to the board.
      const x = (rx * cos - ry * sin) * scale
      const y = (rx * sin + ry * cos) * scale
      pts.push([x, y])
    }
    return { w, pts, tMax, full }
  })

  return { curves, scale }
}
