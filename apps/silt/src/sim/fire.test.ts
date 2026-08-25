import { describe, expect, it } from 'vitest'

import {
  DIRT,
  EMPTY,
  FIRE,
  LAVA,
  OIL,
  SMOKE,
  STEAM,
  WATER,
  WOOD,
  v1Elements,
  v1Reactions,
} from './elements.ts'
import { GRID_HEIGHT, GRID_WIDTH } from './constants.ts'
import { createRegistry } from './registry.ts'
import { Sim } from './sim.ts'

const FLOOR = GRID_HEIGHT - 1

function count(sim: Sim, species: number): number {
  let total = 0
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (sim.speciesAt(x, y) === species) total++
    }
  }
  return total
}

function cellsOf(sim: Sim, species: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (sim.speciesAt(x, y) === species) cells.push({ x, y })
    }
  }
  return cells
}

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.tick()
}

/** As in `lifecycle.test.ts`: two cells wedged into a dirt pocket with nowhere
 * to move, so a reaction is the only thing that can change them. */
function pocket(sim: Sim, x: number, left: number, right: number): void {
  for (let i = -2; i <= 3; i++) sim.paint(x + i, FLOOR, DIRT)
  sim.paint(x - 1, FLOOR - 1, DIRT)
  sim.paint(x + 2, FLOOR - 1, DIRT)
  sim.paint(x, FLOOR - 1, left)
  sim.paint(x + 1, FLOOR - 1, right)
}

describe('the fire group', () => {
  it('boots with its five ids pinned', () => {
    const registry = createRegistry(v1Elements, v1Reactions)

    expect([WOOD, OIL, FIRE, SMOKE, STEAM]).toEqual([6, 7, 8, 9, 10])
    for (const id of [WOOD, OIL, FIRE, SMOKE, STEAM]) {
      expect(registry.get(id)).toBeDefined()
    }
    expect(registry.get(FIRE)?.tags).toContain('energy')
    expect(registry.has(WOOD, 'flammable')).toBe(true)
    expect(registry.has(OIL, 'flammable')).toBe(true)
  })

  // Rows 1–4 are this group's; later groups append to the same table, so this
  // pins the head of it rather than the whole thing.
  it('registers rows 1–4 in the declared order', () => {
    expect(v1Reactions.slice(0, 4).map((row) => [row.a, row.b])).toEqual([
      ['water', 'lava'],
      ['water', 'fire'],
      ['fire', 'flammable'],
      ['lava', 'flammable'],
    ])
  })

  // `canDisplace` is `mine > theirs` and is not direction-aware, so the gas
  // closest to zero ends up highest. Backwards, and fire sits on its own smoke.
  it('lets smoke rise past fire rather than the other way round', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 0, FIRE)
    sim.paint(10, 1, SMOKE)

    sim.tick()

    expect(sim.speciesAt(10, 0)).toBe(SMOKE)
    expect(sim.speciesAt(10, 1)).toBe(FIRE)
  })

  it('burns out to smoke, and the smoke to nothing', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 0, FIRE)

    // `jitter` is added, never subtracted: 40–60 ticks of fire, then 200–255
    // of smoke.
    run(sim, 61)
    expect(count(sim, FIRE)).toBe(0)
    expect(count(sim, SMOKE)).toBe(1)

    run(sim, 256)
    expect(count(sim, SMOKE)).toBe(0)
    expect(sim.speciesAt(10, 0)).toBe(EMPTY)
  })

  // Row 3 rewrites the fire cell, which clears `ra` and so restarts its
  // countdown: fire burns while its fuel lasts. That is the design, not a bug.
  it('keeps burning while it is touching wood', () => {
    const sim = new Sim({ seed: 1 })
    for (let y = FLOOR - 12; y <= FLOOR; y++) {
      for (let x = 40; x < 60; x++) sim.paint(x, y, WOOD)
    }
    sim.paint(50, FLOOR - 6, FIRE)

    // 70 is past the 60-tick ceiling on a lone fire cell's life, so a fire
    // still alight here has been re-lit by its fuel rather than merely not
    // having expired yet.
    run(sim, 70)

    expect(count(sim, FIRE)).toBeGreaterThan(0)
    expect(count(sim, WOOD)).toBe(0)
  })

  it('closes the water cycle: steam expires back to water', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 0, STEAM)

    run(sim, 241)

    expect(count(sim, STEAM)).toBe(0)
    expect(count(sim, WATER)).toBe(1)
  })

  // Oil is lighter than water (20 against 30), so the water sinks past it —
  // the displacement rule does this, no special case.
  it('floats oil on water', () => {
    const sim = new Sim({ seed: 1 })
    // A dirt well, so neither liquid can simply spread out of the experiment.
    for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, DIRT)
    for (let y = FLOOR - 14; y < FLOOR; y++) {
      sim.paint(145, y, DIRT)
      sim.paint(155, y, DIRT)
    }
    // Oil starts underneath the water and has to swap its way out.
    for (let x = 146; x < 155; x++) {
      sim.paint(x, FLOOR - 1, OIL)
      sim.paint(x, FLOOR - 2, OIL)
      for (let y = FLOOR - 6; y <= FLOOR - 3; y++) sim.paint(x, y, WATER)
    }

    run(sim, 100)

    const lowestOil = Math.max(...cellsOf(sim, OIL).map((cell) => cell.y))
    const highestWater = Math.min(...cellsOf(sim, WATER).map((cell) => cell.y))
    expect(lowestOil).toBeLessThan(highestWater)
  })

  it.each([
    ['wood', WOOD],
    ['oil', OIL],
  ])('lets lava ignite %s and survive it', (_name, fuel) => {
    const sim = new Sim({ seed: 1 })
    for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, DIRT)
    for (let x = 90; x < 111; x++) sim.paint(x, FLOOR - 1, fuel)
    // Poured, not wedged: a chunk with nothing moving in it goes to sleep, and
    // a sleeping cell is never offered a reaction — so the lava has to still be
    // running when it reaches the fuel.
    for (let i = 3; i < 8; i++) sim.paint(100, FLOOR - i, LAVA)

    let lit = false
    for (let i = 0; i < 60 && !lit; i++) {
      sim.tick()
      lit = count(sim, FIRE) > 0
    }

    expect(lit).toBe(true)
    // Lava is a heat source, not a fuel: every cell of it is still lava.
    expect(count(sim, LAVA)).toBe(5)
  })

  it('puts fire out with water, and the quench is where steam comes from', () => {
    const sim = new Sim({ seed: 1 })
    pocket(sim, 100, WATER, FIRE)

    sim.tick()

    expect(sim.speciesAt(100, FLOOR - 1)).toBe(STEAM)
    expect(sim.speciesAt(101, FLOOR - 1)).toBe(SMOKE)
  })
})
