import { describe, expect, it } from 'vitest'

import {
  ACID,
  DIRT,
  EMPTY,
  FIRE,
  LAVA,
  OBSIDIAN,
  OIL,
  SAND,
  SMOKE,
  STONE,
  SULPHUR,
  WATER,
  WOOD,
  v1Elements,
  v1Reactions,
} from './elements.ts'
import { GRID_HEIGHT, GRID_WIDTH } from './constants.ts'
import { createRegistry } from './registry.ts'
import { Sim } from './sim.ts'

const FLOOR = GRID_HEIGHT - 1
const registry = createRegistry(v1Elements, v1Reactions)

function count(sim: Sim, species: number): number {
  let total = 0
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (sim.speciesAt(x, y) === species) total++
    }
  }
  return total
}

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.tick()
}

/** As in `fire.test.ts`, but walled in obsidian rather than dirt: acid eats
 * dirt, so a dirt pocket would dissolve the experiment along with its subject. */
function pocket(sim: Sim, x: number, left: number, right: number): void {
  for (let i = -2; i <= 3; i++) sim.paint(x + i, FLOOR, OBSIDIAN)
  sim.paint(x - 1, FLOOR - 1, OBSIDIAN)
  sim.paint(x + 2, FLOOR - 1, OBSIDIAN)
  sim.paint(x, FLOOR - 1, left)
  sim.paint(x + 1, FLOOR - 1, right)
}

/**
 * A bath of `target` on an obsidian floor with a column of acid poured in from
 * above. Poured rather than wedged: a chunk with nothing moving in it sleeps,
 * and a sleeping cell is never offered a reaction, so a rule at p < 1 needs
 * something still in motion to keep getting its draws.
 */
function pour(sim: Sim, target: number): void {
  for (let x = 40; x < 61; x++) sim.paint(x, FLOOR, OBSIDIAN)
  for (let y = FLOOR - 20; y < FLOOR; y++) {
    sim.paint(39, y, OBSIDIAN)
    sim.paint(61, y, OBSIDIAN)
  }
  for (let x = 40; x < 61; x++) {
    for (let y = FLOOR - 3; y < FLOOR; y++) sim.paint(x, y, target)
  }
  for (let x = 45; x < 56; x++) {
    for (let y = FLOOR - 12; y < FLOOR - 8; y++) sim.paint(x, y, ACID)
  }
}

