import { describe, expect, it } from 'vitest'

import { spawnPlacement } from './spawn.ts'

const W = 600
const H = 400
const size = { w: 52, h: 60 }

describe('spawnPlacement', () => {
  it('places at centre-left extreme with rng() === 0 (unclamped)', () => {
    const p = spawnPlacement(W, H, size, () => 0)
    expect(p.x).toBeCloseTo(W / 2 - size.w / 2 - 45) // 229
    expect(p.y).toBeCloseTo(H * 0.16) // 64
    expect(p.rot).toBeCloseTo(-7)
  })

  it('places dead-centre with rng() === 0.5', () => {
    const p = spawnPlacement(W, H, size, () => 0.5)
    expect(p.x).toBeCloseTo(W / 2 - size.w / 2) // 274
    expect(p.y).toBeCloseTo(H * 0.16 + 23) // 87
    expect(p.rot).toBeCloseTo(0)
  })

  it('places at centre-right extreme with rng() === 1', () => {
    const p = spawnPlacement(W, H, size, () => 1)
    expect(p.x).toBeCloseTo(W / 2 - size.w / 2 + 45) // 319
    expect(p.y).toBeCloseTo(H * 0.16 + 46) // 110
    expect(p.rot).toBeCloseTo(7)
  })
})
