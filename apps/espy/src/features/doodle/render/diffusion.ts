/**
 * Ink-in-water entrance choreography (feedback follow-up). PURE TS — no canvas.
 *
 * A fresh field blooms in as if ink were dropped into water: each blot grows
 * from a small seed while its tone settles, and the blots are staggered so the
 * "drops" land at slightly different moments rather than in unison. The whole
 * thing is driven by a single global `phase` (0 = nothing, 1 = fully settled)
 * that `useDoodle` ramps and `surface.ts` reads; this module is the pure maths
 * between the two, so it unit-tests without React or a canvas.
 */

/** Total entrance duration in ms — calm, ease-out (ADR 0016 divergence 6). */
export const DIFFUSE_MS = 850

/** Seed size a blot grows from, as a fraction of its settled size. */
const SEED_SCALE = 0.14

/** Fraction of the window spent spreading the stagger across the blots. */
const STAGGER = 0.3

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t))
}

/** Ease-out cubic — fast then settling, reinforcing "ink settling". */
export function easeOutCubic(t: number): number {
  const c = clamp01(t)
  return 1 - Math.pow(1 - c, 3)
}

/**
 * Local 0..1 progress for blot `index` of `count`, given the global `phase`.
 * Earlier blots lead; every blot has reached 1 by the time `phase` is 1.
 */
export function blotProgress(phase: number, index: number, count: number): number {
  if (count <= 1) return clamp01(phase)
  const start = STAGGER * (index / (count - 1))
  const span = 1 - STAGGER
  return clamp01((phase - start) / span)
}

/** Scale a blot is drawn at for a given local progress (seed → full size). */
export function growScale(localPhase: number): number {
  return SEED_SCALE + (1 - SEED_SCALE) * easeOutCubic(localPhase)
}

/** Opacity the blot's ink is drawn at for a given local progress. */
export function layerAlpha(localPhase: number): number {
  return easeOutCubic(localPhase)
}
