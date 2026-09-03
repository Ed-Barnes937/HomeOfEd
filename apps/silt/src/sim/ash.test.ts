import { describe, expect, it } from 'vitest'

import {
  ACID,
  ASH,
  DIRT,
  EMBER,
  EMPTY,
  FIRE,
  MOSS,
  MUD,
  OBSIDIAN,
  SAND,
  SEED,
  WATER,
  WOOD,
  v1Elements,
  v1Reactions,
} from './elements.ts'
import { GRID_HEIGHT, GRID_WIDTH } from './constants.ts'
import { canDisplace, createRegistry } from './registry.ts'
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

/** An obsidian shaft one cell wide — obsidian, not dirt, which water wets. */
function shaftAt(sim: Sim, x: number, depth: number): void {
  for (let i = -1; i <= 1; i++) sim.paint(x + i, FLOOR, OBSIDIAN)
  for (let i = 1; i <= depth; i++) {
    sim.paint(x - 1, FLOOR - i, OBSIDIAN)
    sim.paint(x + 1, FLOOR - i, OBSIDIAN)
  }
}

/**
 * `acid.test.ts`' `pour`, with water for the acid: a three-deep bed on a walled
 * obsidian floor with a body of water above it. Poured rather than wedged
 * because a settled chunk sleeps and a sleeping cell is never offered a
 * reaction, and wide rather than a single pair because the result is then a
 * question of how much water there is, not of how the draws fell. Same
 * arrangement `soil.test.ts` wets dirt in, so the two beds are comparable.
 */
function pour(sim: Sim, bed: number): void {
  for (let x = 40; x < 61; x++) sim.paint(x, FLOOR, OBSIDIAN)
  for (let y = FLOOR - 20; y < FLOOR; y++) {
    sim.paint(39, y, OBSIDIAN)
    sim.paint(61, y, OBSIDIAN)
  }
  for (let x = 40; x < 61; x++) {
    for (let y = FLOOR - 3; y < FLOOR; y++) sim.paint(x, y, bed)
  }
  for (let x = 45; x < 56; x++) {
    for (let y = FLOOR - 12; y < FLOOR - 8; y++) sim.paint(x, y, WATER)
  }
}

