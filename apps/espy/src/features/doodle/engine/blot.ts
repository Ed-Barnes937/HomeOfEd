/**
 * Procedural ink-blot shape (spec §5.3). PURE TS — RNG injected, no DOM.
 *
 * A blot is an organic closed outline (evenly-spaced angular points at jittered
 * radii, in a randomly-rotated anisotropic frame) plus a few satellite droplets.
 *
 * Variety comes from four **archetypes** — `blob` / `streak` / `splatter` /
 * `cluster` — each with its own named knob block (`SHAPES`) so a single shape
 * can be dialled independently later without touching the others. Every field
 * blot picks an archetype independently, so a page reads as a set of visibly
 * different shapes rather than a row of near-identical round blobs.
 *
 * All randomness is rolled once here and frozen into the returned `Blot` —
 * replay never re-rolls (spec §3.1).
 */

import type { Blot, Point, Rng, Satellite } from './types.ts'

const TAU = Math.PI * 2

export type Archetype = 'blob' | 'streak' | 'splatter' | 'cluster'

/** Inclusive numeric range `[min, max]`. */
type Range = readonly [number, number]

interface ShapeKnobs {
  /** Relative selection weight when an archetype is picked at random. */
  weight: number
  /** Outline vertex count (higher = smoother/rounder). */
  points: Range
  /** Radial jitter band, as a multiple of the base radius `r`. */
  radial: Range
  /** Anisotropy: per-axis scale of the (pre-rotation) local frame. */
  scaleX: Range
  scaleY: Range
  /** Small droplet spots flung around the body. */
  satellites: { count: Range; dist: Range; size: Range }
  /** Large overlapping lobes that merge with the core into a lumpy mass. */
  lobes?: { count: Range; dist: Range; size: Range }
}

/**
 * Per-archetype tunable knobs. Each block is independent — widen `streak`'s
 * `scaleX` for longer smears, bump `splatter`'s satellite `count` for more
 * droplets, etc., without affecting the others.
 */
export const SHAPES: Record<Archetype, ShapeKnobs> = {
  // Today's organic round blot, widened for more raggedness.
  blob: {
    weight: 3,
    points: [9, 13],
    radial: [0.55, 1.35],
    scaleX: [0.7, 1.4],
    scaleY: [0.7, 1.4],
    satellites: { count: [0, 2], dist: [1.05, 1.5], size: [0.05, 0.14] },
  },
  // Elongated smear: one long axis, one short, at a random orientation.
  streak: {
    weight: 2,
    points: [9, 13],
    radial: [0.5, 1.25],
    scaleX: [1.5, 2.3],
    scaleY: [0.35, 0.6],
    satellites: { count: [0, 2], dist: [1.1, 1.7], size: [0.04, 0.1] },
  },
  // Compact core flinging many droplets of varied size.
  splatter: {
    weight: 2,
    points: [8, 12],
    radial: [0.5, 1.3],
    scaleX: [0.75, 1.3],
    scaleY: [0.75, 1.3],
    satellites: { count: [4, 8], dist: [1.0, 2.0], size: [0.04, 0.2] },
  },
  // Core plus 2–3 large overlapping lobes → a lumpy multi-lobed mass.
  cluster: {
    weight: 2,
    points: [9, 13],
    radial: [0.55, 1.3],
    scaleX: [0.8, 1.3],
    scaleY: [0.8, 1.3],
    satellites: { count: [0, 1], dist: [1.1, 1.6], size: [0.05, 0.12] },
    lobes: { count: [2, 3], dist: [0.5, 1.0], size: [0.45, 0.75] },
  },
}

const ARCHETYPES = Object.keys(SHAPES) as Archetype[]

/** Continuous sample in `[lo, hi)`. */
function sample(rng: Rng, [lo, hi]: Range): number {
  return lo + rng() * (hi - lo)
}

/** Integer sample in the inclusive range `[lo, hi]`. */
function sampleInt(rng: Rng, [lo, hi]: Range): number {
  return lo + Math.floor(rng() * (hi - lo + 1))
}

/** Weighted archetype pick over `SHAPES`. */
export function pickArchetype(rng: Rng): Archetype {
  const total = ARCHETYPES.reduce((sum, a) => sum + SHAPES[a].weight, 0)
  let t = rng() * total
  for (const a of ARCHETYPES) {
    t -= SHAPES[a].weight
    if (t < 0) return a
  }
  return 'blob'
}

/**
 * Generate a resolved blot centred at `(cx, cy)` with base radius `r`. The
 * archetype is picked at random unless one is passed explicitly (tests do).
 */
export function generateBlot(
  cx: number,
  cy: number,
  r: number,
  rng: Rng,
  archetype: Archetype = pickArchetype(rng),
): Blot {
  const s = SHAPES[archetype]
  const n = sampleInt(rng, s.points)

  const theta0 = rng() * TAU // random orientation of the anisotropic frame
  const cos0 = Math.cos(theta0)
  const sin0 = Math.sin(theta0)
  const scaleX = sample(rng, s.scaleX)
  const scaleY = sample(rng, s.scaleY)

  const points: Point[] = []
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * TAU
    const dist = r * sample(rng, s.radial)
    // Point in the blot-local anisotropic frame, then rotated by theta0.
    const lx = Math.cos(angle) * dist * scaleX
    const ly = Math.sin(angle) * dist * scaleY
    points.push({
      x: cx + lx * cos0 - ly * sin0,
      y: cy + lx * sin0 + ly * cos0,
    })
  }

  const satellites: Satellite[] = []
  const satCount = sampleInt(rng, s.satellites.count)
  for (let i = 0; i < satCount; i++) {
    const angle = rng() * TAU
    const dist = r * sample(rng, s.satellites.dist)
    satellites.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      r: r * sample(rng, s.satellites.size),
    })
  }

  if (s.lobes) {
    const lobeCount = sampleInt(rng, s.lobes.count)
    for (let i = 0; i < lobeCount; i++) {
      const angle = rng() * TAU
      const dist = r * sample(rng, s.lobes.dist)
      satellites.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        r: r * sample(rng, s.lobes.size),
      })
    }
  }

  return { cx, cy, r, points, satellites }
}
