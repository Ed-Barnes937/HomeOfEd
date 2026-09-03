import { describe, expect, it } from 'vitest'

import {
  ACID,
  DIRT,
  EMPTY,
  FIRE,
  LAVA,
  MUD,
  OBSIDIAN,
  SAND,
  STEAM,
  STONE,
  WATER,
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

/**
 * Two cells side by side, boxed in obsidian on all four sides. Sealed rather
 * than open-topped like `acid.test.ts`'s pocket: fire is a gas and would rise
 * out of an open box during the movement half of the same tick it is supposed
 * to react in.
 */
function sealedPair(sim: Sim, x: number, left: number, right: number): void {
  for (let i = -1; i <= 2; i++) {
    sim.paint(x + i, FLOOR, OBSIDIAN)
    sim.paint(x + i, FLOOR - 2, OBSIDIAN)
  }
  sim.paint(x - 1, FLOOR - 1, OBSIDIAN)
  sim.paint(x + 2, FLOOR - 1, OBSIDIAN)
  sim.paint(x, FLOOR - 1, left)
  sim.paint(x + 1, FLOOR - 1, right)
}

/** An obsidian shaft one cell wide, so whatever is inside can only move up or
 * down — obsidian, not dirt, because a dirt wall would turn into mud. */
function shaftAt(sim: Sim, x: number, depth: number): void {
  for (let i = -1; i <= 1; i++) sim.paint(x + i, FLOOR, OBSIDIAN)
  for (let i = 1; i <= depth; i++) {
    sim.paint(x - 1, FLOOR - i, OBSIDIAN)
    sim.paint(x + 1, FLOOR - i, OBSIDIAN)
  }
}

describe('mud', () => {
  it('boots with its id pinned and oozes rather than flows', () => {
    expect(MUD).toBe(14)
    expect(registry.get(MUD)?.archetype).toEqual({
      kind: 'liquid',
      density: 50,
      dispersion: 1,
      move: 0.1,
    })
    expect(registry.has(MUD, 'liquid')).toBe(true)
  })

  // Only this stage's own rows — see the same note in `acid.test.ts`: later
  // stages append, so a whole-table assertion here breaks on every later stage.
  it('declares rows 1–25 in the order the spec pins', () => {
    expect(v1Reactions.slice(0, 25).map((row) => [row.a, row.b])).toEqual([
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
      ['water', 'dirt'],
      ['water', 'ash'],
      ['mud', 'fire'],
      ['mud', 'lava'],
    ])
  })

  it('registers water + dirt as a spent-water row at p 0.4', () => {
    expect(registry.reactionFor(WATER, DIRT)).toMatchObject({
      p: 0.4,
      aBecomes: EMPTY,
      bBecomes: MUD,
    })
    // The table is symmetric: reached from the dirt side, the dirt is still
    // the cell that becomes mud.
    expect(registry.reactionFor(DIRT, WATER)).toMatchObject({
      aBecomes: MUD,
      bBecomes: EMPTY,
    })
  })

  it('is made by pouring water on dirt, and the water is spent one for one', () => {
    const sim = new Sim({ seed: 1 })
    for (let x = 40; x < 61; x++) sim.paint(x, FLOOR, OBSIDIAN)
    for (let y = FLOOR - 20; y < FLOOR; y++) {
      sim.paint(39, y, OBSIDIAN)
      sim.paint(61, y, OBSIDIAN)
    }
    for (let x = 40; x < 61; x++) {
      for (let y = FLOOR - 3; y < FLOOR; y++) sim.paint(x, y, DIRT)
    }
    for (let x = 45; x < 56; x++) {
      for (let y = FLOOR - 12; y < FLOOR - 8; y++) sim.paint(x, y, WATER)
    }
    const waterBefore = count(sim, WATER)
    const dirtBefore = count(sim, DIRT)

    run(sim, 200)

    const wetted = dirtBefore - count(sim, DIRT)
    expect(wetted).toBeGreaterThan(0)
    // Two cells in, one out: each cell of mud costs a cell of water.
    expect(count(sim, MUD)).toBe(wetted)
    // **Steam is in the sum since life ticket 05**: the film left on top of the
    // wetted bed lifts (`evaporation.ts`), so water now leaves this pocket two
    // ways rather than one. It is still spent one for one - into the soil or
    // into the sky - and condensation puts a cell back on the water side of the
    // same sum, so this holds however the two swap
    // ([ADR 0045](../../../../docs/adr/0045-silt-the-water-ledger.md)).
    expect(waterBefore - count(sim, WATER) - count(sim, STEAM)).toBe(wetted)
  })

  it('sand still sinks through it', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 150, 8)
    for (let i = 1; i <= 6; i++) sim.paint(150, FLOOR - i, MUD)
    sim.paint(150, FLOOR - 7, SAND)

    run(sim, 400)

    expect(sim.speciesAt(150, FLOOR - 1)).toBe(SAND)
    expect(sim.speciesAt(150, FLOOR - 2)).toBe(MUD)
  })

  it('sinks under water', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 150, 8)
    for (let i = 1; i <= 6; i++) sim.paint(150, FLOOR - i, WATER)
    sim.paint(150, FLOOR - 7, MUD)

    run(sim, 400)

    expect(sim.speciesAt(150, FLOOR - 1)).toBe(MUD)
    expect(sim.speciesAt(150, FLOOR - 2)).toBe(WATER)
  })

  /**
   * **The quench** (life spec §4.5). This row used to leave smoke, and smoke
   * fades to nothing - so the one thing in the table that *deleted* water was
   * fire drying a bed. Now the soil's water is lofted as the steam it became,
   * which is what lets a wildfire rain on its own ashes
   * ([ADR 0045](../../../../docs/adr/0045-silt-the-water-ledger.md)).
   */
  it('is dried back to dirt by fire, and the flame is lofted as the soil water', () => {
    const sim = new Sim({ seed: 1 })
    sealedPair(sim, 100, MUD, FIRE)

    sim.tick()

    expect(sim.speciesAt(100, FLOOR - 1)).toBe(DIRT)
    expect(sim.speciesAt(101, FLOOR - 1)).toBe(STEAM)
  })

  it('is baked to stone by lava, and the lava survives', () => {
    const sim = new Sim({ seed: 1 })
    sealedPair(sim, 100, MUD, LAVA)

    sim.tick()

    expect(sim.speciesAt(100, FLOOR - 1)).toBe(STONE)
    expect(sim.speciesAt(101, FLOOR - 1)).toBe(LAVA)
  })

  // Rows 11–12 name mud explicitly, so they have to survive the tag rows
  // stage 02 registered. Mud is a liquid and carries no `flammable` tag, so
  // neither `fire + [flammable]` nor `acid + [solid]`/`[powder]` claims it.
  it('falls outside the tag rows: not flammable, not a solid or a powder', () => {
    expect(registry.has(MUD, 'flammable')).toBe(false)
    expect(registry.has(MUD, 'solid')).toBe(false)
    expect(registry.has(MUD, 'powder')).toBe(false)
    // Fire and lava reach mud through its own rows, not through the fuel rows.
    expect(registry.reactionFor(MUD, FIRE)).toMatchObject({
      aBecomes: DIRT,
      bBecomes: STEAM,
    })
    expect(registry.reactionFor(MUD, LAVA)).toMatchObject({
      aBecomes: STONE,
      bBecomes: LAVA,
    })
    // Acid's dissolve rows never register the pair at all.
    expect(registry.reactionFor(ACID, MUD)).toBeUndefined()
    expect(registry.reactionFor(MUD, ACID)).toBeUndefined()
  })
})
