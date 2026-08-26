import { describe, expect, it, vi } from 'vitest'

import { DIRT, EMPTY, SAND } from './elements.ts'
import { GRID_HEIGHT, GRID_WIDTH } from './constants.ts'
import { Sim } from './sim.ts'

const FLOOR = GRID_HEIGHT - 1

/** Dirt across the bottom row — the surface most of these cases land on. */
function withDirtFloor(sim: Sim): Sim {
  for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, DIRT)
  return sim
}

describe('powder movement', () => {
  it('falls exactly one cell per tick', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 10, SAND)

    sim.tick()

    expect(sim.speciesAt(10, 10)).toBe(EMPTY)
    expect(sim.speciesAt(10, 11)).toBe(SAND)
  })

  it('stops at the floor', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, FLOOR, SAND)

    for (let i = 0; i < 5; i++) sim.tick()

    expect(sim.speciesAt(10, FLOOR)).toBe(SAND)
  })

  it('rests on dirt when both diagonals are blocked', () => {
    const sim = withDirtFloor(new Sim({ seed: 1 }))
    sim.paint(10, FLOOR - 1, SAND)

    for (let i = 0; i < 5; i++) sim.tick()

    expect(sim.speciesAt(10, FLOOR - 1)).toBe(SAND)
  })

  it('slides off a pile', () => {
    const sim = withDirtFloor(new Sim({ seed: 1 }))
    sim.paint(10, FLOOR - 1, DIRT)
    sim.paint(10, FLOOR - 2, SAND)

    for (let i = 0; i < 5; i++) sim.tick()

    expect(sim.speciesAt(10, FLOOR - 2)).toBe(EMPTY)
    const landed = [9, 11].filter((x) => sim.speciesAt(x, FLOOR - 1) === SAND)
    expect(landed).toHaveLength(1)
  })

  it('treats the world edge as wall', () => {
    const sim = withDirtFloor(new Sim({ seed: 1 }))
    sim.paint(0, FLOOR - 1, DIRT)
    sim.paint(0, FLOOR - 2, SAND)

    // The only diagonal that is not off-world is the one to the right, so a
    // grain in the corner must take it however the coin lands.
    for (let i = 0; i < 5; i++) sim.tick()

    expect(sim.speciesAt(1, FLOOR - 1)).toBe(SAND)
  })

  it('does not fall through static elements', () => {
    const sim = withDirtFloor(new Sim({ seed: 1 }))
    for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, 20, SAND)

    for (let i = 0; i < 30; i++) sim.tick()

    for (let x = 0; x < GRID_WIDTH; x++) {
      expect(sim.speciesAt(x, FLOOR)).toBe(DIRT)
    }
  })
})

describe('determinism', () => {
  const paintPile = (sim: Sim) => {
    withDirtFloor(sim)
    for (let y = 0; y < 12; y++) {
      for (let x = 40; x < 60; x++) sim.paint(x, y, SAND)
    }
  }

  it('same seed and same paint sequence give an identical grid', () => {
    const a = new Sim({ seed: 0xc0ffee })
    const b = new Sim({ seed: 0xc0ffee })
    paintPile(a)
    paintPile(b)

    for (let i = 0; i < 60; i++) {
      a.tick()
      b.tick()
    }

    expect(a.cells).toEqual(b.cells)
  })

  it('never reaches Math.random', () => {
    const random = vi.spyOn(Math, 'random')
    const sim = new Sim({ seed: 7 })
    paintPile(sim)

    for (let i = 0; i < 20; i++) sim.tick()

    expect(random).not.toHaveBeenCalled()
    random.mockRestore()
  })
})

describe('grid storage', () => {
  it('is a transferable typed-array buffer', () => {
    const sim = new Sim({ seed: 1 })

    expect(sim.buffer).toBeInstanceOf(ArrayBuffer)
    expect(sim.cells).toBeInstanceOf(Uint8Array)
    expect(sim.cells.buffer).toBe(sim.buffer)
    expect(sim.buffer.byteLength).toBe(GRID_WIDTH * GRID_HEIGHT * 4)
  })

  it('rejects painting an unregistered species', () => {
    const sim = new Sim({ seed: 1 })

    expect(() => sim.paint(0, 0, 99)).toThrow(/unknown species/i)
  })
})

describe('revision', () => {
  it('bumps on everything that changes the world', () => {
    const sim = new Sim({ seed: 1 })
    const start = sim.revision

    sim.paint(10, 10, SAND)
    const afterPaint = sim.revision
    expect(afterPaint).toBeGreaterThan(start)

    sim.tick()
    const afterTick = sim.revision
    expect(afterTick).toBeGreaterThan(afterPaint)

    sim.clear()
    const afterClear = sim.revision
    expect(afterClear).toBeGreaterThan(afterTick)

    const size = GRID_WIDTH * GRID_HEIGHT
    sim.restore(new Uint8Array(size), new Uint8Array(size), new Uint8Array(size))
    expect(sim.revision).toBeGreaterThan(afterClear)
  })

  it('does not move on a read', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 10, SAND)
    const revision = sim.revision

    sim.speciesAt(10, 10)
    expect(sim.revision).toBe(revision)
  })
})
