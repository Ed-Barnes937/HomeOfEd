/**
 * Pure inputs for the WebGL ink-in-water sim (`fluid.ts`) — no canvas, no GL,
 * so the mapping from blot geometry to sim splats unit-tests in node.
 *
 * Each blot seed becomes one puddle whose SILHOUETTE is built from geometry, not
 * from advection: a small set of gaussian lobes of DIFFERENT sizes placed so
 * their union is a distinct mark — a round dot, a necked peanut, a curved bean,
 * a lumpy clump, a pointed spike/star, or a concave arch — rather than a
 * radially-symmetric diffusion of one blob. The velocity we inject is a tiny
 * per-lobe RANDOM wobble (organic edges) with no coherent direction, so no dye
 * gets advected into a "jellyfish" tail — except spike arms, which get a short
 * outward push (radial, per arm) to sharpen their tips.
 *
 * Coordinates are normalised to the sim's UV space (origin bottom-left, y
 * flipped from screen space); radii are normalised to the shorter axis so a mark
 * keeps its proportions whatever the canvas aspect.
 */
import { mulberry32 } from '../engine/rng.ts'
import type { Rng } from '../engine/types.ts'
import { DEFAULT_TUNING, type FluidTuning } from './fluid.tuning.ts'

/** A dye/velocity injection in normalised sim space (uv in [0,1], y up). */
export interface Splat {
  x: number
  y: number
  /** Gaussian radius (normalised, ∝ short axis). */
  radius: number
  /** Dye concentration added at the peak. */
  dye: number
  /** Velocity kick (normalised units). */
  vx: number
  vy: number
}

/** Seed geometry in screen/logical space (a blot centre + radius). */
export interface FluidSeed {
  x: number
  y: number
  r: number
}

/** The brush archetypes a puddle can be painted with. */
export type Brush = 'dot' | 'peanut' | 'bean' | 'clump' | 'spike' | 'arch'

/** Fixed pick order — keeps the weighted draw deterministic whatever order the
 * (tunable) weights object was built in. Also the order the `?tune` debug grid
 * forces one-of-each in. */
export const BRUSH_ORDER: readonly Brush[] = ['dot', 'peanut', 'bean', 'clump', 'spike', 'arch']

/** Weighted pick of a brush archetype. The rounded marks (dot/peanut/bean/clump)
 * dominate; the "hard" marks (spike/arch — pointed arms and a concave notch) are
 * accents. Weights are tunable (`fluid.tuning.ts`). */
export function pickBrush(rng: Rng, weights: Record<Brush, number> = DEFAULT_TUNING.weights): Brush {
  let total = 0
  for (const b of BRUSH_ORDER) total += weights[b]
  let r = rng() * total
  for (const b of BRUSH_ORDER) {
    if ((r -= weights[b]) < 0) return b
  }
  return BRUSH_ORDER[BRUSH_ORDER.length - 1]!
}

/**
 * Map blot seeds to sim splats — one brush-archetype puddle per seed. `rng` is
 * visual-only (the field is baked, so the sim runs once per field): it chooses
 * the archetype, its axis, the lobe sizes/offsets, and the wobble.
 */
