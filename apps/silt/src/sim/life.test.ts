import { describe, expect, it } from 'vitest'

import {
  ACID,
  EMPTY,
  FIRE,
  MOSS,
  MUD,
  OBSIDIAN,
  SEED,
  VINE,
  WATER,
  v1Elements,
  v1Reactions,
} from './elements.ts'
import { BRANCH_BUDGET } from './growth.ts'
import { BYTES_PER_CELL, GRID_HEIGHT, GRID_WIDTH, RA_OFFSET } from './constants.ts'
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

/** The bounding box of `pool(sim, 140, 160, 10)`, walls included. Counting a
 * window rather than the whole grid keeps a per-tick assertion affordable. */
const POOL = { x0: 139, x1: 161, y0: FLOOR - 12, y1: FLOOR } as const
type Box = typeof POOL

function countIn(sim: Sim, box: Box, species: number): number {
  let total = 0
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      if (sim.speciesAt(x, y) === species) total++
    }
  }
  return total
}

/** 2×2 squares inside `box` whose four cells are all plant. Should always be 0. */
function blocksIn(sim: Sim, box: Box): number {
  const plant = (x: number, y: number): boolean => {
    const species = sim.speciesAt(x, y)
    return species === VINE || species === MOSS
  }
  let blocks = 0
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      if (plant(x, y) && plant(x + 1, y) && plant(x, y + 1) && plant(x + 1, y + 1)) blocks++
    }
  }
  return blocks
}

/**
 * The raw `ra` byte of a cell. `Sim` exposes no accessor for it — deliberately,
 * since `ra` is scratch the engine owns — but `cells` is the buffer, and the
 * growth hook's branch counter lives in this byte, so reading it directly is
 * the only way to check the counter itself rather than its effects.
 */
function raAt(sim: Sim, x: number, y: number): number {
  return sim.cells[(y * GRID_WIDTH + x) * BYTES_PER_CELL + RA_OFFSET]!
}

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.tick()
}

/** As `soil.test.ts`: two cells side by side, sealed in obsidian. */
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

/** An obsidian shaft one cell wide — obsidian, not dirt, which water wets. */
function shaftAt(sim: Sim, x: number, depth: number): void {
  for (let i = -1; i <= 1; i++) sim.paint(x + i, FLOOR, OBSIDIAN)
  for (let i = 1; i <= depth; i++) {
    sim.paint(x - 1, FLOOR - i, OBSIDIAN)
    sim.paint(x + 1, FLOOR - i, OBSIDIAN)
  }
}

/**
 * An obsidian tank with an open top, filled with water. Open rather than
 * sealed: a plant only ticks while its chunk is awake, and chunk sleeping is
 * driven by writes — a hermetically full tank settles and stops writing, and
 * the plant inside it stops growing with it. See the note on `stillWaterSleeps`.
 */
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

/**
 * `acid.test.ts`' `pour`, with the bed size returned: a bed of `target` on an
 * obsidian floor and a body of acid above it. Poured rather than wedged
 * because a settled chunk sleeps and a sleeping cell is never offered a
 * reaction, and wide rather than a single pair because the result is then a
 * question of how much acid there is, not of how the draws fell.
 */
function bath(sim: Sim, target: number): number {
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
  return count(sim, target)
}

