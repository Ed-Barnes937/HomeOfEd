import { describe, expect, it } from 'vitest'

import {
  DIRT,
  EMPTY,
  OBSIDIAN,
  FIRE,
  LAVA,
  MOSS,
  OIL,
  SEED,
  SMOKE,
  STEAM,
  SULPHUR,
  VINE,
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

/** As in `lifecycle.test.ts`: two cells wedged into a pocket with nowhere to
 * move, so a reaction is the only thing that can change them. Obsidian rather
 * than dirt: water turns dirt into mud (materials spec §4 row 10), so a dirt
 * pocket would react with the water this pocket is holding. */
function pocket(sim: Sim, x: number, left: number, right: number): void {
  for (let i = -2; i <= 3; i++) sim.paint(x + i, FLOOR, OBSIDIAN)
  sim.paint(x - 1, FLOOR - 1, OBSIDIAN)
  sim.paint(x + 2, FLOOR - 1, OBSIDIAN)
  sim.paint(x, FLOOR - 1, left)
  sim.paint(x + 1, FLOOR - 1, right)
}

/**
 * Whether one tick of a wedged pocket lights `fuel`. The fuel sits on the
 * right-hand side, which the first tick's right-to-left scan reaches before the
 * fire, so the fuel cell gets its draw whatever the fire cell then does - a gas
 * that rises a cell is no longer an orthogonal contact, and `applyReactions`
 * counts nothing else. A fuel that misses that draw may still be reached by the
 * fire cell's own draw the same tick, so this reads a little above the row's `p`
 * for anything short of certainty.
 */
function ignitesOnFirstTick(seed: number, fuel: number): boolean {
  const sim = new Sim({ seed })
  pocket(sim, 100, FIRE, fuel)

  sim.tick()

  return sim.speciesAt(101, FLOOR - 1) === FIRE
}

/** Enough draws that the two ladder ends are separated by rank, not by luck.
 * Named for the PRNG, not for the `SEED` species this file also burns. */
const RNG_SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)

describe('the fire group', () => {
  it('boots with its five ids pinned', () => {
    expect([WOOD, OIL, FIRE, SMOKE, STEAM]).toEqual([6, 7, 8, 9, 10])
    for (const id of [WOOD, OIL, FIRE, SMOKE, STEAM]) {
      expect(registry.get(id)).toBeDefined()
    }
    expect(registry.get(FIRE)?.tags).toContain('energy')
    expect(registry.has(WOOD, 'flammable')).toBe(true)
    expect(registry.has(OIL, 'flammable')).toBe(true)
  })

  // Rows 1–9 are this group's; later groups append to the same table, so this
  // pins the head of it rather than the whole thing.
  it('registers rows 1–9 in the declared order', () => {
    expect(v1Reactions.slice(0, 9).map((row) => [row.a, row.b])).toEqual([
      ['water', 'lava'],
      ['water', 'fire'],
      ['fire', 'sulphur'],
      ['fire', 'oil'],
      ['fire', 'vine'],
      ['fire', 'seed'],
      ['fire', 'moss'],
      ['fire', 'flammable'],
      ['lava', 'flammable'],
    ])
  })

  // The same trap `acid + wood` documents, on the fire side, stated as the
  // invariant rather than as a slice: the tag row covers every fuel pair too,
  // and `resolvePairs` keeps the first registration and drops the rest without
  // a word. Written this way it goes on holding as later rows are appended.
  // Either ordering counts, because `resolvePairs` registers a row both ways
  // round: a later `{ a: 'wood', b: 'fire' }` would take the pair just as
  // silently as `{ a: 'fire', b: 'wood' }` would.
  it('declares every specific fire row above the fire tag row', () => {
    const tag = v1Reactions.findIndex((row) => row.a === 'fire' && row.b === 'flammable')
    const flammable = new Set(
      v1Elements.filter((element) => element.tags.includes('flammable')).map((el) => el.name),
    )
    // Only a pair the tag row would itself claim is at risk. `water + fire` and
    // `mud + fire` name partners carrying no `flammable` tag, so where they sit
    // is nobody's business.
    const late = v1Reactions
      .slice(tag + 1)
      .filter(
        (row) =>
          (row.a === 'fire' && flammable.has(row.b)) || (row.b === 'fire' && flammable.has(row.a)),
      )
      .map((row) => `${row.a} + ${row.b}`)

    expect(late).toEqual([])
  })

  // The ladder itself (spec §1): each fuel has its own ignition character, so a
  // heap of sulphur chains where a mat of moss smoulders through. The values
  // are ticket 04's to tune, so only sulphur's certainty and the *ranks* are
  // pinned here.
  it('gives each fuel its own ignition rate rather than the tag row rate', () => {
    const p = (fuel: number) => registry.reactionFor(FIRE, fuel)?.p
    const tagRow = v1Reactions.find((row) => row.a === 'fire' && row.b === 'flammable')!

    expect(p(SULPHUR)).toBe(1)
    expect(p(SULPHUR)).toBeGreaterThan(p(OIL)!)
    expect(p(OIL)).toBeGreaterThan(p(VINE)!)
    expect(p(VINE)).toBeGreaterThan(p(SEED)!)
    expect(p(SEED)).toBeGreaterThan(p(MOSS)!)
    // Wood has no row of its own yet: it keeps igniting through the tag
    // fallback until ticket 02 gives it the ember.
    expect(p(WOOD)).toBe(tagRow.p)
  })

  it('lights sulphur the moment fire touches it', () => {
    expect(RNG_SEEDS.filter((seed) => ignitesOnFirstTick(seed, SULPHUR))).toHaveLength(
      RNG_SEEDS.length,
    )
  })

  it('usually leaves moss unlit on the first tick, so a mat takes time to burn', () => {
    const lit = RNG_SEEDS.filter((seed) => ignitesOnFirstTick(seed, MOSS))

    // Both ends matter: moss that never lit would be a missing row, and moss
    // that lit as readily as sulphur would be the tag row still winning. The
    // bound is a real discriminator rather than decoration - measured, this
    // pocket lights moss on 11 of the 40 seeds at its own 0.2 and on 25 of
    // them at the tag row's 0.4, so losing the rung fails this.
    expect(lit.length).toBeGreaterThan(0)
    expect(lit.length).toBeLessThan(RNG_SEEDS.length / 2)
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

  // The ignition rows rewrite the fire cell, which clears `ra` and so restarts
  // its countdown: fire burns while its fuel lasts. That is the design, not a
  // bug. Wood reaches them through the tag fallback until ticket 02 lands.
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
    // An obsidian well, so neither liquid can simply spread out of the
    // experiment — and so the water wets no dirt on its way.
    for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, OBSIDIAN)
    for (let y = FLOOR - 14; y < FLOOR; y++) {
      sim.paint(145, y, OBSIDIAN)
      sim.paint(155, y, OBSIDIAN)
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