export function buildSplats(
  seeds: readonly FluidSeed[],
  w: number,
  h: number,
  rng: Rng,
  tuning: FluidTuning = DEFAULT_TUNING,
  /** Debug (`?tune` grid): force seed i to `forceBrushes[i]` instead of the pick. */
  forceBrushes?: readonly Brush[],
): Splat[] {
  const short = Math.min(w, h) || 1
  const splats: Splat[] = []

  for (let si = 0; si < seeds.length; si++) {
    const seed = seeds[si]!
    const px = seed.x / w
    const py = 1 - seed.y / h // GL uv origin is bottom-left
    const r = (seed.r * tuning.radiusScale) / short

    const axis = rng() * Math.PI * 2
    const dx = Math.cos(axis)
    const dy = Math.sin(axis)
    const nx = -dy // axis normal
    const ny = dx

    // Place a lobe by (along, perp) offset in short-axis units (local frame:
    // `along` on the mark axis, `perp` on its normal) with an explicit velocity.
    const drop = (along: number, perp: number, radius: number, dye: number, vx: number, vy: number): void => {
      splats.push({
        x: px + ((dx * along + nx * perp) * short) / w,
        y: py + ((dy * along + ny * perp) * short) / h,
        radius,
        dye,
        vx,
        vy,
      })
    }

    // The common case: a lobe with only a small random-direction wobble, so its
    // edge is organic without a coherent tail forming.
    const trail = tuning.trailDye
    const lobe = (along: number, perp: number, radius: number, dye: number): void => {
      const a = rng() * Math.PI * 2
      const m = tuning.wobble * (0.4 + rng() * 0.6)
      drop(along, perp, radius, dye, Math.cos(a) * m, Math.sin(a) * m)
    }

    const brush = forceBrushes?.length ? forceBrushes[si % forceBrushes.length]! : pickBrush(rng, tuning.weights)
    switch (brush) {
      case 'dot': {
        // A small, compact ROUND puddle — the plain one. Kept deliberately
        // little and near-circular so it contrasts the multi-lobe marks.
        lobe(0, 0, r * (0.75 + rng() * 0.2), 1)
        break
      }
      case 'peanut': {
        // TWO unequal lobes on an axis, set far enough apart that the bloom
        // leaves a waist between them — a dumbbell / gourd, not an oval.
        const sep = r * (tuning.peanutSep + rng() * 0.7)
        lobe(-sep * 0.5, 0, r * (0.95 + rng() * 0.2), 1)
        lobe(sep * 0.5, (rng() - 0.5) * 0.4 * r, r * (0.6 + rng() * 0.25), trail)
        break
      }
      case 'bean': {
        // A curved kidney: three lobes on a shallow arc, sizes tapering from a
        // fat end to a thin end so it reads as a directional banana.
        const span = r * (2.0 + rng() * 0.8)
        const bend = (rng() < 0.5 ? -1 : 1) * r * (tuning.beanBend + rng() * 0.7)
        const sizes = [1.0, 0.82, 0.58]
        for (let i = 0; i < 3; i++) {
          const t = i / 2 - 0.5 // -0.5 .. 0.5
          const perp = bend * (0.25 - t * t) // parabola, peaks mid-span
          lobe(span * t, perp, r * sizes[i]!, i === 0 ? 1 : trail)
        }
        break
      }
      case 'spike': {
        // A pointed STAR / cross / jack: a small round core with 3–4 arms, each
        // a chain of shrinking lobes with a short outward push so the tip tapers
        // to a point. Symmetric + short, so it reads as a star, not a tail.
        lobe(0, 0, r * (0.55 + rng() * 0.2), 1)
        const arms = tuning.spikeArms + Math.floor(rng() * 2)
        const base = rng() * Math.PI * 2
        for (let k = 0; k < arms; k++) {
          const th = base + (k / arms) * Math.PI * 2 + (rng() - 0.5) * 0.5
          const ct = Math.cos(th)
          const st = Math.sin(th)
          // World direction of this arm (local angle th on the mark's frame).
          const wx = dx * ct + nx * st
          const wy = dy * ct + ny * st
          const len = r * (tuning.spikeArmLen + rng() * 1.1)
          for (let j = 1; j <= 3; j++) {
            const t = j / 3
            drop(ct * len * t, st * len * t, r * (0.5 - 0.32 * t), trail, wx * tuning.spikeKick * t, wy * tuning.spikeKick * t)
          }
        }
        break
      }
      case 'arch': {
        // A concave ARCH: a top bar of lobes plus two legs hanging from its ends,
        // with the middle-bottom left EMPTY so the bloom keeps an arch-shaped
        // notch instead of filling into a solid mass.
        const span = r * (tuning.archSpan + rng() * 0.6)
        const legLen = r * (tuning.archLeg + rng() * 0.6)
        lobe(-span * 0.5, 0, r * 0.7, 1) // top bar
        lobe(0, 0, r * 0.7, trail)
        lobe(span * 0.5, 0, r * 0.7, trail)
        lobe(-span * 0.5, -legLen * 0.5, r * 0.6, trail) // left leg
        lobe(-span * 0.5, -legLen, r * 0.55, trail)
        lobe(span * 0.5, -legLen * 0.5, r * 0.6, trail) // right leg
        lobe(span * 0.5, -legLen, r * 0.55, trail)
        break
      }
      default: {
        // clump: an irregular lumpy amoeba — a lead lobe plus 3–4 satellites of
        // VARIED size spread WIDE (out to ~2r) so bulges and occasional necks
        // form, rather than a tight disk.
        lobe(0, 0, r * (0.9 + rng() * 0.2), 1)
        const lobes = 3 + Math.floor(rng() * 2)
        for (let i = 0; i < lobes; i++) {
          const a = rng() * Math.PI * 2
          const dist = r * (tuning.clumpSpread + rng() * 0.9)
          lobe(Math.cos(a) * dist, Math.sin(a) * dist, r * (0.5 + rng() * 0.5), trail)
        }
      }
    }
  }

  return splats
}

/** Convenience: a seeded rng for `buildSplats` from a numeric seed. */
export function splatRng(seed: number): Rng {
  return mulberry32(seed >>> 0)
}
