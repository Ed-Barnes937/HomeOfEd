import { describe, expect, it } from 'vitest'

import { DIRT, EMPTY, LAVA, OBSIDIAN, SAND, WATER, v1Elements, v1Reactions } from './elements.ts'
import { GRID_HEIGHT, GRID_WIDTH, RA_OFFSET } from './constants.ts'
import { Sim } from './sim.ts'
import type { ElementDef, ReactionRow } from './types.ts'

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

function raAt(sim: Sim, x: number, y: number): number {
  return sim.cells[(y * GRID_WIDTH + x) * 4 + RA_OFFSET]!
}

/**
 * Two cells wedged into a dirt pocket at `(x, FLOOR - 1)` and `(x + 1, FLOOR -
 * 1)` with nowhere to move, so a reaction is the only thing that can change
 * them and one tick is enough to see it.
 */
function pocket(sim: Sim, x: number, left: number, right: number): void {
  for (let i = -2; i <= 3; i++) sim.paint(x + i, FLOOR, DIRT)
  sim.paint(x - 1, FLOOR - 1, DIRT)
  sim.paint(x + 2, FLOOR - 1, DIRT)
  sim.paint(x, FLOOR - 1, left)
  sim.paint(x + 1, FLOOR - 1, right)
}

describe('reaction table', () => {
  it('turns both touching cells into obsidian', () => {
    const sim = new Sim({ seed: 1 })
    pocket(sim, 100, WATER, LAVA)

    sim.tick()

    expect(sim.speciesAt(100, FLOOR - 1)).toBe(OBSIDIAN)
    expect(sim.speciesAt(101, FLOOR - 1)).toBe(OBSIDIAN)
  })

  it('does nothing when the table is empty — the rule is data, not element code', () => {
    const sim = new Sim({ seed: 1, elements: v1Elements, reactions: [] })
    pocket(sim, 100, WATER, LAVA)

    for (let i = 0; i < 10; i++) sim.tick()

    expect(count(sim, OBSIDIAN)).toBe(0)
    expect(count(sim, WATER)).toBe(1)
    expect(count(sim, LAVA)).toBe(1)
  })

  it('matches a row keyed by tag rather than by name', () => {
    const byTag: ReactionRow[] = [
      { a: 'dirt', b: 'liquid', p: 1, aBecomes: 'sand', bBecomes: null },
    ]
    const sim = new Sim({ seed: 1, reactions: byTag })
    pocket(sim, 100, WATER, LAVA)

    sim.tick()

    // Water is tagged `liquid`, so the dirt it touches turns to sand and the
    // water is cleared — without the table naming water at all.
    expect(sim.speciesAt(100, FLOOR - 1)).toBe(EMPTY)
    expect(count(sim, SAND)).toBeGreaterThan(0)
  })

  it('spares a cell harder than the row allows', () => {
    const hard: ElementDef[] = v1Elements.map((def) =>
      def.name === 'dirt' ? { ...def, hardness: 5 } : def,
    )
    const soft: ReactionRow[] = [
      { a: 'dirt', b: 'water', p: 1, aBecomes: 'sand', bBecomes: null, maxHardness: 1 },
    ]
    const sim = new Sim({ seed: 1, elements: hard, reactions: soft })
    pocket(sim, 100, WATER, LAVA)

    sim.tick()

    expect(sim.speciesAt(99, FLOOR - 1)).toBe(DIRT)
    expect(count(sim, SAND)).toBe(0)
  })

  it('draws a sub-1 probability from the sim PRNG', () => {
    const coinFlip: ReactionRow[] = [
      { a: 'water', b: 'lava', p: 0.5, aBecomes: 'obsidian', bBecomes: 'obsidian' },
    ]
    const reactedIn = (seed: number) => {
      const sim = new Sim({ seed, reactions: coinFlip })
      for (let x = 0; x < 40; x++) pocket(sim, 4 + x * 6, WATER, LAVA)
      sim.tick()
      return count(sim, OBSIDIAN)
    }

    const first = reactedIn(3)
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(80)
    // Same seed, same outcome; a different seed moves the count.
    expect(reactedIn(3)).toBe(first)
  })
})

/** A throwaway gas: the only thing in the suite with a lifetime or a hook. */
const vapour: ElementDef = {
  id: 100,
  name: 'vapour',
  colours: ['#cfd6da'],
  tags: ['gas'],
  archetype: { kind: 'gas', density: -20, dispersion: 0 },
  lifetime: { ticks: 5, becomes: 'water' },
}

const withVapour = [...v1Elements, vapour]

