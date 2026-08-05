import { describe, expect, it } from 'vitest'

import { DIRT, EMPTY, LAVA, SAND, WATER, v1Elements } from './elements.ts'
import { GRID_HEIGHT, GRID_WIDTH } from './constants.ts'
import { Sim } from './sim.ts'
import type { ElementDef } from './types.ts'

const FLOOR = GRID_HEIGHT - 1

function withDirtFloor(sim: Sim): Sim {
  for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, DIRT)
  return sim
}

/** Every cell of a species, as `{ x, y }` — enough to describe a puddle. */
function cellsOf(sim: Sim, species: number): { x: number; y: number }[] {
  const found: { x: number; y: number }[] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (sim.speciesAt(x, y) === species) found.push({ x, y })
    }
  }
  return found
}

/** A column `height` tall sitting on the floor, centred on `x`. */
function pourColumn(sim: Sim, x: number, height: number, species: number): void {
  for (let i = 1; i <= height; i++) sim.paint(x, FLOOR - i, species)
}

/** A one-cell-wide dirt shaft, so a liquid inside it can only move vertically. */
function wellAt(sim: Sim, x: number, depth: number): Sim {
  withDirtFloor(sim)
  for (let i = 1; i <= depth; i++) {
    sim.paint(x - 1, FLOOR - i, DIRT)
    sim.paint(x + 1, FLOOR - i, DIRT)
  }
  return sim
}

describe('liquid movement', () => {
  it('falls one cell per tick while nothing is under it', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 10, WATER)

    sim.tick()

    expect(sim.speciesAt(10, 10)).toBe(EMPTY)
    expect(sim.speciesAt(10, 11)).toBe(WATER)
  })

  it('spreads sideways along a floor it cannot fall through', () => {
    const sim = withDirtFloor(new Sim({ seed: 1 }))
    pourColumn(sim, 150, 12, WATER)

    for (let i = 0; i < 200; i++) sim.tick()

    const water = cellsOf(sim, WATER)
    expect(water).toHaveLength(12)

    // A column 12 tall has levelled when it is no longer 12 tall and has
    // reached cells the column never occupied.
    const top = Math.min(...water.map((c) => c.y))
    const span = Math.max(...water.map((c) => c.x)) - Math.min(...water.map((c) => c.x)) + 1
    expect(top).toBeGreaterThan(FLOOR - 12)
    expect(span).toBeGreaterThan(1)
  })

  it('does not displace an equally dense neighbour', () => {
    // Two water cells stacked on the floor must not trade places forever.
    const sim = withDirtFloor(new Sim({ seed: 1 }))
    sim.paint(10, FLOOR - 1, WATER)
    sim.paint(10, FLOOR - 2, WATER)

    for (let i = 0; i < 50; i++) sim.tick()

    expect(cellsOf(sim, WATER)).toHaveLength(2)
  })

  it('lets a denser powder sink through it', () => {
    const sim = wellAt(new Sim({ seed: 1 }), 150, 8)
    pourColumn(sim, 150, 6, WATER)
    sim.paint(150, FLOOR - 7, SAND)

    for (let i = 0; i < 60; i++) sim.tick()

    // The grain sank to the bottom of the well and the water closed over it.
    expect(sim.speciesAt(150, FLOOR - 1)).toBe(SAND)
    expect(sim.speciesAt(150, FLOOR - 2)).toBe(WATER)
  })
})

describe('move probability', () => {
  it('makes lava fall far slower than water', () => {
    const water = new Sim({ seed: 1 })
    water.paint(10, 0, WATER)
    const lava = new Sim({ seed: 1 })
    lava.paint(10, 0, LAVA)

    for (let i = 0; i < 10; i++) {
      water.tick()
      lava.tick()
    }

    expect(water.speciesAt(10, 10)).toBe(WATER)
    // move: 0.15 — roughly one or two steps in ten ticks, never ten.
    const fell = cellsOf(lava, LAVA)[0]!.y
    expect(fell).toBeLessThan(5)
  })

  it('still reaches the floor eventually', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, FLOOR - 20, LAVA)

    // Twenty cells at roughly one step in seven — comfortably inside 400 ticks.
    for (let i = 0; i < 400; i++) sim.tick()

    expect(cellsOf(sim, LAVA).map((c) => c.y)).toEqual([FLOOR])
  })
})

/** A gas exists only to prove the archetype — no v1 element is one. */
const steam: ElementDef = {
  id: 100,
  name: 'steam',
  colours: ['#cfd6da'],
  tags: ['gas'],
  archetype: { kind: 'gas', density: -20, dispersion: 3 },
}

describe('gas movement', () => {
  it('rises one cell per tick', () => {
    const sim = new Sim({ seed: 1, elements: [...v1Elements, steam] })
    sim.paint(10, 10, steam.id)

    sim.tick()

    expect(sim.speciesAt(10, 10)).toBe(EMPTY)
    expect(sim.speciesAt(10, 9)).toBe(steam.id)
  })

  it('stops at the ceiling', () => {
    const sim = new Sim({ seed: 1, elements: [...v1Elements, steam] })
    sim.paint(10, 0, steam.id)

    for (let i = 0; i < 5; i++) sim.tick()

    expect(cellsOf(sim, steam.id).map((c) => c.y)).toEqual([0])
  })

  it('bubbles up through a denser liquid', () => {
    const sim = withDirtFloor(new Sim({ seed: 1, elements: [...v1Elements, steam] }))
    pourColumn(sim, 150, 8, WATER)
    sim.paint(150, FLOOR - 1, steam.id)

    for (let i = 0; i < 40; i++) sim.tick()

    const bubble = cellsOf(sim, steam.id)
    expect(bubble).toHaveLength(1)
    // Negative density means the water sinks past it rather than the other way
    // round, but the bubble still ends up above the water it started under.
    expect(cellsOf(sim, WATER).filter((c) => c.y > bubble[0]!.y)).not.toHaveLength(0)
  })
})

describe('liquid determinism', () => {
  const pourBoth = (sim: Sim) => {
    withDirtFloor(sim)
    for (let x = 140; x < 160; x++) pourColumn(sim, x, 10, WATER)
    for (let x = 100; x < 110; x++) pourColumn(sim, x, 6, LAVA)
  }

  it('same seed gives an identical grid', () => {
    const a = new Sim({ seed: 0xfeed })
    const b = new Sim({ seed: 0xfeed })
    pourBoth(a)
    pourBoth(b)

    for (let i = 0; i < 120; i++) {
      a.tick()
      b.tick()
    }

    expect(a.cells).toEqual(b.cells)
  })
})