describe('the acid group', () => {
  it('boots with its three ids pinned', () => {
    expect([ACID, STONE, SULPHUR]).toEqual([11, 12, 13])
    for (const id of [ACID, STONE, SULPHUR]) {
      expect(registry.get(id)).toBeDefined()
    }
    // Sulphur burns for free: it carries `flammable`, so PR 01's fire row
    // already covers it and no new row is needed.
    expect(registry.has(SULPHUR, 'flammable')).toBe(true)
    expect(registry.has(SULPHUR, 'powder')).toBe(true)
    expect(registry.has(STONE, 'solid')).toBe(true)
    expect(registry.has(ACID, 'liquid')).toBe(true)
  })

  // `maxHardness` gates a pair at boot, so these numbers are the whole of what
  // acid can and cannot touch.
  it('carries the hardness pass across the whole roster', () => {
    expect(registry.get(DIRT)?.hardness).toBe(0)
    expect(registry.get(SAND)?.hardness).toBe(0)
    expect(registry.get(WOOD)?.hardness).toBe(1)
    expect(registry.get(SULPHUR)?.hardness).toBe(2)
    expect(registry.get(STONE)?.hardness).toBe(3)
    expect(registry.get(OBSIDIAN)?.hardness).toBe(5)
    expect(registry.get(ACID)?.hardness).toBe(0)
  })

  // Only this stage's own rows: later stages append to the same table, and a
  // whole-table assertion here would make every later stage break this file.
  // The slice still pins order — which is load-bearing (spec §1.2) — over the
  // prefix this stage owns, and the last stage's test pins the full length.
  it('declares rows 1–21 in the order the spec pins', () => {
    expect(v1Reactions.slice(0, 21).map((row) => [row.a, row.b])).toEqual([
      ['water', 'lava'],
      ['water', 'fire'],
      ['fire', 'sulphur'],
      ['fire', 'oil'],
      ['fire', 'vine'],
      ['fire', 'seed'],
      ['fire', 'moss'],
      ['fire', 'wood'],
      ['fire', 'flower'],
      ['fire', 'sprout'],
      ['fire', 'flammable'],
      ['fire', 'ember'],
      ['lava', 'wood'],
      ['lava', 'flammable'],
      ['ember', 'wood'],
      ['water', 'ember'],
      ['acid', 'wood'],
      ['acid', 'solid'],
      ['acid', 'powder'],
      ['acid', 'water'],
      ['acid', 'lava'],
    ])
  })

  // The trap: rows 6–7 also cover acid + wood, via `[solid]` at maxHardness 1.
  // `resolvePairs` keeps the *first* registration and drops the rest silently,
  // so reordering the table deletes the residue with no error anywhere. This
  // is the test that turns that into a failure.
  it('registers acid + wood as the sulphur row, not the plain-dissolve row', () => {
    expect(registry.reactionFor(ACID, WOOD)).toMatchObject({
      aBecomes: SULPHUR,
      bBecomes: EMPTY,
    })
    // The table is symmetric: reached from the wood side, the residue still
    // lands on the acid cell.
    expect(registry.reactionFor(WOOD, ACID)).toMatchObject({
      aBecomes: EMPTY,
      bBecomes: SULPHUR,
    })
  })

  // Not "nothing happens at runtime" — the pair is never registered at all,
  // which is what makes the acid↔sulphur loop impossible by construction
  // rather than by a guard.
  it.each([
    ['stone', STONE],
    ['obsidian', OBSIDIAN],
    ['sulphur', SULPHUR],
  ])('never registers the acid + %s pair at all', (_name, tough) => {
    expect(registry.reactionFor(ACID, tough)).toBeUndefined()
    expect(registry.reactionFor(tough, ACID)).toBeUndefined()
  })

  // A deliberate non-edge (spec §4): oil floats on acid and is the container
  // for it, so there is no row and therefore no pair.
  it('leaves acid and oil unregistered — oil floats and shrugs it off', () => {
    expect(registry.reactionFor(ACID, OIL)).toBeUndefined()
    expect(registry.reactionFor(OIL, ACID)).toBeUndefined()
  })

  /**
   * The last non-edge in spec §4: acid eats solids and powders, and rises
   * through gases without touching them. Derived from the roster rather than
   * listed, so a gas added later is covered here the day it lands — the risk
   * this guards is a *future* tag row quietly capturing every gas at once.
   */
  it('leaves acid unregistered against every gas in the roster', () => {
    const gases = v1Elements.filter((def) => def.archetype.kind === 'gas')

    expect(gases.length).toBeGreaterThan(2)
    for (const gas of gases) {
      expect(registry.reactionFor(ACID, gas.id)).toBeUndefined()
      expect(registry.reactionFor(gas.id, ACID)).toBeUndefined()
    }
  })

  it.each([
    ['dirt', DIRT],
    ['sand', SAND],
  ])('dissolves %s, and is spent one cell for one cell', (_name, target) => {
    const sim = new Sim({ seed: 1 })
    pour(sim, target)
    const acidBefore = count(sim, ACID)
    const targetBefore = count(sim, target)

    run(sim, 120)

    const dissolved = targetBefore - count(sim, target)
    expect(dissolved).toBeGreaterThan(0)
    // Two cells in, none out: every dissolve costs exactly one cell of acid.
    expect(acidBefore - count(sim, ACID)).toBe(dissolved)
  })

  it('eats wood and leaves sulphur behind, one grain per cell eaten', () => {
    const sim = new Sim({ seed: 1 })
    pour(sim, WOOD)
    const acidBefore = count(sim, ACID)
    const woodBefore = count(sim, WOOD)

    run(sim, 120)

    const eaten = woodBefore - count(sim, WOOD)
    expect(eaten).toBeGreaterThan(0)
    expect(acidBefore - count(sim, ACID)).toBe(eaten)
    // Two cells in, one out: the residue is the spent acid, not the wall.
    expect(count(sim, SULPHUR)).toBe(eaten)
  })

  it('is neutralised by water', () => {
    const sim = new Sim({ seed: 1 })
    pocket(sim, 100, ACID, WATER)

    sim.tick()

    expect(sim.speciesAt(100, FLOOR - 1)).toBe(WATER)
    expect(sim.speciesAt(101, FLOOR - 1)).toBe(WATER)
  })

  it('boils off to smoke on lava, and the lava survives', () => {
    const sim = new Sim({ seed: 1 })
    pocket(sim, 100, ACID, LAVA)

    sim.tick()

    expect(sim.speciesAt(100, FLOOR - 1)).toBe(SMOKE)
    expect(sim.speciesAt(101, FLOOR - 1)).toBe(LAVA)
  })

  // No new row for this: sulphur burns because the ignition ladder gives it one
  // (at p 1 - it is the flash powder), and did so through `fire + [flammable]`
  // before that. Either way, acid's residue is a fuel and nothing here says so.
  it('burns the sulphur it makes, because sulphur is flammable', () => {
    const sim = new Sim({ seed: 1 })
    expect(registry.reactionFor(FIRE, SULPHUR)).toMatchObject({
      aBecomes: FIRE,
      bBecomes: FIRE,
    })

    for (let x = 40; x < 61; x++) sim.paint(x, FLOOR, OBSIDIAN)
    for (let x = 45; x < 56; x++) sim.paint(x, FLOOR - 1, SULPHUR)
    sim.paint(50, FLOOR - 2, FIRE)

    let lit = false
    for (let i = 0; i < 60 && !lit; i++) {
      sim.tick()
      lit = count(sim, SULPHUR) < 11
    }

    expect(lit).toBe(true)
  })
})
