/**
 * Tuning knobs for the ink-in-water field. `DEFAULT_TUNING` holds the values the
 * app actually ships with (dialled in via the `?tune` panel and signed off).
 * `liveTuning.current` is the mutable copy the `?tune` debug panel edits and
 * `useDoodle` reads (snapshotted) each time it generates a field.
 *
 * TECH DEBT: the `?tune` panel (`features/doodle/FluidTuner.tsx`) and `liveDebug`
 * grid mode below are dev-only tooling, mounted only with `?tune` in the URL, so
 * they cost nothing in normal use. Left in deliberately for future tuning; when
 * the look is final, delete this file + `FluidTuner.*` and fold these numbers
 * into plain consts in `fluid.ts` / `fluid.helpers.ts`.
 */
import type { Brush } from './fluid.helpers.ts'

export interface FluidTuning {
  /** Relative frequency of each brush archetype. */
  weights: Record<Brush, number>

  // Shared shape feel.
  radiusScale: number
  wobble: number
  trailDye: number

  // Per-archetype base geometry (multipliers of the blot radius).
  peanutSep: number
  beanBend: number
  clumpSpread: number
  spikeArms: number
  spikeArmLen: number
  spikeKick: number
  archSpan: number
  archLeg: number

  // Sim.
  /** Bloom duration before the field freezes and bakes (ms). */
  fluidMs: number
  vorticity: number
  densityDissipation: number
  velocityDissipation: number

  // Watercolour display.
  threshold: number
  smoothTexels: number
  edgeGain: number
  rimBand: number
  washMax: number
  grainAmount: number
  grainScale: number
}

export const DEFAULT_TUNING: FluidTuning = {
  weights: { dot: 1, peanut: 1, bean: 1, clump: 1, spike: 1, arch: 1 },

  radiusScale: 0.45,
  wobble: 0.275,
  trailDye: 0.84,

  peanutSep: 1.8,
  beanBend: 2.5,
  clumpSpread: 1.5,
  spikeArms: 4,
  spikeArmLen: 1.05,
  spikeKick: 0.07,
  archSpan: 2.3,
  archLeg: 1.2,

  fluidMs: 1500,
  vorticity: 16,
  densityDissipation: 0.03,
  velocityDissipation: 1.7,

  threshold: 0.4,
  smoothTexels: 2.8,
  edgeGain: 0.14,
  rimBand: 0.08,
  washMax: 0.42,
  grainAmount: 0.09,
  grainScale: 50,
}

/** Deep copy so the panel can edit a run's snapshot without aliasing defaults. */
export function cloneTuning(t: FluidTuning): FluidTuning {
  return { ...t, weights: { ...t.weights } }
}

/** The mutable copy the debug panel edits; read (snapshotted) at field generation. */
export const liveTuning: { current: FluidTuning } = { current: cloneTuning(DEFAULT_TUNING) }

/**
 * Debug flags (also `?tune`-only). `grid` forces a fixed 3×2 layout with exactly
 * one of each brush archetype, seeded deterministically — so tweaking a knob
 * changes only the shapes, not the positions, for clean side-by-side comparison.
 */
export const liveDebug: { grid: boolean } = { grid: false }