describe('seed, moss and vine', () => {
  it('boot with their ids pinned and their archetypes as the spec sets them', () => {
    expect([SEED, MOSS, VINE]).toEqual([15, 16, 17])
    // Denser than water (30), lighter than mud (50): a seed sinks through a
    // pool and comes to rest on the soil rather than burying itself in it.
    expect(registry.get(SEED)?.archetype).toEqual({ kind: 'powder', density: 40, slide: 1 })
    expect(registry.get(MOSS)?.archetype).toEqual({ kind: 'static' })
    expect(registry.get(VINE)?.archetype).toEqual({ kind: 'static' })
  })

  it('declares row 13 last, after the tag rows stage 02 registered', () => {
    expect(v1Reactions.map((row) => [row.a, row.b])).toEqual([
      ['water', 'lava'],
      ['water', 'fire'],
      ['fire', 'flammable'],
      ['lava', 'flammable'],
      ['acid', 'wood'],
      ['acid', 'solid'],
      ['acid', 'powder'],
      ['acid', 'water'],
      ['acid', 'lava'],
      ['water', 'dirt'],
      ['mud', 'fire'],
      ['mud', 'lava'],
      ['seed', 'mud'],
    ])
  })

  it('sprouts moss where a seed meets mud, and the soil is not consumed', () => {
    const sim = new Sim({ seed: 1 })
    sealedPair(sim, 100, SEED, MUD)

    sim.tick()

    // Which of the two cells ends up holding the moss is not pinnable: mud is
    // a liquid and denser than seed (50 to 40), so it may displace the seed
    // sideways in the movement pass before reactions run, and on some seeds it
    // does. What the row promises is the trade, not the address — one moss out,
    // the bed still there, and the seed spent.
    expect(count(sim, MOSS)).toBe(1)
    expect(count(sim, MUD)).toBe(1)
    expect(count(sim, SEED)).toBe(0)
  })

  it('sinks a seed through water and rests it on the mud rather than in it', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 150, 12)
    for (let i = 1; i <= 3; i++) sim.paint(150, FLOOR - i, MUD)
    for (let i = 4; i <= 9; i++) sim.paint(150, FLOOR - i, WATER)
    sim.paint(150, FLOOR - 10, SEED)

    run(sim, 60)

    // It stopped on top of the bed: the moss it sprouted into is the cell
    // above the mud, and all three cells of soil are still there.
    expect(sim.speciesAt(150, FLOOR - 4)).toBe(MOSS)
    for (let i = 1; i <= 3; i++) expect(sim.speciesAt(150, FLOOR - i)).toBe(MUD)
    expect(count(sim, SEED)).toBe(0)
  })

  it('grows upward first: the first vine a submerged plant makes is above it', () => {
    const sim = new Sim({ seed: 1 })
    pool(sim, 140, 160, 10)
    sim.paint(150, FLOOR - 1, MOSS)

    // Tick until it grows at all, rather than for a fixed budget: what is
    // pinned is *where* the first vine lands, not how long it took.
    let ticks = 0
    while (count(sim, VINE) === 0 && ticks < 4000) {
      sim.tick()
      ticks++
    }

    expect(count(sim, VINE)).toBe(1)
    expect(sim.speciesAt(150, FLOOR - 2)).toBe(VINE)
  })

  it('pays for every cell of growth with a cell of water', () => {
    const sim = new Sim({ seed: 1 })
    pool(sim, 140, 160, 10)
    sim.paint(150, FLOOR - 1, MOSS)
    const waterBefore = count(sim, WATER)

    run(sim, 600)

    const grown = count(sim, VINE)
    expect(grown).toBeGreaterThan(0)
    // One for one: growth converts water, it does not conjure vine out of air.
    expect(waterBefore - count(sim, WATER)).toBe(grown)
  })

  /**
   * The brake the hook actually has, which is **not** a bound on total growth.
   * `set` clears the target's scratch bytes, so every newly grown vine starts
   * on a fresh `BRANCH_BUDGET` — a sealed pool does go entirely to vine, in
   * about 600 ticks, and bounding the total needs an engine affordance the
   * hook does not have (spec §5, "Two engine gaps"; open for Ed).
   *
   * What the budget does buy is a per-cell rate limit, so that is what is
   * pinned here: one branch per plant cell per tick, and no cell branching
   * more than `BRANCH_BUDGET` times in its life. Both are read off the world
   * rather than off the hook — the second one straight off the raw `ra` bytes,
   * since `ra` is the counter and nothing else in this world claims it.
   */
  it('branches at most once per plant cell per tick, and never past BRANCH_BUDGET', () => {
    const sim = new Sim({ seed: 1 })
    pool(sim, 140, 160, 10)
    sim.paint(150, FLOOR - 1, VINE)

    let ticksThatGrew = 0
    for (let t = 0; t < 600; t++) {
      const plantsBefore = countIn(sim, POOL, VINE) + countIn(sim, POOL, MOSS)
      const vineBefore = countIn(sim, POOL, VINE)
      sim.tick()
      const grew = countIn(sim, POOL, VINE) - vineBefore
      // One draw a tick per plant cell, so a tick can never add more vine than
      // there were plants to grow it. A hook that fell through to the sides on
      // a failed draw, or looped instead of returning, would break this.
      expect(grew).toBeLessThanOrEqual(plantsBefore)
      if (grew > 0) ticksThatGrew++
    }

    // Not a tautology: the world really did grow, over many ticks.
    expect(ticksThatGrew).toBeGreaterThan(10)
    expect(count(sim, VINE)).toBeGreaterThan(1)

    let spent = 0
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const species = sim.speciesAt(x, y)
        if (species !== VINE && species !== MOSS) continue
        const branches = raAt(sim, x, y)
        expect(branches).toBeLessThanOrEqual(BRANCH_BUDGET)
        if (branches === BRANCH_BUDGET) spent++
      }
    }
    // And the counter is really in use: cells did run their budget out.
    expect(spent).toBeGreaterThan(0)
  })

  /**
   * The bound, and the reason `MAX_PLANT_NEIGHBOURS` exists (ADR 0035). Every
   * new cell attaches to exactly one existing plant cell, so the plant is an
   * induced forest: no cycle closes and no two strands run alongside each
   * other. A pool therefore *cannot* go entirely to vine — it fills with
   * separated strands and keeps the water between them.
   *
   * Measured over seeds 1–12, and it saturates rather than creeping on: vine
   * settles at 110–123 of the 210 cells of water, so 86–99 cells survive. The
   * thresholds sit well outside that, since what is pinned is that the bound
   * exists, not the arithmetic of one pool.
   */
  it('cannot convert a sealed pool: water survives however long it grows', () => {
    const sim = new Sim({ seed: 1 })
    pool(sim, 140, 160, 10)
    const waterBefore = count(sim, WATER)
    sim.paint(150, FLOOR - 1, MOSS)

    run(sim, 4000)

    // It really did fill out — this is not a plant that failed to start.
    expect(count(sim, VINE)).toBeGreaterThan(50)
    // And it stopped well short of the pool. Before the crowding rule this
    // number was zero.
    expect(count(sim, WATER)).toBeGreaterThan(waterBefore / 4)
  })

  it('saturates rather than creeping on, so the pool reaches a resting state', () => {
    const sim = new Sim({ seed: 1 })
    pool(sim, 140, 160, 10)
    sim.paint(150, FLOOR - 1, MOSS)

    run(sim, 2000)
    const settled = count(sim, VINE)
    run(sim, 2000)

    // Every candidate is crowded or dry, so nothing is left to draw for.
    expect(count(sim, VINE)).toBe(settled)
  })

  /**
   * The structural half of the same rule, and the one that does not depend on
   * how the draws fell: place three corners of a 2×2 and the fourth touches two
   * plants for good, so it is refused for the rest of the run. Checked every
   * tick rather than at the end, since a block that formed and was then burnt
   * away would still be a broken invariant.
   */
  it('never forms a 2×2 block of plant, on any tick', () => {
    const sim = new Sim({ seed: 1 })
    pool(sim, 140, 160, 10)
    sim.paint(150, FLOOR - 1, MOSS)

    for (let t = 0; t < 600; t++) {
      sim.tick()
      expect(blocksIn(sim, POOL)).toBe(0)
    }

    // Not vacuous: there was a substantial plant there to find a block in.
    expect(count(sim, VINE)).toBeGreaterThan(20)
  })

  it('grows nothing at all with no water to spend', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 200, 8)
    sim.paint(200, FLOOR - 1, MOSS)

    run(sim, 600)

    expect(count(sim, VINE)).toBe(0)
    expect(sim.speciesAt(200, FLOOR - 1)).toBe(MOSS)
  })

  it('is dissolved by acid and burnt by fire through the rows stages 01–02 already wrote', () => {
    for (const plant of [SEED, MOSS, VINE]) {
      // Hardness 0 plus `solid`/`powder` is the whole of it — no `[corrodible]`
      // tag, and no row naming any of the three.
      expect(registry.get(plant)?.hardness).toBe(0)
      expect(registry.reactionFor(ACID, plant)).toMatchObject({
        aBecomes: EMPTY,
        bBecomes: EMPTY,
      })
      // `flammable` puts all three under `fire + [flammable]`.
      expect(registry.has(plant, 'flammable')).toBe(true)
      expect(registry.reactionFor(FIRE, plant)).toMatchObject({
        aBecomes: FIRE,
        bBecomes: FIRE,
      })
    }
  })

  it('burns and dissolves in a real world, not just in the table', () => {
    for (const plant of [SEED, MOSS, VINE]) {
      // Fire is a rate, so this needs enough draws to be certain rather than
      // lucky: four ticks leaves the plant standing on roughly one seed in
      // fifty. Fire carries a lifetime, so it writes every tick and its chunk
      // stays awake for as long as it burns — ticks are all this side needs.
      const burning = new Sim({ seed: 1 })
      sealedPair(burning, 100, plant, FIRE)
      run(burning, 30)
      expect(burning.speciesAt(100, FLOOR - 1)).not.toBe(plant)

      // Acid cannot be fixed with ticks the same way. Rows 6–7 are p 0.3 and
      // acid has no lifetime, so a sealed pair that fails its first draws
      // settles, its chunk sleeps, and the pair is never offered the reaction
      // again — it stays undissolved for any number of ticks. So this side
      // uses `acid.test.ts`' idiom instead: pour acid over a bed of the
      // target, where the outcome is set by how much acid there is rather
      // than by the draws. Every acid cell that lands takes a cell of plant
      // with it, so 44 cells of acid clear all but ~20 of the 63-cell bed.
      // Over 100 seeds the survivors were 19–24 and the unspent acid 0–5; the
      // thresholds sit well outside both, since what is being pinned is that
      // acid eats plants at all, not the exact arithmetic of one bath.
      const dissolving = new Sim({ seed: 1 })
      const bed = bath(dissolving, plant)
      run(dissolving, 120)
      expect(count(dissolving, plant)).toBeLessThan(bed - 30)
      // Spent, not merely stalled: the acid was consumed doing it.
      expect(count(dissolving, ACID)).toBeLessThan(10)
    }
  })
})
