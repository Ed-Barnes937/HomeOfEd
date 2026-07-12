import { describe, expect, it } from 'vitest'

import { generateField } from '../engine/field.ts'
import { blobCount } from '../engine/layout.ts'
import { mulberry32 } from '../engine/rng.ts'
import {
  BRUSH_ORDER,
  buildSplats,
  DISTINCT_FIELD_MAX,
  pickBrush,
  pickBrushExcluding,
  splatRng,
  type Brush,
  type FluidSeed,
  type Splat,
} from './fluid.helpers.ts'
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

// Every brush archetype must be equally reachable on a phone. Marks are drawn
// WITHOUT replacement on a sparse field, so a phone's floored 3 marks are always
// three DISTINCT archetypes — no accent (e.g. `arch`) can be repeated away or
// omitted. Desktop-scale fields keep the independent weighted pick, unchanged.
describe('sparse-field archetype reachability (mobile)', () => {
  const PHONE = { width: 334, height: 562 } // iPhone-14 canvas card → blobCount 3
  const DESKTOP = { width: 1384, height: 690 } // → blobCount 5

  // Recover a field's per-mark brushes: each archetype has a distinct lobe count,
  // and a field's seeds are well spread, so assign each splat to its nearest seed.
  const countToBrush = (n: number): Brush | null =>
    n === 1 ? 'dot' : n === 2 ? 'peanut' : n === 3 ? 'bean' : n === 4 || n === 5 ? 'clump' : n === 7 ? 'arch' : n >= 12 ? 'spike' : null
  const fieldBrushes = (vb: { width: number; height: number }, seed: number): (Brush | null)[] => {
    const seeds = generateField(vb, mulberry32(seed)).map((b) => ({ x: b.cx, y: b.cy, r: b.r }))
    const splats = buildSplats(seeds, vb.width, vb.height, splatRng(seed))
    const centres = seeds.map((s) => ({ x: s.x / vb.width, y: 1 - s.y / vb.height }))
    const counts = seeds.map(() => 0)
    for (const sp of splats) {
      let bi = 0
      let bd = Infinity
      centres.forEach((c, i) => {
        const d = (sp.x - c.x) ** 2 + (sp.y - c.y) ** 2
        if (d < bd) {
          bd = d
          bi = i
        }
      })
      counts[bi]!++
    }
    return counts.map(countToBrush)
  }

  it('never repeats a used archetype while any remain, then falls back to the full set', () => {
    const rng = mulberry32(3)
    for (let trial = 0; trial < 300; trial++) {
      const used = new Set<Brush>()
      for (let i = 0; i < BRUSH_ORDER.length; i++) {
        const b = pickBrushExcluding(rng, used)
        expect(used.has(b)).toBe(false) // distinct while any remain
        used.add(b)
      }
      expect(used.size).toBe(BRUSH_ORDER.length) // drew all six without repeat
    }
    // Exhausted: still returns a valid archetype (the field never has this many).
    expect(BRUSH_ORDER).toContain(pickBrushExcluding(mulberry32(1), new Set<Brush>(BRUSH_ORDER)))
  })

  it('gives a phone its floor of distinct-archetype marks, every archetype fairly reachable', () => {
    expect(blobCount(PHONE.width, PHONE.height)).toBe(DISTINCT_FIELD_MAX)
    const appears: Record<string, number> = Object.fromEntries(BRUSH_ORDER.map((b) => [b, 0]))
    let pages = 0
    for (let seed = 0; seed < 1500; seed++) {
      const brushes = fieldBrushes(PHONE, seed).filter((b): b is Brush => b !== null)
      if (brushes.length < DISTINCT_FIELD_MAX) continue // skip rare ambiguous segmentation
      pages++
      for (const b of new Set(brushes)) appears[b]!++
    }
    // Each archetype (arch included) lands on ~50% of phone pages — balanced, none
    // excluded or effectively-zero. (Independent picks gave arch only ~42%.)
    for (const b of BRUSH_ORDER) {
      const rate = appears[b]! / pages
      expect(rate).toBeGreaterThan(0.42)
      expect(rate).toBeLessThan(0.58)
    }
  })

  it('leaves desktop-scale selection unchanged: independent picks (archetypes repeat), uniform per mark', () => {
    expect(blobCount(DESKTOP.width, DESKTOP.height)).toBeGreaterThan(DISTINCT_FIELD_MAX)
    // A dense field takes the unchanged path: pick per seed with replacement, so
    // one field with the same rng advances identically to the real loop.
    const marks: Record<string, number> = Object.fromEntries(BRUSH_ORDER.map((b) => [b, 0]))
    let total = 0
    let dupePages = 0
    let pages = 0
    for (let seed = 0; seed < 1500; seed++) {
      const seeds = generateField(DESKTOP, mulberry32(seed)).map((b) => ({ x: b.cx, y: b.cy, r: b.r }))
      const rng = splatRng(seed)
      const brushes = seeds.map((s) => countToBrush(buildSplats([s], DESKTOP.width, DESKTOP.height, rng).length))
      if (brushes.some((b) => b === null)) continue
      pages++
      for (const b of brushes) {
        marks[b as Brush]!++
        total++
      }
      if (new Set(brushes).size < brushes.length) dupePages++
    }
    // With replacement the vast majority of desktop pages repeat an archetype —
    // proof distinct mode did NOT engage above the sparse threshold.
    expect(dupePages / pages).toBeGreaterThan(0.5)
    // Per-mark distribution stays ~uniform (1/6 ≈ 16.7%).
    for (const b of BRUSH_ORDER) expect(marks[b]! / total).toBeGreaterThan(0.1)
  })
})
