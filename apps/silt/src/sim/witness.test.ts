import { describe, expect, it } from 'vitest'

import { FIRE, MOSS, MUD, OBSIDIAN, SEED, SMOKE, STEAM, WATER, LAVA } from './elements.ts'
import { BYTES_PER_CELL, GRID_HEIGHT, GRID_WIDTH } from './constants.ts'
import { Sim } from './sim.ts'
import type { WitnessEvent } from './witness.ts'

/**
 * The discovery recorder, from the sim's side (discovery-tree spec §3, §4). The
 * three transmutation sites are what count; everything else - painting, a
 * restore, a fade with no product - records nothing *by construction*, and the
 * cases below are what says so out loud.
 *
 * Determinism is guarded elsewhere and everywhere: the recorder never draws
 * from the `Rng`, so `sim.test.ts`'s determinism pair and every seeded outcome
 * pinned in `fire.test.ts` / `life.test.ts` / `liquids.test.ts` would move if it
 * did.
 */

const FLOOR = GRID_HEIGHT - 1

/**
 * The field-notes key an event maps to, spelled out here rather than imported:
 * `features/fieldNotes` sits above the sim, and the sim must not reach up into
 * it. The reporting edge (`simWorkerCore`) does the real mapping.
 */
function keyOf(event: WitnessEvent): string {
  return event.kind === 'react' ? `react:${event.a}+${event.b}` : `${event.kind}:${event.a}`
}

function keysOf(sim: Sim): string[] {
  return sim.drainWitnessed().map(keyOf)
}

function count(sim: Sim, species: number): number {
  let total = 0
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (sim.speciesAt(x, y) === species) total++
    }
  }
  return total
}

/** `lifecycle.test.ts`' pocket: two cells wedged where only a reaction can reach them. */
function pocket(sim: Sim, x: number, left: number, right: number, walls: number): void {
  for (let i = -2; i <= 3; i++) sim.paint(x + i, FLOOR, walls)
  sim.paint(x - 1, FLOOR - 1, walls)
  sim.paint(x + 2, FLOOR - 1, walls)
  sim.paint(x, FLOOR - 1, left)
  sim.paint(x + 1, FLOOR - 1, right)
}

/** `life.test.ts`' open-topped tank: a sealed one settles and its chunk sleeps. */
function pool(sim: Sim, left: number, right: number, depth: number): void {
  for (let x = left - 1; x <= right + 1; x++) sim.paint(x, FLOOR, OBSIDIAN)
  for (let i = 1; i <= depth + 2; i++) {
    sim.paint(left - 1, FLOOR - i, OBSIDIAN)
    sim.paint(right + 1, FLOOR - i, OBSIDIAN)
  }
  for (let x = left; x <= right; x++) {
    for (let i = 1; i <= depth; i++) sim.paint(x, FLOOR - i, WATER)
  }
}

function runUntil(sim: Sim, done: (sim: Sim) => boolean, budget: number): void {
  for (let i = 0; i < budget && !done(sim); i++) sim.tick()
}

describe('the witness recorder', () => {
  it('records the pair a reaction fired, canonically ordered', () => {
    const sim = new Sim({ seed: 1 })
    pocket(sim, 100, WATER, LAVA, OBSIDIAN)

    sim.tick()

    // Names sorted, so which cell the scan reached first cannot change the key.
    expect(keysOf(sim)).toEqual(['react:lava+water'])
  })

  it('reports a key once however often the interaction fires', () => {
    const sim = new Sim({ seed: 1 })
    for (let i = 0; i < 6; i++) pocket(sim, 20 + i * 8, WATER, LAVA, OBSIDIAN)

    sim.tick()
    expect(keysOf(sim)).toEqual(['react:lava+water'])

    for (let i = 0; i < 5; i++) sim.tick()
    expect(keysOf(sim)).toEqual([])
  })

  it('records a decay that leaves a product', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(150, 100, FIRE)

    runUntil(sim, (world) => count(world, SMOKE) > 0, 120)

    expect(keysOf(sim)).toEqual(['decay:fire'])
  })

  it('records nothing for a fade - smoke expiring transmutes into nothing', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(150, 100, SMOKE)

    runUntil(sim, (world) => count(world, SMOKE) === 0, 300)

    expect(count(sim, SMOKE)).toBe(0)
    expect(keysOf(sim)).toEqual([])
  })

  it('records the growth hook, named for the plant that grew', () => {
    const sim = new Sim({ seed: 1 })
    pool(sim, 140, 160, 10)
    sim.paint(150, FLOOR - 1, MOSS)

    runUntil(sim, (world) => world.speciesAt(150, FLOOR - 2) !== WATER, 4000)

    expect(keysOf(sim)).toEqual(['grow:moss'])
  })

  it('records nothing for painting, however unpaintable the species', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 10, OBSIDIAN)
    sim.paint(11, 10, MOSS)
    sim.paint(12, 10, STEAM)
    sim.paint(13, 10, MUD)

    expect(keysOf(sim)).toEqual([])
  })

  it('records nothing for a restore - the scene was witnessed when it was made', () => {
    const sim = new Sim({ seed: 1 })
    const size = GRID_WIDTH * GRID_HEIGHT
    const species = new Uint8Array(size)
    species[50 * GRID_WIDTH + 50] = MOSS
    species[50 * GRID_WIDTH + 51] = OBSIDIAN
    species[50 * GRID_WIDTH + 52] = SEED

    sim.restore(species, new Uint8Array(size), new Uint8Array(size))

    expect(keysOf(sim)).toEqual([])
  })

  it('keeps what it has seen across a world reset - discovery is not per world', () => {
    const sim = new Sim({ seed: 1 })
    pocket(sim, 100, WATER, LAVA, OBSIDIAN)
    sim.tick()
    expect(keysOf(sim)).toEqual(['react:lava+water'])

    sim.clear()
    pocket(sim, 100, WATER, LAVA, OBSIDIAN)
    sim.tick()

    expect(keysOf(sim)).toEqual([])
  })

  it('hands back one drained array of events, then nothing until the next witness', () => {
    const sim = new Sim({ seed: 1 })
    pocket(sim, 100, WATER, LAVA, OBSIDIAN)
    sim.tick()

    expect(sim.drainWitnessed()).toHaveLength(1)
    expect(sim.drainWitnessed()).toHaveLength(0)
  })

  it('leaves the cell bytes exactly as they were - recording is not a write', () => {
    const witnessing = new Sim({ seed: 0xc0ffee })
    const quiet = new Sim({ seed: 0xc0ffee })
    for (const sim of [witnessing, quiet]) {
      pocket(sim, 100, WATER, LAVA, OBSIDIAN)
      for (let i = 0; i < 20; i++) sim.tick()
    }
    // The one that drains its firsts and the one that never asks run the same
    // world: the recorder is off to the side of the simulation, not in it.
    witnessing.drainWitnessed()

    expect(Array.from(witnessing.cells)).toEqual(Array.from(quiet.cells))
    expect(witnessing.cells.length).toBe(GRID_WIDTH * GRID_HEIGHT * BYTES_PER_CELL)
  })
})
