import { describe, expect, it } from 'vitest'

import { mulberry32 } from '../engine/rng.ts'
import { buildSplats, pickBrush, splatRng, type Brush, type FluidSeed, type Splat } from './fluid.helpers.ts'
import { DEFAULT_TUNING } from './fluid.tuning.ts'

const SEEDS: FluidSeed[] = [
  { x: 100, y: 200, r: 60 },
  { x: 400, y: 150, r: 40 },
]

describe('pickBrush', () => {
  it('produces the full set of archetypes across many draws', () => {
    const rng = mulberry32(1)
    const seen = new Set<Brush>()
    for (let i = 0; i < 300; i++) seen.add(pickBrush(rng))
    expect(seen).toEqual(new Set<Brush>(['dot', 'peanut', 'bean', 'clump', 'spike', 'arch']))
  })
})

describe('buildSplats', () => {
  it('emits between one and sixteen lobes per seed', () => {
    // Fewest: a dot (1 lobe). Most: a 5-arm spike — core + 3 lobes per arm.
    const splats = buildSplats(SEEDS, 800, 600, mulberry32(1))
    expect(splats.length).toBeGreaterThanOrEqual(SEEDS.length * 1)
    expect(splats.length).toBeLessThanOrEqual(SEEDS.length * 16)
  })

  it('leads each puddle with a full-strength lobe that carries a wobble kick', () => {
    const [lead] = buildSplats([SEEDS[0]!], 800, 600, mulberry32(1))
    expect(lead!.dye).toBe(1)
    expect(Math.hypot(lead!.vx, lead!.vy)).toBeGreaterThan(0)
  })

  it('centres the puddle on the blot in flipped, normalised uv', () => {
    // A single seed at the centre of a square canvas → centroid near (0.5, 0.5).
    const splats = buildSplats([{ x: 300, y: 300, r: 60 }], 600, 600, mulberry32(4))
    const mx = splats.reduce((s, p) => s + p.x, 0) / splats.length
    const my = splats.reduce((s, p) => s + p.y, 0) / splats.length
    expect(Math.abs(mx - 0.5)).toBeLessThan(0.15)
    expect(Math.abs(my - 0.5)).toBeLessThan(0.15) // 1 - 300/600, and y is flipped
  })

  it('is deterministic for the same rng seed and differs for another', () => {
    const a = buildSplats(SEEDS, 800, 600, splatRng(7))
    const b = buildSplats(SEEDS, 800, 600, splatRng(7))
    const c = buildSplats(SEEDS, 800, 600, splatRng(8))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it('returns nothing for no seeds', () => {
    expect(buildSplats([], 800, 600, mulberry32(1))).toEqual([])
  })
})

// The silhouette is built from where the lobes sit, not from advection, so the
// per-archetype layout is a testable contract. On a SQUARE canvas the sim-uv
// offsets equal the local short-axis units, so centre-to-centre distances are
// directly comparable to the returned lobe radii. `forceBrushes` pins one
// archetype (also exercises the `?tune` debug grid path).
describe('archetype geometry', () => {
  const SQUARE = 600
  const shape = (brush: Brush, seed = 1): Splat[] =>
    buildSplats([{ x: 300, y: 300, r: 60 }], SQUARE, SQUARE, mulberry32(seed), DEFAULT_TUNING, [brush])
  const dist = (a: Splat, b: Splat): number => Math.hypot(a.x - b.x, a.y - b.y)

  it('dot is a single full-strength round lobe', () => {
    const s = shape('dot')
    expect(s).toHaveLength(1)
    expect(s[0]!.dye).toBe(1)
  })

  it('peanut is two distinct lobes offset along an axis (a neck forms)', () => {
    const s = shape('peanut')
    expect(s).toHaveLength(2)
    // Centres are separated by more than the larger lobe's radius, so the two
    // gaussians read as a necked dumbbell rather than one concentric blob.
    expect(dist(s[0]!, s[1]!)).toBeGreaterThan(Math.max(s[0]!.radius, s[1]!.radius))
  })

  it('bean is three lobes that taper fat→thin and curve off-axis', () => {
    const [a, mid, b] = shape('bean')
    expect(a!.radius).toBeGreaterThan(mid!.radius) // taper: fat lead …
    expect(mid!.radius).toBeGreaterThan(b!.radius) // … to thin tail
    // Curve: the middle lobe sits off the chord joining the two ends.
    const chord = Math.hypot(b!.x - a!.x, b!.y - a!.y)
    const area2 = Math.abs((b!.x - a!.x) * (a!.y - mid!.y) - (a!.x - mid!.x) * (b!.y - a!.y))
    expect(area2 / chord).toBeGreaterThan(0) // perpendicular offset of mid
  })

  it('spike is a core with arms radiating in several directions', () => {
    const s = shape('spike')
    // core (1 lobe) + 3 lobes per arm, arms ≥ spikeArms.
    expect(s.length).toBeGreaterThanOrEqual(1 + 3 * DEFAULT_TUNING.spikeArms)
    const core = s.reduce((m, p) => (p.radius > m.radius ? p : m)) // the core is largest
    const sectors = new Set<number>()
    for (const p of s) {
      if (p === core) continue
      const ang = Math.atan2(p.y - core.y, p.x - core.x)
      sectors.add(Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 8) % 8)
    }
    expect(sectors.size).toBeGreaterThanOrEqual(3) // a star, not a streak
  })

  it('arch is seven lobes enclosing a hollow notch', () => {
    const s = shape('arch')
    expect(s).toHaveLength(7)
    const cx = s.reduce((t, p) => t + p.x, 0) / s.length
    const cy = s.reduce((t, p) => t + p.y, 0) / s.length
    const maxR = Math.max(...s.map((p) => p.radius))
    const nearest = Math.min(...s.map((p) => Math.hypot(p.x - cx, p.y - cy)))
    // Concave: the centre of mass falls on bare paper, not on any lobe.
    expect(nearest).toBeGreaterThan(0.4 * maxR)
  })
})
