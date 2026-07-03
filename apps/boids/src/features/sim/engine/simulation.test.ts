import { describe, expect, it } from 'vitest'

import { DEFAULT_PARAMS, type SimParams } from './params.ts'
import { Simulation, type Rng } from './simulation.ts'

/** Deterministic PRNG (mulberry32) — same seed → same sequence, every call. */
function mulberry32(seed: number): Rng {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSim(overrides: Partial<SimParams> = {}, seed = 1) {
  return new Simulation({
    width: 400,
    height: 400,
    params: { ...DEFAULT_PARAMS, ...overrides },
    rng: mulberry32(seed),
  })
}

/** Park every boid except `keep` far from the (100,100)-ish test area, so a
 * hand-built 2-boid scene isn't perturbed by the rest of the (min count 20)
 * flock. 300,300 is >66px (the largest vision under test) from that area on
 * both the direct and wrapped path in a 400x400 world. */
function isolate(sim: Simulation, keep: number[]): void {
  sim.boids.forEach((b, i) => {
    if (keep.includes(i)) return
    b.x = 300
    b.y = 300
    b.vx = 0
    b.vy = 0
  })
}

function boidAt(sim: Simulation, index: number) {
  const boid = sim.boids[index]
  if (!boid) throw new Error(`no boid at index ${index}`)
  return boid
}

describe('Simulation', () => {
  it('spawns exactly `count` boids with sequential colorIndex', () => {
    const sim = makeSim({ count: 40 })
    expect(sim.boids).toHaveLength(40)
    expect(sim.boids.map((b) => b.colorIndex)).toEqual(Array.from({ length: 40 }, (_, i) => i))
  })

  describe('separation', () => {
    it('steers two close boids apart', () => {
      const sim = makeSim({ separation: 1, alignment: 0, cohesion: 0, vision: 66 })
      isolate(sim, [0, 1])
      const a = boidAt(sim, 0)
      const b = boidAt(sim, 1)
      a.x = 100
      a.y = 100
      a.vx = 0
      a.vy = 0
      b.x = 105 // 5px away — well within the separation radius (vision * 0.5 = 33)
      b.y = 100
      b.vx = 0
      b.vy = 0

      sim.step(16)

      expect(a.vx).toBeLessThan(0) // pushed left, away from b
      expect(b.vx).toBeGreaterThan(0) // pushed right, away from a
    })
  })

  describe('alignment', () => {
    it('steers a boid toward its neighbour’s heading', () => {
      const sim = makeSim({ separation: 0, alignment: 1, cohesion: 0, vision: 66 })
      isolate(sim, [0, 1])
      const a = boidAt(sim, 0)
      const b = boidAt(sim, 1)
      a.x = 100
      a.y = 100
      a.vx = 100
      a.vy = 0
      b.x = 100
      b.y = 110 // 10px away — within vision
      b.vx = 0
      b.vy = 100

      sim.step(16)

      expect(a.vy).toBeGreaterThan(0) // turned toward b's downward heading
      expect(b.vx).toBeGreaterThan(0) // turned toward a's rightward heading
    })
  })

  describe('cohesion', () => {
    it('steers two boids toward each other', () => {
      const sim = makeSim({ separation: 0, alignment: 0, cohesion: 1, vision: 66 })
      isolate(sim, [0, 1])
      const a = boidAt(sim, 0)
      const b = boidAt(sim, 1)
      a.x = 100
      a.y = 100
      a.vx = 0
      a.vy = 0
      b.x = 140 // 40px away — inside vision (66), outside separation radius (33)
      b.y = 100
      b.vx = 0
      b.vy = 0

      sim.step(16)

      expect(a.vx).toBeGreaterThan(0) // pulled right, toward b
      expect(b.vx).toBeLessThan(0) // pulled left, toward a
    })

    it('steers across the toroidal seam via the short path, not the long way around', () => {
      const sim = makeSim({ separation: 0, alignment: 0, cohesion: 1, vision: 66 })
      isolate(sim, [0, 1])
      const a = boidAt(sim, 0)
      const b = boidAt(sim, 1)
      // 2 and 398 in a 400-wide world are 4px apart across the x=0/400 seam,
      // but 396px apart the "long way" through the middle — and land in
      // spatial-hash cells (cellSize = vision = 66) that are wrap-adjacent,
      // so the neighbour query finds this pair only via wrap-aware cell
      // indexing too, not just a wrap-aware distance check.
      a.x = 2
      a.y = 100
      a.vx = 0
      a.vy = 0
      b.x = 398
      b.y = 100
      b.vx = 0
      b.vy = 0

      sim.step(16)

      // Correct (wrapped) cohesion pulls each boid toward the other through
      // the seam: a left (toward x=0, wrapping to meet b), b right (toward
      // x=400, wrapping to meet a). A naive, non-wrapped delta (398 - 2 =
      // 396) would pull them the opposite way — toward the distant long
      // path through the middle of the world — flipping both signs below.
      expect(a.vx).toBeLessThan(0)
      expect(b.vx).toBeGreaterThan(0)
    })
  })

  it('applies no steering to a boid with no neighbours (just wraps position)', () => {
    const sim = makeSim({ vision: 66 })
    isolate(sim, [0])
    const a = boidAt(sim, 0)
    a.x = 399
    a.y = 200
    a.vx = 100
    a.vy = 0
    sim.step(33)
    expect(a.vx).toBeCloseTo(100) // unchanged — no neighbours, no steering force
    expect(a.x).toBeLessThan(399) // wrapped around the right edge
  })

  it('clamps speed up to minSpeed', () => {
    const sim = makeSim({ speed: 2.6 })
    isolate(sim, [0])
    const a = boidAt(sim, 0)
    a.x = 100
    a.y = 100
    a.vx = 0.0001
    a.vy = 0
    sim.step(16)
    const maxSpeed = 2.6 * 60
    const minSpeed = maxSpeed * 0.4
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(minSpeed, 5)
  })

  it('clamps speed down to maxSpeed', () => {
    const sim = makeSim({ speed: 2.6 })
    isolate(sim, [0])
    const a = boidAt(sim, 0)
    a.x = 100
    a.y = 100
    a.vx = 10000
    a.vy = 0
    sim.step(16)
    const maxSpeed = 2.6 * 60
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(maxSpeed, 5)
  })

  it('clamps dt to 33ms — a long stall behaves like exactly one 33ms step', () => {
    const simA = makeSim({ count: 30 }, 42)
    const simB = makeSim({ count: 30 }, 42)
    simA.step(33)
    simB.step(5000)
    expect(simB.boids).toEqual(simA.boids)
  })

  it('is deterministic: same seed + same step sequence → identical boid state', () => {
    const simA = makeSim({ count: 30 }, 7)
    const simB = makeSim({ count: 30 }, 7)
    for (const dt of [16, 16, 20, 16, 33, 16]) {
      simA.step(dt)
      simB.step(dt)
    }
    expect(simB.boids).toEqual(simA.boids)
  })

  describe('setParams count changes', () => {
    it('adds boids in place without resetting existing ones', () => {
      const sim = makeSim({ count: 20 })
      const before = sim.boids.map((b) => ({ ...b }))
      sim.setParams({ ...DEFAULT_PARAMS, count: 25 })
      expect(sim.boids).toHaveLength(25)
      expect(sim.boids.slice(0, 20)).toEqual(before)
      expect(sim.boids[20]?.colorIndex).toBe(20)
      expect(sim.boids[24]?.colorIndex).toBe(24)
    })

    it('removes boids from the end without resetting the rest', () => {
      const sim = makeSim({ count: 25 })
      const before = sim.boids.slice(0, 20).map((b) => ({ ...b }))
      sim.setParams({ ...DEFAULT_PARAMS, count: 20 })
      expect(sim.boids).toHaveLength(20)
      expect(sim.boids).toEqual(before)
    })
  })

  it('setBounds re-wraps existing boids into the new bounds', () => {
    const sim = makeSim({})
    const a = boidAt(sim, 0)
    a.x = 390
    a.y = 390
    sim.setBounds(200, 200)
    expect(a.x).toBeLessThanOrEqual(200)
    expect(a.y).toBeLessThanOrEqual(200)
  })
})