describe('ash and the burn-to-regrowth loop', () => {
  // Ash is what a fire leaves behind (burnables spec §3): inert, so nothing
  // re-lights it, and a powder, so it falls to the ground where rain can reach
  // it.
  it('boots as a pale inert powder that is not itself a fuel', () => {
    expect(ASH).toBe(19)
    expect(registry.get(ASH)?.tags).toEqual(['powder'])
    // **Not `flammable`**: it is what already burned. The ignition ladder and
    // its `fire + [flammable]` fallback both key on the tag, so leaving it off
    // is what keeps a bed of ash out of the fire entirely.
    expect(registry.has(ASH, 'flammable')).toBe(false)
    expect(registry.get(ASH)?.archetype).toEqual({ kind: 'powder', density: 35, slide: 1 })
    expect(registry.get(ASH)?.hardness).toBe(0)
    // No lifetime: ash is where the burn stops, not another phase of it.
    expect(registry.lifetimeOf(ASH)).toBeUndefined()
    // The mass rule (ADR 0040): four shades, base first.
    expect(registry.get(ASH)?.colours).toHaveLength(4)
  })

  // The residue branch (spec §3). `lifetime.becomes` is single-valued, so the
  // "most embers erupt, some burn down to ash" fork cannot live there — it is a
  // reaction row against the open flame beside the ember. Registry-level rather
  // than a declared-order slice, because a slice can be "fixed" by editing the
  // slice; `fire.test.ts` and `soil.test.ts` pin the order.
  it('registers the residue branch off fire + ember, both ways round', () => {
    expect(registry.reactionFor(FIRE, EMBER)).toMatchObject({
      p: 0.05,
      aBecomes: FIRE,
      bBecomes: ASH,
    })
    expect(registry.reactionFor(EMBER, FIRE)).toMatchObject({
      aBecomes: ASH,
      bBecomes: FIRE,
    })
    // Worth reading carefully: 0.05 is a *per-tick* draw, and an ember glows
    // for 120–180 ticks, so an ember held against open flame for its whole life
    // ends as ash all but certainly. What keeps open flame the common outcome
    // is not the probability but the geometry - the creep front runs away from
    // the cell that lit it, so most embers never touch a flame at all. The
    // mix that comes out of that is ticket 04's to judge; measured on the
    // wall below, about half.
  })

  // Ash-to-mud is `water + dirt` with the bed swapped: two cells in, one out,
  // and the same p, because wetting a bed of residue is the same act as wetting
  // a bed of soil.
  it('registers the wetting row as a spent-water row, exactly as dirt does', () => {
    expect(registry.reactionFor(WATER, ASH)).toMatchObject({
      p: 0.4,
      aBecomes: EMPTY,
      bBecomes: MUD,
    })
    expect(registry.reactionFor(ASH, WATER)).toMatchObject({
      aBecomes: MUD,
      bBecomes: EMPTY,
    })
    expect(registry.reactionFor(WATER, ASH)!.p).toBe(registry.reactionFor(WATER, DIRT)!.p)
  })

  // A choice rather than a surprise: acid's `[powder]` row at `maxHardness: 1`
  // reaches every soft powder, and ash at hardness 0 is one. Two cells in, none
  // out — acid erases a bed of ash rather than leaving anything behind.
  it('is dissolved by acid, like every other soft powder', () => {
    expect(registry.reactionFor(ACID, ASH)).toMatchObject({
      aBecomes: EMPTY,
      bBecomes: EMPTY,
    })
  })

  // Density 35 puts ash between water (30) and mud (50), which is the whole
  // reason the loop closes: it sinks into a pool instead of floating on it, and
  // it rests *on* a wetted bed instead of burying itself in it. Pinned as
  // `canDisplace` rather than as a fall through a shaft, because a shaft full of
  // water would wet the grain on the way down - the row is doing its job, but
  // it makes the sim a poor instrument for the density question.
  it('sits between water and mud on the density ladder', () => {
    expect(canDisplace(registry, ASH, WATER)).toBe(true)
    expect(canDisplace(registry, ASH, MUD)).toBe(false)
    // And the two powders that share the shelf still sink past it, so a
    // sandfall or a dropped seed is not stopped by a layer of residue.
    expect(canDisplace(registry, SAND, ASH)).toBe(true)
    expect(canDisplace(registry, SEED, ASH)).toBe(true)
  })

  it('rests on a bed of mud rather than sinking into it', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 150, 8)
    for (let i = 1; i <= 3; i++) sim.paint(150, FLOOR - i, MUD)
    sim.paint(150, FLOOR - 5, ASH)

    run(sim, 200)

    expect(sim.speciesAt(150, FLOOR - 4)).toBe(ASH)
    for (let i = 1; i <= 3; i++) expect(sim.speciesAt(150, FLOOR - i)).toBe(MUD)
  })

  // The payoff of the branch row: a torched block of wood does not simply
  // vanish. Presence, not quantity - the yield is ticket 04's to tune, so the
  // bounds are only "some, and not all of it". Measured on the same 20×13 wall
  // `fire.test.ts` smolders, seed 1: the first ash lands at tick 4 and 126 of
  // the 260 cells end as residue.
  it('leaves residue behind when a block of wood is burned down', () => {
    const sim = new Sim({ seed: 1 })
    for (let y = FLOOR - 12; y <= FLOOR; y++) {
      for (let x = 40; x < 60; x++) sim.paint(x, y, WOOD)
    }
    const woodBefore = count(sim, WOOD)
    sim.paint(50, FLOOR - 6, FIRE)

    run(sim, 600)

    expect(count(sim, WOOD)).toBe(0)
    expect(count(sim, ASH)).toBeGreaterThan(0)
    // And the branch stays a branch rather than becoming the only ending: some
    // of the block goes up as smoke instead. Not a yield assertion - ticket 04
    // owns the mix, and this bound holds for any of it short of "every cell
    // ends as residue".
    expect(count(sim, ASH)).toBeLessThan(woodBefore)
  })

  // Wetting, as `soil.test.ts` pins it for dirt: statistical at p 0.4, so a
  // poured body of water over a wide bed rather than one pair and one draw.
  it('is wetted to mud by rain, and the water is spent one for one', () => {
    const sim = new Sim({ seed: 1 })
    pour(sim, ASH)
    const ashBefore = count(sim, ASH)
    const waterBefore = count(sim, WATER)

    run(sim, 200)

    const wetted = ashBefore - count(sim, ASH)
    expect(wetted).toBeGreaterThan(0)
    // Two cells in, one out: each cell of mud costs a cell of water.
    expect(count(sim, MUD)).toBe(wetted)
    expect(waterBefore - count(sim, WATER)).toBe(wetted)
  })

  // The loop, end to end (spec §3): what burned leaves ash, rain turns the ash
  // to soil, and a seed planted in it regrows. One loose assertion on purpose -
  // every row it crosses is pinned above or in `life.test.ts`, so what is worth
  // asserting here is only that the chain joins up at all.
  it('closes the loop: rain on an ash bed grows a seed into moss', () => {
    const sim = new Sim({ seed: 1 })
    pour(sim, ASH)
    sim.paint(50, FLOOR - 16, SEED)

    // Ticked until it sprouts rather than for a fixed budget: what is pinned is
    // that the chain joins up, not how long it took. Measured, the water
    // reaches the bed and the first mud appears at tick 5 and the moss at tick
    // 12, so 400 is a horizon rather than a bound.
    let ticks = 0
    while (count(sim, MOSS) === 0 && ticks < 400) {
      sim.tick()
      ticks++
    }

    expect(count(sim, MOSS)).toBeGreaterThan(0)
    // And it came through the ash: nothing else in this world makes mud.
    expect(count(sim, MUD)).toBeGreaterThan(0)
  })
})
