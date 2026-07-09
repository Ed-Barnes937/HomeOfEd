import { describe, expect, it } from 'vitest'

import { gardenCurves } from './garden.ts'
import { fullTurns } from './gears.ts'
import { geom } from './geom.ts'
import { DEFAULT_CONFIG, type GardenConfig } from './state.ts'

const BOARD_R = 240

describe('gardenCurves', () => {
  it('returns one curve per wheel', () => {
    const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 120, wheels: [24, 30, 52] }
    const { curves } = gardenCurves(config, BOARD_R)
    expect(curves.map((c) => c.w)).toEqual([24, 30, 52])
  })

  it('clamps every curve point count to [400, 8000]', () => {
    const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 144, wheels: [24, 63] }
    for (const curve of gardenCurves(config, BOARD_R).curves) {
      expect(curve.pts.length).toBeGreaterThanOrEqual(400)
      expect(curve.pts.length).toBeLessThanOrEqual(8000)
    }
  })

  it('reports full === fullTurns(ring, [w]) per curve', () => {
    const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 120, wheels: [45, 52] }
    for (const curve of gardenCurves(config, BOARD_R).curves) {
      expect(curve.full).toBe(fullTurns(config.ring, [curve.w]))
      expect(curve.tMax).toBeCloseTo(Math.PI * 2 * curve.full)
    }
  })

  it('shares one scale that fits every cog inside the board', () => {
    const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 96, wheels: [24, 52, 63], offset: 0.94 }
    const { curves } = gardenCurves(config, BOARD_R)
    for (const curve of curves) {
      for (const [x, y] of curve.pts) {
        expect(Math.hypot(x, y)).toBeLessThanOrEqual(BOARD_R * 1.031)
      }
    }
  })

  it('spaces identical wheels a full turn/N apart (phase = i·2π/N)', () => {
    // Two identical wheels ⇒ N=2, phase[1] = π ⇒ curve 1 is curve 0 rotated by π (negated).
    const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 96, wheels: [52, 52] }
    const [a, b] = gardenCurves(config, BOARD_R).curves
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a!.pts.length).toBe(b!.pts.length)
    for (let i = 0; i < a!.pts.length; i += 37) {
      expect(b!.pts[i]![0]).toBeCloseTo(-a!.pts[i]![0], 6)
      expect(b!.pts[i]![1]).toBeCloseTo(-a!.pts[i]![1], 6)
    }
  })

  it('N=1 reproduces the single-wheel geom() curve (regression anchor)', () => {
    // One wheel, drawn over its full period, is the classic single-wheel
    // spirograph. Unscale both curves and compare the raw parametric points.
    const wheel = 52
    const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 96, wheels: [wheel] }
    const full = fullTurns(config.ring, [wheel])
    const garden = gardenCurves(config, BOARD_R)
    const single = geom({ ...config, turns: full }, BOARD_R)
    const gc = garden.curves[0]!
    expect(gc.pts.length).toBe(single.pts.length)
    for (let i = 0; i < gc.pts.length; i += 41) {
      const gx = gc.pts[i]![0] / garden.scale
      const gy = gc.pts[i]![1] / garden.scale
      const sx = single.pts[i]![0] / single.scale
      const sy = single.pts[i]![1] / single.scale
      expect(gx).toBeCloseTo(sx, 4)
      expect(gy).toBeCloseTo(sy, 4)
    }
  })
})
