import { describe, expect, it } from 'vitest'

import { fullTurns } from './gears.ts'
import { geom, normals } from './geom.ts'
import { DEFAULT_CONFIG, type GardenConfig } from './state.ts'

const BOARD_R = 240

describe('geom', () => {
  it('fits every point inside the board (within the *1.03 tolerance)', () => {
    const configs: GardenConfig[] = [
      DEFAULT_CONFIG,
      { ...DEFAULT_CONFIG, ring: 144, wheels: [24, 63], offset: 0.94, turns: 40 },
      { ...DEFAULT_CONFIG, ring: 120, wheels: [30, 45, 52], offset: 0.08 },
    ]
    for (const config of configs) {
      const { pts } = geom(config, BOARD_R)
      for (const [x, y] of pts) {
        expect(Math.hypot(x, y)).toBeLessThanOrEqual(BOARD_R * 1.031)
      }
    }
  })

  it('returns a point count within [400, 8000]', () => {
    const { pts } = geom(DEFAULT_CONFIG, BOARD_R)
    expect(pts.length).toBeGreaterThanOrEqual(400)
    expect(pts.length).toBeLessThanOrEqual(8000)
  })

  it('increases point count with more turns', () => {
    const few = geom({ ...DEFAULT_CONFIG, ring: 96, wheels: [52], turns: 2 }, BOARD_R)
    const many = geom({ ...DEFAULT_CONFIG, ring: 96, wheels: [52], turns: 13 }, BOARD_R)
    expect(many.pts.length).toBeGreaterThan(few.pts.length)
  })

  it('reports full === fullTurns(ring, wheels)', () => {
    const config = { ...DEFAULT_CONFIG, ring: 120, wheels: [45, 52] }
    expect(geom(config, BOARD_R).full).toBe(fullTurns(config.ring, config.wheels))
  })

  it('sets tMax to 2*pi*revs', () => {
    const config = { ...DEFAULT_CONFIG, ring: 96, wheels: [52], turns: 5 }
    expect(geom(config, BOARD_R).tMax).toBeCloseTo(Math.PI * 2 * 5)
  })
})

describe('normals', () => {
  it('returns one normal per point', () => {
    const { pts } = geom(DEFAULT_CONFIG, BOARD_R)
    expect(normals(pts).length).toBe(pts.length)
  })

  it('returns unit-length vectors', () => {
    const { pts } = geom(DEFAULT_CONFIG, BOARD_R)
    for (const [nx, ny] of normals(pts)) {
      expect(Math.hypot(nx, ny)).toBeCloseTo(1)
    }
  })
})