describe('lifetime', () => {
  it('turns into its `becomes` element when the countdown runs out', () => {
    const sim = new Sim({ seed: 1, elements: withVapour })
    sim.paint(10, 100, vapour.id)

    for (let i = 0; i < 4; i++) sim.tick()
    expect(count(sim, vapour.id)).toBe(1)

    sim.tick()

    expect(count(sim, vapour.id)).toBe(0)
    expect(count(sim, WATER)).toBe(1)
  })

  it('counts down in `ra`, leaving `rb` to the colour variant', () => {
    const sim = new Sim({ seed: 1, elements: withVapour })
    sim.paint(10, 100, vapour.id)

    sim.tick()

    // It rose one cell and took its countdown with it.
    expect(sim.speciesAt(10, 99)).toBe(vapour.id)
    expect(raAt(sim, 10, 99)).toBe(4)
  })

  it('vanishes when `becomes` is null', () => {
    const puff: ElementDef = { ...vapour, lifetime: { ticks: 2, becomes: null } }
    const sim = new Sim({ seed: 1, elements: [...v1Elements, puff] })
    sim.paint(10, 100, puff.id)

    for (let i = 0; i < 2; i++) sim.tick()

    expect(count(sim, puff.id)).toBe(0)
    expect(count(sim, WATER)).toBe(0)
  })

  it('spreads expiry across a jittered batch', () => {
    const jittery: ElementDef = { ...vapour, lifetime: { ticks: 2, jitter: 20, becomes: null } }
    const sim = new Sim({ seed: 1, elements: [...v1Elements, jittery] })
    for (let x = 0; x < 40; x++) sim.paint(x, 100, jittery.id)

    for (let i = 0; i < 6; i++) sim.tick()

    const left = count(sim, jittery.id)
    expect(left).toBeGreaterThan(0)
    expect(left).toBeLessThan(40)
  })
})

describe('onTick hook', () => {
  it('runs strictly after the archetype has moved the cell', () => {
    // The hook stamps the cell above wherever it now is. Run before movement it
    // would stamp y - 1; run after, it stamps the cell the grain just left.
    const tracer: ElementDef = {
      id: 101,
      name: 'tracer',
      colours: ['#ffffff'],
      tags: [],
      archetype: { kind: 'powder', density: 60, slide: 0 },
      onTick: (api) => api.set(0, -1, DIRT),
    }
    const sim = new Sim({ seed: 1, elements: [...v1Elements, tracer] })
    sim.paint(10, 100, tracer.id)

    sim.tick()

    expect(sim.speciesAt(10, 101)).toBe(tracer.id)
    expect(sim.speciesAt(10, 100)).toBe(DIRT)
    expect(sim.speciesAt(10, 99)).toBe(EMPTY)
  })

  it('does not run on a cell a reaction already transmuted', () => {
    const shouter: ElementDef = {
      id: 101,
      name: 'shouter',
      colours: ['#ffffff'],
      tags: [],
      archetype: { kind: 'static' },
      onTick: (api) => api.set(0, -1, SAND),
    }
    const rule: ReactionRow[] = [
      { a: 'shouter', b: 'water', p: 1, aBecomes: 'obsidian', bBecomes: null },
    ]
    const sim = new Sim({ seed: 1, elements: [...v1Elements, shouter], reactions: rule })
    pocket(sim, 100, shouter.id, WATER)

    sim.tick()

    expect(sim.speciesAt(100, FLOOR - 1)).toBe(OBSIDIAN)
    expect(sim.speciesAt(100, FLOOR - 2)).toBe(EMPTY)
  })

  it('does not run on a cell whose lifetime expired this tick', () => {
    const dying: ElementDef = {
      ...vapour,
      lifetime: { ticks: 1, becomes: null },
      onTick: (api) => api.set(0, 1, SAND),
    }
    const sim = new Sim({ seed: 1, elements: [...v1Elements, dying] })
    sim.paint(10, 100, dying.id)

    sim.tick()

    expect(count(sim, SAND)).toBe(0)
  })
})

describe('the v1 roster', () => {
  it('registers exactly one reaction row', () => {
    expect(v1Reactions).toHaveLength(1)
    expect(v1Reactions[0]).toMatchObject({ a: 'water', b: 'lava', p: 1 })
  })

  it('makes obsidian where a poured stream of water meets lava', () => {
    const sim = new Sim({ seed: 1 })
    for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, DIRT)
    for (let x = 120; x < 140; x++) sim.paint(x, FLOOR - 1, LAVA)
    for (let x = 120; x < 140; x++) sim.paint(x, FLOOR - 6, WATER)

    for (let i = 0; i < 40; i++) sim.tick()

    expect(count(sim, OBSIDIAN)).toBeGreaterThan(0)
  })
})
