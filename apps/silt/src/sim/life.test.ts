import { describe, expect, it } from 'vitest'

import {
  ACID,
  ASH,
  BURIED,
  DIRT,
  EMPTY,
  FIRE,
  FLOWER,
  MOSS,
  MUD,
  OBSIDIAN,
  PETAL,
  SEED,
  SPROUT,
  STALK,
  STEAM,
  SULPHUR,
  TIP,
  VINE,
  WATER,
  v1Elements,
  v1Reactions,
} from './elements.ts'
import { BRANCH_BUDGET } from './growth.ts'
import { SOAK_TO_DROWN } from './seedBank.ts'
import { STALK_HEIGHT_JITTER, STALK_HEIGHT_MIN } from './stalk.ts'
import { BYTES_PER_CELL, GRID_HEIGHT, GRID_WIDTH, RA_OFFSET, VARIANT_SLOTS } from './constants.ts'
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

/** The bounding box of `pool(sim, 140, 160, 10)`, walls included. Counting a
 * window rather than the whole grid keeps a per-tick assertion affordable. */
const POOL = { x0: 139, x1: 161, y0: FLOOR - 12, y1: FLOOR } as const

/**
 * An inclusive cell window. The ledger cases sample every tick, and a per-tick
 * pass over 60,000 cells is not affordable, so each one counts a box its scene
 * cannot leave.
 */
interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
}

function countIn(sim: Sim, box: Box, species: number): number {
  let total = 0
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      if (sim.speciesAt(x, y) === species) total++
    }
  }
  return total
}

/**
 * Film cells inside `box`, by the hook's own two structural gates: open air
 * above, and something that is neither water nor air below (`evaporation.ts`).
 * Exactly the cells that are offered a draw, and so the ceiling on how far the
 * ledger can fall in one tick now that a film dries out of the world rather than
 * lofting (ADR 0044 §6).
 */
function filmsIn(sim: Sim, box: Box): number {
  let total = 0
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      if (sim.speciesAt(x, y) !== WATER) continue
      if (sim.speciesAt(x, y - 1) !== EMPTY) continue
      const below = sim.speciesAt(x, y + 1)
      if (below === WATER || below === EMPTY) continue
      total++
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

  it('declares its row last, after the tag rows stage 02 registered', () => {
    expect(v1Reactions.map((row) => [row.a, row.b])).toEqual([
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
      ['acid', 'moss'],
      ['acid', 'vine'],
      ['acid', 'seed'],
      ['acid', 'sprout'],
      ['acid', 'stalk'],
      ['acid', 'tip'],
      ['acid', 'flower'],
      ['acid', 'petal'],
      ['acid', 'solid'],
      ['acid', 'powder'],
      ['acid', 'lava'],
      ['water', 'dirt'],
      ['water', 'ash'],
      ['mud', 'fire'],
      ['mud', 'lava'],
      ['seed', 'mud'],
      ['petal', 'mud'],
      ['petal', 'water'],
    ])
  })

  /**
   * **Burial replaced instant germination** (life spec §4.1). The old row here
   * was `seed + mud -> moss` at p 1, and it could not survive alongside burial:
   * one reaction row per pair, and `p` is a rate rather than a split. So this
   * case now pins the trade the burial row makes, and germination has moved to
   * the bank's hook below.
   */
  it('buries a seed into the soil it meets, and germinates nothing on the spot', () => {
    const sim = new Sim({ seed: 1 })
    sealedPair(sim, 100, SEED, MUD)

    // p 0.1 a contact tick, so this needs draws rather than one: the pair is
    // sealed, and mud writes every tick it oozes, so the chunk stays awake.
    run(sim, 200)

    // One cell of soil in, one cell of bank out, and the seed spent. Which cell
    // holds it is not pinnable - mud is a liquid and denser than seed (50 to
    // 40), so it may displace the grain sideways before reactions run.
    expect(count(sim, BURIED)).toBe(1)
    expect(count(sim, MUD)).toBe(0)
    expect(count(sim, SEED)).toBe(0)
    // Nothing germinated: the sky above the pair is sealed obsidian, so the
    // bank is dormant and stays that way for as long as the lid is on.
    expect(count(sim, MOSS)).toBe(0)
  })

  /**
   * The aquatic half of the biome commitment (spec §4.2), end to end in a real
   * world: a seed sinks through a pool, rests *on* the bed, banks into it, and
   * commits aquatic only after `SOAK_TO_DROWN` ticks under `SOAK_DEPTH` cells of
   * standing water. The shaft is water all the way up, so depth is never the
   * thing being waited for here - the soak is.
   */
  it('sinks a seed through water, banks it in the bed, and drowns it into moss', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 150, 12)
    for (let i = 1; i <= 3; i++) sim.paint(150, FLOOR - i, MUD)
    for (let i = 4; i <= 9; i++) sim.paint(150, FLOOR - i, WATER)
    sim.paint(150, FLOOR - 10, SEED)

    // Long enough for the grain to fall (measured at ~10 ticks), the burial draw
    // to come up (p 0.1), the soak window to fill (120) and the germination draw
    // to land (~800 ticks on average). A horizon, not a bound.
    let ticks = 0
    while (count(sim, MOSS) === 0 && ticks < 8000) {
      sim.tick()
      ticks++
      // Whatever else happens, the seed never germinated instantly: the soak
      // window alone is 120 ticks, and the burial has to precede it.
      if (ticks < SOAK_TO_DROWN) expect(count(sim, MOSS)).toBe(0)
    }

    // It banked in the top cell of the bed - the seed rested *on* the soil, so
    // the soil cell it touched is the one that became the bank - and the moss it
    // germinated into is the water cell above that.
    expect(count(sim, MOSS)).toBe(1)
    expect(sim.speciesAt(150, FLOOR - 4)).toBe(MOSS)
    // And the soil is refunded as dirt, not mud: the plant drank the moisture
    // (ruling 2). The two cells below it never took part.
    expect(sim.speciesAt(150, FLOOR - 3)).toBe(DIRT)
    for (let i = 1; i <= 2; i++) expect(sim.speciesAt(150, FLOOR - i)).toBe(MUD)
    expect(count(sim, SEED)).toBe(0)
    expect(count(sim, BURIED)).toBe(0)
  })

  /**
   * The other direction, and the reason the aquatic test is depth **and** soak
   * (spec §4.2): a droplet is not a pond. One cell of water resting on the bank
   * soaks it for as long as you like and commits nothing, because the cell above
   * *that* is air. Depth alone was faked by two droplets landing in one column,
   * so the rule needs both - and this is the half a one-shot look-above failed.
   */
  it('never commits aquatic under a single droplet, however long it rests', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 150, 12)
    for (let i = 1; i <= 3; i++) sim.paint(150, FLOOR - i, MUD)
    sim.paint(150, FLOOR - 3, BURIED)
    sim.paint(150, FLOOR - 4, WATER)
    // **Lidded since life ticket 05.** A droplet resting on the bank is a film -
    // air above, something other than water below - so it now lifts as steam in
    // about 130 ticks, and this case would be measuring evaporation rather than
    // the soak. The lid keeps it about the soak; `the water cycle` below is
    // where the same droplet is left open to the sky on purpose.
    sim.paint(150, FLOOR - 5, OBSIDIAN)

    // Twenty times the soak window. Mud oozes and water settles, so the chunk
    // is awake for plenty of it; the bank writes its own soak in any case.
    run(sim, SOAK_TO_DROWN * 20)

    expect(count(sim, MOSS)).toBe(0)
    expect(count(sim, VINE)).toBe(0)
    // Still banked, still waiting, and still under its droplet.
    expect(sim.speciesAt(150, FLOOR - 3)).toBe(BURIED)
    expect(sim.speciesAt(150, FLOOR - 4)).toBe(WATER)
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
    // **Two routes out since life ticket 05, and only two**: growth eats into
    // the pool from below, so cells of it end up one deep over a vine and dry as
    // film (`evaporation.ts`). Growth is the one-for-one; the drying is the
    // deliberate leak (ADR 0045 §4), so what is pinned is that the remainder is
    // the drying and nothing else has a hand in it.
    //
    // Measured at seed 1: 112 cells of the 209-cell pool became vine and 8 dried
    // off the top of it. Before the deletion ruling this line read `.toBe(grown)`
    // with steam in the sum, because those 8 came back.
    const spent = waterBefore - count(sim, WATER) - count(sim, STEAM)
    expect(spent - grown).toBe(8)
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
    // Swept, not pinned to the committed seed — the ADR quotes a range measured
    // across seeds, so the test has to cover a range too or the number in the
    // ADR is unbacked. Every seed here is a fresh world, not a fresh draw.
    for (let seed = 1; seed <= 12; seed++) {
      const sim = new Sim({ seed })
      pool(sim, 140, 160, 10)
      const waterBefore = count(sim, WATER)
      sim.paint(150, FLOOR - 1, MOSS)

      run(sim, 4000)

      // It really did fill out — this is not a plant that failed to start.
      expect(count(sim, VINE)).toBeGreaterThan(50)
      // And it stopped well short of the pool. Before the crowding rule this
      // number was zero, on every seed.
      expect(count(sim, WATER)).toBeGreaterThan(waterBefore / 4)
    }
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
   *
   * **This binds what grew, not the world.** Sprouting is a reaction row with
   * no crowding gate, so a 2×2 of seed wedged in mud does make a 2×2 of moss.
   * Hence one moss here and everything else grown from it (ADR 0035).
   */
  it('never grows a 2×2 block of plant, on any tick', () => {
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

  it('is dissolved to sulphur by acid and burnt by fire', () => {
    for (const plant of [SEED, MOSS, VINE]) {
      // Hardness 0 plus `solid`/`powder` is what puts a plant in acid's reach at
      // all. What it *leaves* is a row of its own now (discovery ticket 15):
      // living tissue is wood's case, so the spent acid leaves a grain of
      // sulphur where a bare tag row would have dug an empty cavity.
      expect(registry.get(plant)?.hardness).toBe(0)
      expect(registry.reactionFor(ACID, plant)).toMatchObject({
        aBecomes: SULPHUR,
        bBecomes: EMPTY,
      })
      // All three are `flammable`, and all three now have their own rung on the
      // ignition ladder as well. The rates are `fire.test.ts`'s to pin; what
      // matters here is that a plant burns at all.
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

      // Acid cannot be fixed with ticks the same way. The acid rows are p 0.3
      // and acid has no lifetime, so a sealed pair that fails its first draws
      // settles, its chunk sleeps, and the pair is never offered the reaction
      // again — it stays undissolved for any number of ticks. So this side
      // uses `acid.test.ts`' idiom instead: pour acid over a bed of the
      // target, where the outcome is set by how much acid there is rather
      // than by the draws.
      //
      // Counted rather than thresholded, and the reason is discovery ticket 15:
      // the residue **backfills the cavity**, and acid cannot eat sulphur
      // (hardness 2 against `maxHardness: 1`), so a bath now armours the bed it
      // is eating instead of clearing it. Measured over 30 seeds, the 63-cell
      // bed keeps 31–41 cells of moss or vine with 12–22 cells of acid stalled
      // on top of its own brimstone - where the old cavity-digging row cleared
      // all but ~20 and spent nearly every drop. A powder bed still clears
      // (seed: 19–21 survivors), because the grains shift and the acid follows.
      // So what is pinned here is wood's shape, which this now is: cells were
      // eaten, every dissolve cost exactly one cell of acid, and one grain of
      // sulphur came back.
      const dissolving = new Sim({ seed: 1 })
      const bed = bath(dissolving, plant)
      const acidBefore = count(dissolving, ACID)
      run(dissolving, 120)
      const eaten = bed - count(dissolving, plant)
      expect(eaten).toBeGreaterThan(0)
      expect(acidBefore - count(dissolving, ACID)).toBe(eaten)
      expect(count(dissolving, SULPHUR)).toBe(eaten)
    }
  })
})

/** A bed of mud on an obsidian floor, with the sky left open over it. */
function bed(sim: Sim, left: number, right: number): void {
  for (let x = left - 1; x <= right + 1; x++) sim.paint(x, FLOOR, OBSIDIAN)
  for (let i = 1; i <= 4; i++) {
    sim.paint(left - 1, FLOOR - i, OBSIDIAN)
    sim.paint(right + 1, FLOOR - i, OBSIDIAN)
  }
  for (let x = left; x <= right; x++) sim.paint(x, FLOOR - 1, MUD)
}

describe('the seed bank', () => {
  it('boots with its id pinned, static, fireproof and free of any lifetime', () => {
    expect(BURIED).toBe(20)
    // Static, so the mud it displaced cannot wash it out of the bed.
    expect(registry.get(BURIED)?.archetype).toEqual({ kind: 'static' })
    expect(registry.has(BURIED, 'solid')).toBe(true)
    // **Not flammable, and no ignition row of its own** - that is the whole job
    // of the bank. The `fire + [flammable]` fallback keys on the tag, so leaving
    // it off is what keeps fire out rather than a rule saying so.
    expect(registry.has(BURIED, 'flammable')).toBe(false)
    expect(registry.reactionFor(FIRE, BURIED)).toBeUndefined()
    // **No lifetime**: `ra` is the soak counter, so the byte must stay free
    // (ADR 0043). Giving it one would hand the byte back to the engine.
    expect(registry.lifetimeOf(BURIED)).toBeUndefined()
  })

  it('registers burial as a rate that spends the seed and takes the soil cell', () => {
    expect(registry.reactionFor(SEED, MUD)).toEqual({
      p: 0.1,
      aBecomes: EMPTY,
      bBecomes: BURIED,
    })
    // Symmetric, as every row is: reached from the mud side, the mud is still
    // the cell that becomes the bank.
    expect(registry.reactionFor(MUD, SEED)).toEqual({
      p: 0.1,
      aBecomes: BURIED,
      bBecomes: EMPTY,
    })
  })

  /**
   * The bank's reason to exist (spec §4.1). Fire clears everything standing on a
   * bed and dries its surface, and the seeds under it come through untouched -
   * which is what turns recovery from a total burn into one generation.
   *
   * **The ledger, not the count** (life ticket 03). Fire clearing the bed is
   * also fire *opening the sky*, so a seed the flames could not touch may
   * germinate into the burn a moment later - which is the regrowth half of the
   * same design (spec §4.5), not a loss. Every land plant has exactly one
   * growing or terminal end at a time (a sprout, then a tip, then a flower), so
   * counting those alongside the bank is what says "no seed was lost" while
   * letting the bed come back.
   */
  it('survives a fire swept over the bed, seed for seed', () => {
    const sim = new Sim({ seed: 1 })
    bed(sim, 40, 60)
    for (const x of [42, 46, 50, 54, 58]) sim.paint(x, FLOOR - 1, BURIED)
    const banked = count(sim, BURIED)
    for (let x = 40; x <= 60; x++) sim.paint(x, FLOOR - 2, FIRE)

    // Short of the flower's 600-tick life, so nothing has had time to leave the
    // ledger by withering.
    run(sim, 300)

    // Not one lost: every seed is either still banked or standing in the burn.
    const crowns = count(sim, SPROUT) + count(sim, TIP) + count(sim, FLOWER)
    expect(count(sim, BURIED) + crowns).toBe(banked)
    // Nothing committed aquatic: there is no standing water over a burnt bed.
    expect(count(sim, MOSS)).toBe(0)
    // Not vacuous: the fire really did act on the bed it swept, drying the
    // surface mud it touched to dirt (`mud + fire`).
    expect(count(sim, DIRT)).toBeGreaterThan(0)
  })

  /**
   * The self-cap, which is structural rather than a rule (spec §4.1): burial
   * costs a cell of soil and germination gives one back as dirt, so
   * **bank + mud + dirt is constant** for a closed bed however long it runs.
   * Nothing anywhere counts the bank or limits it.
   *
   * Sampled every tick rather than at the end, since a ledger that dipped and
   * recovered would still be a leak. Water is not in the ledger - a germination
   * drinks a cell of it, and `water + dirt` spends another wetting the refund
   * back to mud, which is the point of ruling 2.
   */
  it('caps its own bank: bank + mud + dirt never moves for a closed bed', () => {
    const sim = new Sim({ seed: 1 })
    pool(sim, 140, 160, 10)
    for (let x = 140; x <= 160; x++) {
      sim.paint(x, FLOOR - 1, MUD)
      sim.paint(x, FLOOR - 2, MUD)
    }
    for (const x of [142, 146, 150, 154, 158]) sim.paint(x, FLOOR - 9, SEED)

    // Counted over the pool's window rather than the grid, as the growth cases
    // do: a per-tick assertion over 60,000 cells is not affordable, and the bed
    // cannot leave the tank.
    const ledger = (): number =>
      countIn(sim, POOL, BURIED) + countIn(sim, POOL, MUD) + countIn(sim, POOL, DIRT)
    const opening = ledger()
    let peak = 0

    for (let t = 0; t < 6000; t++) {
      sim.tick()
      expect(ledger()).toBe(opening)
      peak = Math.max(peak, count(sim, BURIED))
    }

    // Not vacuous at either end: seeds really banked, and the bank really spent
    // itself germinating rather than sitting there.
    expect(peak).toBeGreaterThan(0)
    expect(count(sim, MOSS)).toBeGreaterThan(0)
    expect(count(sim, BURIED)).toBeLessThan(peak)
  })
})

/**
 * The land plant (life spec §4.3), four species deep because one byte cannot
 * both grow and expire (ADR 0043). The hooks themselves are pinned against a
 * stub in `stalk.test.ts`; what these cases are for is the plant in a world that
 * is also falling, burning and drying.
 */
describe('the land plant', () => {
  it('boots with its four ids pinned and the byte split down the middle', () => {
    expect([SPROUT, TIP, STALK, FLOWER]).toEqual([21, 22, 23, 24])

    for (const part of [SPROUT, TIP, STALK, FLOWER]) {
      // Static: a plant is structure, and nothing in the roster displaces it.
      expect(registry.get(part)?.archetype).toEqual({ kind: 'static' })
      // Corrodible and burnable, and hardness 0 is what puts each of the four in
      // acid's reach. Since discovery ticket 15 each is *named* by an acid row
      // as well, so the dissolve leaves sulphur rather than an empty cavity -
      // the whole living roster is wood's case now.
      expect(registry.get(part)?.hardness).toBe(0)
      expect(registry.reactionFor(ACID, part)).toMatchObject({
        aBecomes: SULPHUR,
        bBecomes: EMPTY,
      })
      expect(registry.has(part, 'flammable')).toBe(true)
    }

    // **Dry parts burn, wet parts steam** (life spec §4.5, ticket 05). The stem
    // and the travelling tip are the plant's dry tissue and stay on the ignition
    // ladder, which is what carries a fire up a meadow at all; the sprout and
    // the flower are mostly water, so what leaves them is the water. The engine
    // cannot split one row by probability, so the split is per species.
    for (const dry of [TIP, STALK]) {
      expect(registry.reactionFor(FIRE, dry)).toMatchObject({ aBecomes: FIRE, bBecomes: FIRE })
    }
    for (const wet of [SPROUT, FLOWER]) {
      expect(registry.reactionFor(FIRE, wet)).toMatchObject({ aBecomes: FIRE, bBecomes: STEAM })
    }

    // **The growers own `ra`, so neither may ever be given a lifetime** - doing
    // so hands the byte back to the engine and the tip would climb on a
    // countdown (ADR 0043). The trap is this assertion rather than a surprise.
    expect(registry.lifetimeOf(SPROUT)).toBeUndefined()
    expect(registry.lifetimeOf(TIP)).toBeUndefined()

    // And the products expire, coarsely: 2720-3200 ticks of stem and 1200-2400
    // of flower are both far past `MAX_LIFETIME_TICKS`, so `every` is what makes
    // them fit the byte at all (life ticket 01).
    //
    // **The stem's minimum has to clear the flower's maximum**, and that is the
    // half of ticket 06's density tuning that is not about density: the flower's
    // life is what buys standing crowns per cell of the bed's water, and a stem
    // that crumbled under a living flower would leave it hanging in the air.
    expect(registry.lifetimeOf(STALK)).toEqual({
      ticks: 170,
      jitter: 30,
      every: 16,
      becomes: EMPTY,
    })
    expect(170 * 16).toBeGreaterThan((75 + 75) * 16)
    // The flower's is also the death drop (life ticket 04): the seed is what is
    // left in its own cell, the petals are what is thrown clear of it.
    expect(registry.lifetimeOf(FLOWER)).toEqual({
      ticks: 75,
      jitter: 75,
      every: 16,
      becomes: SEED,
      emits: { species: PETAL, min: 3, max: 4 },
    })
    // Eight pastels, one per variant slot: `rb & 7` and nothing else (ADR 0040).
    expect(registry.get(FLOWER)?.colours).toHaveLength(VARIANT_SLOTS)
  })

  /**
   * The land half of the biome commitment (spec §4.2), end to end: a seed banked
   * in a bed with the sky open germinates into a sprout, the sprout raises a tip
   * with its budget already in it, and the soil it drank is left as dirt.
   */
  it('germinates on land and raises a tip carrying a jittered budget', () => {
    const sim = new Sim({ seed: 1 })
    bed(sim, 40, 60)
    sim.paint(50, FLOOR - 1, BURIED)

    // Germination is ~800 ticks on average under open sky, so this is a horizon
    // rather than a bound - as the aquatic case does it.
    let ticks = 0
    while (count(sim, TIP) === 0 && ticks < 8000) {
      sim.tick()
      ticks++
    }

    // The column so far: soil drunk to dirt, the ex-sprout as the bottom of the
    // stem, and the tip one cell up with the budget the sprout prepaid it.
    expect(sim.speciesAt(50, FLOOR - 1)).toBe(DIRT)
    expect(sim.speciesAt(50, FLOOR - 2)).toBe(STALK)
    expect(sim.speciesAt(50, FLOOR - 3)).toBe(TIP)
    // `ra` is height + 1, read straight off the byte the tip owns.
    expect(raAt(sim, 50, FLOOR - 3)).toBeGreaterThanOrEqual(STALK_HEIGHT_MIN + 1)
    expect(raAt(sim, 50, FLOOR - 3)).toBeLessThanOrEqual(STALK_HEIGHT_MIN + STALK_HEIGHT_JITTER + 1)
    // Land, not water: a dry bed can never commit aquatic, however long it runs.
    expect(count(sim, MOSS)).toBe(0)
  })

  /**
   * **The stem crumbles**, and it is the most important line in the ticket: a
   * meadow whose dead columns are immortal silts up until nothing can germinate
   * (the prototype's single most important finding).
   */
  it('crumbles a stem to nothing, on a countdown far longer than the byte holds', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 200, 12)
    for (let i = 1; i <= 8; i++) sim.paint(200, FLOOR - i, STALK)
    const standing = count(sim, STALK)

    // Well inside the shortest life (16 × 170 = 2720 ticks): a stem that decayed
    // at the flat rate would have been gone ten times over by here.
    run(sim, 2600)
    expect(count(sim, STALK)).toBe(standing)

    // And past the longest (16 × 200, plus up to `every` ticks of phase).
    run(sim, 700)
    expect(count(sim, STALK)).toBe(0)
    // To nothing: a stem leaves no husk behind.
    expect(sim.speciesAt(200, FLOOR - 1)).toBe(EMPTY)
  })

  it('withers its flowers over a spread, not all in one frame', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 200, 12)
    for (let i = 1; i <= 8; i++) sim.paint(200, FLOOR - i, FLOWER)
    const blooming = count(sim, FLOWER)

    // Inside 16 × 75 = 1200 ticks, so not one has had its last draw.
    run(sim, 1100)
    expect(count(sim, FLOWER)).toBe(blooming)

    // The jitter is coarse too, so the cohort dies over a window rather than
    // together - which is what stops a painted meadow vanishing in one frame,
    // and the whole reason a scene can paint a bank of flowers at all: `ra` is
    // the countdown here, so `paint` cannot pre-age one (`the stranded seed`
    // below), and the jitter is the only spread there is.
    run(sim, 900)
    const half = count(sim, FLOWER)
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(blooming)

    // Past 16 × 150 plus the phase.
    run(sim, 500)
    expect(count(sim, FLOWER)).toBe(0)
  })

  /**
   * **Land plants are splash-immune** (spec §4.2). The biome was decided once,
   * at germination, and nothing here has a rule that consumes water - so a
   * droplet against a plant is just a droplet, in either direction.
   */
  it('is inert against water, plant for plant', () => {
    for (const part of [SPROUT, STALK, FLOWER]) {
      const sim = new Sim({ seed: 1 })
      sealedPair(sim, 100, part, WATER)

      run(sim, 200)

      expect(sim.speciesAt(100, FLOOR - 1)).toBe(part)
      expect(sim.speciesAt(101, FLOOR - 1)).toBe(WATER)
    }
  })

  /**
   * The other half of the same rule, and the one a sprout could get wrong: it
   * grows into *empty air* and nothing else. Before the commitment moved into
   * the seed bank, water against a plant was eaten and turned to vine.
   */
  it('never raises a stalk into water, however long the water stands there', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 200, 12)
    sim.paint(200, FLOOR - 1, SPROUT)
    for (let i = 2; i <= 6; i++) sim.paint(200, FLOOR - i, WATER)
    const flooded = count(sim, WATER)

    run(sim, 600)

    expect(count(sim, TIP)).toBe(0)
    expect(count(sim, STALK)).toBe(0)
    // Still a sprout, and still under the same water: neither side spent a cell.
    expect(sim.speciesAt(200, FLOOR - 1)).toBe(SPROUT)
    expect(count(sim, WATER)).toBe(flooded)
  })

  /**
   * The keep-awake half of the sprout's design, and why it draws no probability
   * (`stalk.ts`): a sprout that cannot rise writes nothing at all, so the bed
   * under it sleeps. A failed draw would have needed a write to hold the chunk
   * awake, and that write is the one spec §8 says to stop and promote a real
   * `keepAwake` for.
   */
  it('lets its chunk sleep while it is roofed, rather than spinning on a draw', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 200, 12)
    sim.paint(200, FLOOR - 1, SPROUT)
    sim.paint(200, FLOOR - 2, WATER)
    // **Lidded since life ticket 05**, as the droplet case above: an open
    // droplet is a film and lifts, and the sprout under it would then rise. The
    // lid also puts the evaporation hook's own dormancy in this case - a roofed
    // film declines without a keep-awake, so all three cells here are silent.
    sim.paint(200, FLOOR - 3, OBSIDIAN)

    run(sim, 400)

    // Nothing in the shaft is writing any more - the droplet settled and the
    // sprout is silent under it.
    expect(sim.scannedLastTick).toBe(0)
    expect(sim.speciesAt(200, FLOOR - 1)).toBe(SPROUT)
  })
})

/** Where the one tip in column `x` is, or `undefined` once it has bloomed. */
function tipYIn(sim: Sim, x: number): number | undefined {
  for (let y = 0; y < GRID_HEIGHT; y++) {
    if (sim.speciesAt(x, y) === TIP) return y
  }
  return undefined
}

/**
 * The travelling budget in a real world (spec §4.3) - the half of ticket 03
 * that needed an engine change to be possible at all (`set` carrying an `ra`,
 * life ticket 01).
 */
describe('the stalk tip', () => {
  it('climbs into a column of stem and blooms at the top of it', () => {
    const sim = new Sim({ seed: 1 })
    bed(sim, 40, 60)
    sim.paint(50, FLOOR - 2, SPROUT)

    let ticks = 0
    while (count(sim, FLOWER) === 0 && ticks < 400) {
      sim.tick()
      ticks++
    }

    // One flower, and a contiguous stem under it from the cell the sprout stood
    // in - the plant is a column, not a scattering.
    expect(count(sim, FLOWER)).toBe(1)
    const stems = count(sim, STALK)
    for (let i = 0; i < stems; i++) expect(sim.speciesAt(50, FLOOR - 2 - i)).toBe(STALK)
    expect(sim.speciesAt(50, FLOOR - 2 - stems)).toBe(FLOWER)
    expect(count(sim, TIP)).toBe(0)

    // The pace the prototype settled on: 6-10 cells in roughly 20-35 ticks at
    // p 0.3. A horizon rather than an assertion about the draws.
    expect(ticks).toBeLessThan(200)
  })

  /**
   * **Heights vary because the budget does** (spec §4.3), which is what stops a
   * meadow reading as a fence. Swept over seeds rather than pinned to one, since
   * the claim is about the spread and not about where seed 1 landed.
   */
  it('grows a stalk 6 to 10 cells tall, and not always the same one', () => {
    const heights = new Set<number>()

    for (let seed = 1; seed <= 12; seed++) {
      const sim = new Sim({ seed })
      bed(sim, 40, 60)
      sim.paint(50, FLOOR - 2, SPROUT)

      let ticks = 0
      while (count(sim, FLOWER) === 0 && ticks < 400) {
        sim.tick()
        ticks++
      }

      const stems = count(sim, STALK)
      // The stem includes the cell the sprout was spent on, so a budget of
      // `height + 1` leaves exactly `height + 1` cells of it.
      expect(stems).toBeGreaterThanOrEqual(STALK_HEIGHT_MIN + 1)
      expect(stems).toBeLessThanOrEqual(STALK_HEIGHT_MIN + STALK_HEIGHT_JITTER + 1)
      heights.add(stems)
    }

    expect(heights.size).toBeGreaterThan(1)
  })

  /**
   * The acceptance the engine change exists for: a mid-climb tip holds exactly
   * `initial - height climbed` in `ra`. Read off the byte rather than off the
   * pixels, and checked on **every** tick of the climb - a budget that was
   * re-seeded, re-jittered or left behind by one cell would break it somewhere.
   */
  it('holds exactly its initial budget less the height it has climbed', () => {
    const sim = new Sim({ seed: 1 })
    bed(sim, 40, 60)
    sim.paint(50, FLOOR - 2, SPROUT)

    let initial = 0
    let start = 0
    let climbed = 0

    for (let t = 0; t < 400 && count(sim, FLOWER) === 0; t++) {
      sim.tick()
      const y = tipYIn(sim, 50)
      if (y === undefined) continue
      const budget = raAt(sim, 50, y)
      if (initial === 0) {
        initial = budget
        start = y
      }
      climbed = start - y
      expect(budget).toBe(initial - climbed)
    }

    // Not vacuous: there was a real budget and it really travelled.
    expect(initial).toBeGreaterThan(1)
    expect(climbed).toBeGreaterThan(0)
    // And it was spent to the last unit: the budget counts height + 1, so the
    // final tip - the one that blooms - is the one holding 1.
    expect(climbed).toBe(initial - 1)
    // The flower stands in the cell that last tip bloomed in.
    expect(sim.speciesAt(50, start - climbed)).toBe(FLOWER)
  })

  /**
   * **Terminate, never spin.** A tip with nowhere left to climb blooms on the
   * spot rather than waiting for the roof to move - waiting would mean a cell
   * writing every tick for as long as it is trapped.
   */
  it('blooms early when it is boxed in, rather than holding its budget', () => {
    const sim = new Sim({ seed: 1 })
    shaftAt(sim, 200, 6)
    for (let i = -1; i <= 1; i++) sim.paint(200 + i, FLOOR - 3, OBSIDIAN)
    sim.paint(200, FLOOR - 1, SPROUT)

    run(sim, 200)

    // One cell of stem and a flower pressed against the lid: the plant stopped
    // where the box did, and nothing is still climbing.
    expect(sim.speciesAt(200, FLOOR - 1)).toBe(STALK)
    expect(sim.speciesAt(200, FLOOR - 2)).toBe(FLOWER)
    expect(count(sim, TIP)).toBe(0)
  })

  /**
   * The whole loop, in one world: bank -> sprout -> climbing tip -> stem ->
   * flower -> seed, and the cell the plant stood in handed on rather than
   * silted up. Before the death drop (life ticket 04) the last step was
   * "-> nothing" and this case ended with an empty bed; now the plant leaves
   * offspring, which is what makes the meadow a loop rather than a single run.
   */
  it('hands the bed on to a successor once the first plant is spent', () => {
    const sim = new Sim({ seed: 1 })
    bed(sim, 40, 60)
    sim.paint(50, FLOOR - 1, BURIED)

    let ticks = 0
    while (count(sim, FLOWER) === 0 && ticks < 8000) {
      sim.tick()
      ticks++
    }
    expect(count(sim, FLOWER)).toBe(1)
    // The soil the plant drank is dirt, and the bank cell went with it.
    expect(sim.speciesAt(50, FLOOR - 1)).toBe(DIRT)
    expect(count(sim, BURIED)).toBe(0)

    // Past both lifetimes: 3200 ticks of stem, 2400 of flower.
    run(sim, 3400)

    // The plant's own column is clear again - the stem crumbled, which is the
    // whole reason it has a lifetime, and the soil it drank is still dirt.
    expect(sim.speciesAt(50, FLOOR - 1)).toBe(DIRT)
    expect(sim.speciesAt(50, FLOOR - 2)).not.toBe(STALK)
    // And the generation it left behind is somewhere in the bed: a seed still
    // drifting, one banked in the soil, or a seedling already up.
    const heirs =
      count(sim, SEED) +
      count(sim, BURIED) +
      count(sim, SPROUT) +
      count(sim, TIP) +
      count(sim, FLOWER)
    expect(heirs).toBeGreaterThan(0)
  })
})

/** An obsidian floor with open air over it, and nothing on it that reacts. */
function shelf(sim: Sim, left: number, right: number): void {
  for (let x = left; x <= right; x++) sim.paint(x, FLOOR, OBSIDIAN)
}

/** The highest count of `species` seen over `ticks`, sampled every tick. */
function peakOver(sim: Sim, ticks: number, species: number): number {
  let peak = 0
  for (let t = 0; t < ticks; t++) {
    sim.tick()
    peak = Math.max(peak, count(sim, species))
  }
  return peak
}

/**
 * Petals (life spec §4.4) - the garnish that is also the offspring. Everything
 * about them is data: a slow, floating powder, a short lifetime, and two
 * reaction rows. The one piece of code is the flower's shedding hook, pinned
 * against a stub in `petals.test.ts`.
 */
describe('petals', () => {
  it('boots light enough to float, slow enough to drift, and out of the fire', () => {
    expect(PETAL).toBe(25)
    // `move` 0.25 is the powder throttle ticket 01 added for exactly this: sand's
    // kernel taken one tick in four, so it wanders down where a grain drops.
    expect(registry.get(PETAL)?.archetype).toEqual({
      kind: 'powder',
      density: 10,
      slide: 1,
      move: 0.25,
    })
    // The one lifetime in this epic that fits the byte flat - 80-150 ticks, so
    // `every` stays at the tick-by-tick default.
    expect(registry.lifetimeOf(PETAL)).toEqual({
      ticks: 80,
      jitter: 70,
      every: 1,
      becomes: EMPTY,
    })
    // **The flower's palette, and not a shade of it.** `rb` is reseeded on every
    // birth and no element may write it (ADR 0040), so a petal is drawn from the
    // same eight pastels afresh - statistically identical in a drift, and never
    // traceable back to the flower it fell from (spec §2.5).
    expect(registry.get(PETAL)?.colours).toEqual(registry.get(FLOWER)?.colours)
    expect(registry.get(PETAL)?.colours).toHaveLength(VARIANT_SLOTS)
    // **Not flammable**, and no ignition row of its own: fire riding a drift of
    // petals across the world is funny once and then ruins every meadow.
    expect(registry.has(PETAL, 'flammable')).toBe(false)
    expect(registry.reactionFor(FIRE, PETAL)).toBeUndefined()
    // Acid still reaches it - by its own row since discovery ticket 15, so a
    // dissolved petal leaves sulphur like every other piece of living tissue,
    // rather than the empty cavity the `[powder]` row used to dig.
    expect(registry.reactionFor(ACID, PETAL)).toMatchObject({
      aBecomes: SULPHUR,
      bBecomes: EMPTY,
    })

    // The lightest thing in the roster, which is the whole pond trick: a petal
    // displaces nothing and floats, and the seed it strikes into sinks past it.
    expect(canDisplace(registry, PETAL, WATER)).toBe(false)
    expect(canDisplace(registry, WATER, PETAL)).toBe(true)
    expect(canDisplace(registry, SEED, WATER)).toBe(true)
  })

  it('registers both strikes as rates, the pond one an order of magnitude below', () => {
    expect(registry.reactionFor(PETAL, MUD)).toEqual({ p: 0.01, aBecomes: SEED, bBecomes: MUD })
    // Garnish, deliberately (ruling 3): about one strike per 20,000 ticks of
    // petals landing on a pond, so what colonises water is seeds tumbling in.
    expect(registry.reactionFor(PETAL, WATER)).toEqual({
      p: 0.001,
      aBecomes: SEED,
      bBecomes: WATER,
    })
    // Symmetric, as every row is: reached from the soil side, the petal is still
    // the cell that becomes the seed.
    expect(registry.reactionFor(MUD, PETAL)).toEqual({ p: 0.01, aBecomes: MUD, bBecomes: SEED })
  })

  it('floats on a pond instead of sinking through it', () => {
    const sim = new Sim({ seed: 1 })
    pool(sim, 140, 160, 10)
    sim.paint(150, FLOOR - 12, PETAL)

    // Well inside the shortest petal life (80 ticks), so what is read here is
    // where it came to rest rather than where it happened to expire.
    run(sim, 60)

    // One cell above the pool, on the surface - and nowhere in the water below.
    expect(countIn(sim, POOL, PETAL)).toBe(1)
    for (let i = 1; i <= 10; i++) {
      for (let x = 140; x <= 160; x++) expect(sim.speciesAt(x, FLOOR - i)).not.toBe(PETAL)
    }
  })

  /**
   * **Read the `p` as a rate, not as a share.** A petal at rest gets a draw
   * every tick for the whole of its 80-150 ticks, and from both sides of the
   * pair, so 0.01 means "a petal that settles on open wet soil usually takes":
   * 35-36 of these 40 struck, measured over seeds 1-3.
   */
  it('strikes into a seed where it settles on open wet soil', () => {
    const sim = new Sim({ seed: 1 })
    for (let i = 0; i < 40; i++) sealedPair(sim, 4 + i * 6, PETAL, MUD)

    // Past the longest petal life, so every pair has had all the draws it will
    // ever get. The pockets are lidded, so the struck seeds bank and stay banked.
    run(sim, 400)

    // Most struck, and the strike went all the way through burial: the seed the
    // petal became was resting on the soil that made it.
    expect(count(sim, BURIED)).toBeGreaterThan(25)
    // A closed ledger: every pocket holds either a bank or the soil it started
    // with, and no petal outlived its countdown.
    expect(count(sim, BURIED) + count(sim, MUD)).toBe(40)
    expect(count(sim, PETAL)).toBe(0)
  })

  /**
   * Pond succession, end to end (spec §4.4): a drift of petals floats on the
   * water, a few strike into seeds, those sink past the petals still floating,
   * bank in the pond floor, drown into moss and climb as vine. Measured over
   * seeds 1-6: 4-8 of 30 petals struck, and the floor carried 220-242 vine by
   * 1500 ticks.
   *
   * A whole drift rather than one petal, because at p 0.001 a single petal is a
   * coin this test would flip and lose. That is the ruling, not a workaround -
   * the strike is garnish, and a pond turns to marsh mostly from seeds tumbling
   * in over the bank.
   */
  it('turns a pond floor to vine, on the timescale succession is meant to read at', () => {
    const sim = new Sim({ seed: 1 })
    for (let x = 139; x <= 201; x++) sim.paint(x, FLOOR, OBSIDIAN)
    for (let i = 1; i <= 14; i++) {
      sim.paint(139, FLOOR - i, OBSIDIAN)
      sim.paint(201, FLOOR - i, OBSIDIAN)
    }
    for (let x = 140; x <= 200; x++) {
      sim.paint(x, FLOOR - 1, MUD)
      for (let i = 2; i <= 8; i++) sim.paint(x, FLOOR - i, WATER)
    }
    for (let i = 0; i < 30; i++) sim.paint(141 + i * 2, FLOOR - 10, PETAL)

    run(sim, 1200)

    // Nothing but a petal strike could have put a plant in this pond: no seed
    // was painted, and there is no bed above it for one to fall off.
    expect(count(sim, MOSS)).toBeGreaterThan(0)
    expect(count(sim, VINE)).toBeGreaterThan(20)
  })
})

/**
 * The death drop (spec §4.4), and the engine affordance it needed: a lifetime
 * can leave one thing in the cell it kills and throw a brood clear of it
 * (`lifetime.emits`, pinned in `lifecycle.test.ts`). A hook could not do this -
 * `onTick` never runs on the tick a lifetime expires.
 */
describe('the flower death drop', () => {
  it('leaves a falling seed where it stood and throws petals clear of it', () => {
    const sim = new Sim({ seed: 1 })
    shelf(sim, 40, 60)
    for (let i = 1; i <= 6; i++) sim.paint(50, FLOOR - i, STALK)
    sim.paint(50, FLOOR - 7, FLOWER)

    // Past the longest flower (2400 ticks) and inside the shortest stem (2720),
    // so the plant it stood on is still there to read the drop against. The two
    // moved together in ticket 06 and this case is why the *order* matters, not
    // just the numbers.
    const petals = peakOver(sim, 2500, PETAL)

    expect(count(sim, FLOWER)).toBe(0)
    // **3-4 is the floor** - the prototype measured 1-2 as very nearly
    // invisible. The peak runs a little above the drop itself, because the
    // flower also sheds while it is alive.
    expect(petals).toBeGreaterThanOrEqual(3)
    expect(petals).toBeLessThanOrEqual(8)
    // And exactly one seed, in the cell the flower stood in - `becomes` is what
    // is left behind, `emits` is what is thrown clear.
    expect(count(sim, SEED)).toBe(1)
    // The stem is untouched: only the crown died.
    expect(count(sim, STALK)).toBe(6)
  })

  it('sheds the odd petal while it is still alive, well before it withers', () => {
    const sim = new Sim({ seed: 1 })
    shelf(sim, 20, 180)
    for (let i = 0; i < 10; i++) sim.paint(30 + i * 15, FLOOR - 1, FLOWER)

    // Inside 16 x 75 = 1200 ticks, the shortest life any of them can have, so
    // not one of these petals can have come from a death drop.
    const petals = peakOver(sim, 500, PETAL)

    expect(count(sim, FLOWER)).toBe(10)
    expect(petals).toBeGreaterThan(0)
  })
})

/**
 * **Seeds rot** (life ticket 04), and it is not a detail: a seed that lands
 * where it cannot germinate was immortal litter, and litter roofs the ground it
 * fell on, so the bed under it goes dormant too.
 */
describe('a stranded seed', () => {
  it('clears itself from stone it can never germinate on', () => {
    const sim = new Sim({ seed: 1 })
    shelf(sim, 20, 180)
    const stranded = Array.from({ length: 10 }, (_, i) => 30 + i * 15)
    for (const x of stranded) sim.paint(x, FLOOR - 1, SEED)

    // Inside 8 x 160 = 1280 ticks: generous on purpose, so no seed on its way to
    // soil ever notices the countdown.
    run(sim, 1270)
    expect(count(sim, SEED)).toBe(stranded.length)

    // And past 8 x 250, plus the phase.
    run(sim, 800)
    expect(count(sim, SEED)).toBe(0)
    expect(sim.speciesAt(stranded[0]!, FLOOR - 1)).toBe(EMPTY)
  })

  /**
   * **The bank is untouched by it**, and that is why the seed is two species at
   * all: the buried seed holds its soak counter in `ra`, so it can declare no
   * lifetime, so it cannot rot (ADR 0043). A bank that expired would undo the
   * one thing it exists for.
   */
  it('leaves the bank alone: a buried seed keeps its byte and waits indefinitely', () => {
    expect(registry.lifetimeOf(BURIED)).toBeUndefined()

    const sim = new Sim({ seed: 1 })
    sealedPair(sim, 100, BURIED, MUD)

    // Twice the longest a loose seed lives, under a lid it can never germinate
    // through.
    run(sim, 4000)

    expect(count(sim, BURIED)).toBe(1)
  })

  /**
   * The cost of the lifetime, said out loud: `ra` is now the engine's countdown
   * on a loose seed, so a built scene can no longer pre-age one. The guard is at
   * the call site because the registry cannot see it at boot (life ticket 01).
   */
  it('refuses an `ra` seed now that the countdown owns the byte', () => {
    const sim = new Sim({ seed: 1 })

    expect(() => sim.paint(50, 50, SEED, { ra: 40 })).toThrow(/lifetime/i)
  })
})

/** A long bed of wet soil with the sky open over it and walls it cannot leave. */
function meadowBed(sim: Sim, left: number, right: number): void {
  for (let x = left - 1; x <= right + 1; x++) sim.paint(x, FLOOR, OBSIDIAN)
  for (let i = 1; i <= 30; i++) {
    sim.paint(left - 1, FLOOR - i, OBSIDIAN)
    sim.paint(right + 1, FLOOR - i, OBSIDIAN)
  }
  for (let x = left; x <= right; x++) sim.paint(x, FLOOR - 1, MUD)
  for (let x = left + 10; x < right; x += 40) sim.paint(x, FLOOR - 1, BURIED)
}

/**
 * The whole point of the epic, in one world: seed -> buried -> sprout -> stalk ->
 * flower -> seed, closing on itself with no rule anywhere that says "reproduce".
 */
describe('the meadow loop', () => {
  /**
   * **The soak, and ruling 4's density target** (tickets 04 and 06). Seven banked
   * seeds on a 261-cell bed and nothing else: the meadow establishes itself, and
   * what it establishes is a meadow rather than scrub.
   *
   * **The tuning finding, because it refuted the ticket's own premise.** The
   * knob was expected to be the germination probability - it was the one that
   * moved the standing population most in the prototype. It is not the one here,
   * and the difference is ruling 2: the prototype refunded the soil cell as mud,
   * while germination *drinks* it now, so a bed of N cells pays for exactly N
   * plants however fast they arrive. That makes the standing count a plant's
   * lifetime divided by the window and nothing else, and germination only the
   * speed the bed is spent at. Measured on this bed, raising `GERMINATE_P` alone
   * to 0.005 filled it to 33-41 crowns by tick 2000 and left 0-3 by 12,000, with
   * every cell of soil dry - a meadow that flowers once and is gone. **Doubling
   * the flower's life is what bought the density**, because a crown that lasts
   * twice as long holds up twice as many crowns per cell of water:
   *
   * | tuning | settled band | bed dry by |
   * | --- | --- | --- |
   * | ticket 04 (`0.005/4`, flower 600-1200) | 5-23 | 20,600-22,400 |
   * | germination alone (`0.005`, flower 600-1200) | 0-41 | 11,400-13,200 |
   * | ticket 06 (`0.008/4`, flower 1200-2400) | 19-47 | 20,000-21,600 |
   *
   * So the germination bump that stayed is small, and it buys *establishment*
   * rather than density: 20 crowns by 1300-2000 ticks instead of 3300-7100.
   *
   * Sampled every 1000 ticks over seeds 1-6 (three are pinned; six were measured,
   * because a meadow that only holds on seed 1 is a coincidence). The band from
   * 3000 on was 26-47 crowns and the 2000 sample - still establishing - 19-27.
   * The window ends at 12,000 deliberately: past it the bed thins as the last of
   * its soil dries, which is `drinks the bed as it grows` below and ADR 0045 §4,
   * not this case.
   */
  // ~21s locally (3 seeds x 12k ticks) - a shared CI runner needs more than the
  // file's 30s ceiling, same reasoning as vitest.config.ts.
  it('holds a population over a long seeded run, neither dying out nor exploding', { timeout: 180_000 }, () => {
    for (const seed of [1, 2, 3]) {
      const sim = new Sim({ seed })
      meadowBed(sim, 20, 280)

      let low = Number.POSITIVE_INFINITY
      let high = 0
      let settled = -1
      const crowns = (): number => count(sim, SPROUT) + count(sim, TIP) + count(sim, FLOWER)
      for (let t = 0; t <= 12000; t++) {
        if (settled < 0 && crowns() >= 20) settled = t
        // From 3000 rather than 2000: the first thousand ticks are one cohort
        // climbing, and what is pinned here is the settled band.
        if (t % 1000 === 0 && t >= 3000) {
          low = Math.min(low, crowns())
          high = Math.max(high, crowns())
        }
        sim.tick()
      }

      // **Ruling 4, measured**: an established bed carries 20+ crowns, not the
      // 4-16 scrub the dormancy tuning left. Low sample measured 26-31 over the
      // three pinned seeds and 26 at worst over six.
      expect(low).toBeGreaterThanOrEqual(20)
      // And it gets there promptly - the germination bump is what this buys.
      // Measured 1335-2005 ticks over the three, 1325-2005 over six.
      expect(settled).toBeGreaterThan(0)
      expect(settled).toBeLessThan(2500)
      // Not a runaway either: reproduction is limited by open wet ground, and a
      // full meadow roofs its own bed, so the bank under it sleeps. Measured
      // high 37-42 over the three seeds, 47 at most over six.
      expect(high).toBeLessThan(70)
    }
  })

  /**
   * **What ends it, and why it is a design question rather than a bug here.**
   * Ruling 2 reinstated plant drinking: germination refunds the soil cell it
   * grew out of as *dirt*, not mud, so every generation spends one cell of the
   * bed's water. The prototype refunded mud and so never met this - measured
   * here, a 261-cell bed carries a meadow past 12,000 ticks and then thins out as
   * the last of the soil dries, gone around 20,000.
   *
   * Ticket 05's water cycle does not close it and deliberately does not try to:
   * **the cycle is closed under fire and open under old age**, and both obvious
   * closures are wrong for reasons ADR 0045 §4 sets out. Ticket 06's density pass
   * was measured against this number and left it where it found it - the flower
   * living twice as long is what bought the crowns, and a plant that lasts longer
   * spends the bed *slower* per crown, which is why doubling the standing
   * population cost the horizon nothing (20,600-22,400 ticks before, 20,000-21,600
   * after, two seeds each). Raising germination alone would have cut it to
   * 11,400-13,200.
   *
   * What is pinned here is the ledger - the bed's soil is conserved and only ever
   * moves one way - so any future change to that ruling has a number to beat.
   */
  it('drinks the bed as it grows, one cell of soil per germination', () => {
    const sim = new Sim({ seed: 1 })
    meadowBed(sim, 20, 280)
    const soil = (): number => count(sim, MUD) + count(sim, DIRT) + count(sim, BURIED)
    const opening = soil()
    let driest = 0

    for (let t = 0; t <= 12000; t++) {
      if (t % 500 === 0) {
        // Nothing here creates or destroys soil: burial moves a cell of mud into
        // the bank and germination hands it back as dirt.
        expect(soil()).toBe(opening)
        driest = Math.max(driest, count(sim, DIRT))
      }
      sim.tick()
    }

    // The bed really did dry, and it is most of the way there.
    expect(driest).toBeGreaterThan(opening / 2)
    expect(count(sim, MUD)).toBeLessThan(opening / 2)
  })
})

/** A sealed box: floor, two walls and a lid, so nothing at all can leave it. */
function sealedBox(sim: Sim, left: number, right: number, height: number): void {
  for (let x = left - 1; x <= right + 1; x++) {
    sim.paint(x, FLOOR, OBSIDIAN)
    sim.paint(x, FLOOR - height - 1, OBSIDIAN)
  }
  for (let i = 1; i <= height; i++) {
    sim.paint(left - 1, FLOOR - i, OBSIDIAN)
    sim.paint(right + 1, FLOOR - i, OBSIDIAN)
  }
}

/** An open tank - floor and walls, no lid - with a bed of `soil` on the floor. */
function tank(sim: Sim, left: number, right: number, height: number, soil: number): void {
  for (let x = left - 1; x <= right + 1; x++) sim.paint(x, FLOOR, OBSIDIAN)
  for (let i = 1; i <= height; i++) {
    sim.paint(left - 1, FLOOR - i, OBSIDIAN)
    sim.paint(right + 1, FLOOR - i, OBSIDIAN)
  }
  for (let x = left; x <= right; x++) sim.paint(x, FLOOR - 1, soil)
}

/** Everything a land plant is made of, standing or growing. */
function plantCells(sim: Sim): number {
  return count(sim, SPROUT) + count(sim, TIP) + count(sim, STALK) + count(sim, FLOWER)
}

/** One growing or terminal end per living plant - see `the seed bank` above. */
function crowns(sim: Sim): number {
  return count(sim, SPROUT) + count(sim, TIP) + count(sim, FLOWER)
}

/**
 * The water cycle (life spec §4.5), and the half of the epic that is not about
 * plants at all: standing water drains, fire dries wet soil instead of deleting
 * it, wet biomass returns its water to the sky, and every one of those rules
 * transmutes rather than deletes
 * ([ADR 0044](../../../../docs/adr/0044-silt-thin-film-evaporation.md),
 * [ADR 0045](../../../../docs/adr/0045-silt-the-water-ledger.md)). The hook
 * itself is pinned against a stub in `evaporation.test.ts`.
 */
describe('the water cycle', () => {
  /**
   * **The rate, at the scale it was tuned at.** A lone film cell is the unit:
   * the prototype's `evapP` 0.03 drawn one tick in four gives it a mean life of
   * about 130 ticks, which is what makes a poured puddle - thirteen independent
   * draws, the last of them roughly three times the mean - clear in the few
   * hundred ticks the ruling asks for rather than in a few thousand.
   *
   * Swept over eight seeds rather than pinned to one, since a rate measured on a
   * single draw is not a rate: measured 3, 23, 96, 125, 158, 169, 278 and 281.
   */
  it('lifts a lone film off saturated ground on the rate the ruling was tuned at', () => {
    const lives: number[] = []

    for (let seed = 1; seed <= 8; seed++) {
      const sim = new Sim({ seed })
      sealedBox(sim, 40, 60, 20)
      for (let x = 40; x <= 60; x++) sim.paint(x, FLOOR - 1, MUD)
      sim.paint(50, FLOOR - 2, WATER)

      let ticks = 0
      while (count(sim, WATER) > 0 && ticks < 4000) {
        sim.tick()
        ticks++
      }
      lives.push(ticks)
    }

    // Every one of them lifted, and none of them instantly: the draw is a rate,
    // not a countdown, so the spread is the point.
    expect(Math.max(...lives)).toBeLessThan(1000)
    expect(Math.max(...lives)).toBeGreaterThan(100)
    // Water on wet soil is the one case with no reaction to take it, so this is
    // the only thing standing between a saturated bed and a permanent puddle.
    expect(new Set(lives).size).toBeGreaterThan(4)
  })

  /**
   * The same rule at puddle scale, which is what a person actually pours. The
   * bed is already saturated, so `water + mud` is not a reaction and there is
   * nowhere for it to soak: without evaporation this puddle stands for the rest
   * of the run.
   *
   * **The bound is loose on purpose.** What lifts rains back down, and some of
   * it lands on the same bed, so the bed is not monotonically drying - measured
   * over eight seeds it was clear of all but a raindrop by 195-1659 ticks on
   * seven of them and went on being re-rained on one. What is pinned is that the
   * poured body is gone, not that the sky is.
   */
  it('drains a poured puddle off a bed with nowhere left to take it', () => {
    for (const seed of [1, 2, 3]) {
      const sim = new Sim({ seed })
      for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, OBSIDIAN)
      for (let x = 120; x <= 180; x++) sim.paint(x, FLOOR - 1, MUD)
      const puddle = { x0: 120, x1: 180, y0: FLOOR - 6, y1: FLOOR - 1 }
      for (let i = 0; i < 13; i++) sim.paint(144 + i, FLOOR - 4, WATER)
      expect(countIn(sim, puddle, WATER)).toBe(13)

      let ticks = 0
      while (countIn(sim, puddle, WATER) > 1 && ticks < 4000) {
        sim.tick()
        ticks++
      }

      expect(ticks).toBeLessThan(4000)
    }
  })

  /**
   * **The ruling, stated as the thing it protects** (spec ruling 1): a level
   * pool two cells deep has no film anywhere in it - every cell has either water
   * above it or water below it - and neither has a pond. Standing water is a
   * thing you are meant to be able to make, so both are permanent by
   * construction rather than by a rule saying so.
   *
   * And **asleep**, which is the other half: a surface cell that is not a film
   * takes no keep-awake, so a pond costs a world at rest exactly nothing.
   */
  it('leaves a pond and a level two-deep pool exactly as it found them, asleep', () => {
    for (const seed of [1, 2, 3]) {
      const sim = new Sim({ seed })
      // A nine-deep pond and, beside it, a pool standing dead level at two.
      pool(sim, 40, 60, 9)
      for (let x = 99; x <= 131; x++) sim.paint(x, FLOOR, OBSIDIAN)
      for (let i = 1; i <= 4; i++) {
        sim.paint(99, FLOOR - i, OBSIDIAN)
        sim.paint(131, FLOOR - i, OBSIDIAN)
      }
      for (let x = 100; x <= 130; x++) {
        for (let i = 1; i <= 2; i++) sim.paint(x, FLOOR - i, WATER)
      }
      const standing = count(sim, WATER)

      run(sim, 8000)

      // Not slow loss - no loss at all, on every seed.
      expect(count(sim, WATER)).toBe(standing)
      expect(sim.scannedLastTick).toBe(0)
    }
  })

  /**
   * **A fall is not a film**, and the reason the rule reads one cell *down*
   * rather than only up (ADR 0044 §5). Falling water given a draw every tick of
   * a hundred-cell fall loses about half of itself on the way, and the half that
   * lifts rises, condenses and falls again - the rule meant to dry standing
   * water manufacturing permanent cloud instead, which is the any-surface trap
   * in miniature.
   *
   * Measured over three seeds with air-below allowed: 87-107 of 200 droplets
   * landed and 55-74 were still aloft at 400 ticks. Refusing it: 179-183 landed,
   * 3-9 aloft.
   */
  it('lands its rain on the bed instead of turning it back into cloud', () => {
    for (const seed of [1, 2, 3]) {
      const sim = new Sim({ seed })
      for (let x = 20; x <= 280; x++) {
        sim.paint(x, FLOOR, OBSIDIAN)
        sim.paint(x, FLOOR - 1, DIRT)
      }
      for (let i = 0; i < 200; i++) sim.paint(21 + i, FLOOR - 100, WATER)

      run(sim, 400)

      // Each cell of mud is a cell of rain that arrived and soaked in.
      expect(count(sim, MUD)).toBeGreaterThan(150)
      expect(count(sim, STEAM)).toBeLessThan(30)
    }
  })

  /**
   * **The self-termination the hook is required to have** (spec §2.7). A bed
   * with no free water on it is finished either way round - dry, or saturated -
   * and the hook writes nothing at all on both, so the chunk under it sleeps.
   * The mirror of the pond above: this is the case where evaporation *could*
   * have left a permanent keep-awake behind and does not.
   */
  it('lets a finished bed sleep, wet or dry', () => {
    for (const soil of [MUD, DIRT]) {
      const sim = new Sim({ seed: 1 })
      tank(sim, 40, 80, 8, soil)

      run(sim, 500)

      expect(sim.scannedLastTick).toBe(0)
      expect(count(sim, soil)).toBe(41)
    }
  })

  /**
   * **The ledger** (spec §7.3, ADR 0045), and the acceptance ticket 05 exists
   * for: free water, water aloft and water in the soil are one quantity, and
   * every rule in the table has to say what it does to it. Sampled every tick
   * rather than at the end, since a leak that showed up only at the close could
   * be hiding a dip and a recovery.
   *
   * **Reframed by the deletion ruling** (ADR 0044 §6, ADR 0045 §4). This case
   * used to pin `ledger() === opening` on every tick of every seed, and that
   * claim is no longer true: a film dries out of the world rather than lofting,
   * so the ledger really does fall. What replaces it is the claim the ruling
   * actually leaves standing - **evaporation is the *only* leak** - pinned three
   * ways rather than by widening a band:
   *
   * - the ledger **never rises**, so nothing manufactures water;
   * - it **never falls by more than the number of films standing at the top of
   *   the tick**, which is the shape only evaporation can have. A quench, a
   *   fading smoke or a lost condensation would all breach it, and the fall is
   *   one cell at a time;
   * - the total drift over 3000 ticks is small and measured.
   *
   * Measured over four seeds (two are pinned): drift 2, 5, 7 and 4 cells of an
   * opening 20; zero rises; the largest fall on any tick 1; and not one fall
   * anywhere that outran the films counted before it. The burn still moves the
   * water through all three states - the bed peaked at 18-20 mud and the plume
   * at 18-20 steam, unchanged - because the quench is untouched.
   */
  it('leaks only by evaporation through a pour, a burn and the rain that follows', () => {
    for (const seed of [1, 2]) {
      const sim = new Sim({ seed })
      sealedBox(sim, 40, 80, 40)
      for (let x = 40; x <= 80; x++) sim.paint(x, FLOOR - 1, DIRT)
      for (let i = 0; i < 20; i++) sim.paint(50 + i, FLOOR - 6, WATER)

      // Free water, water aloft, water in the soil. Nothing else in this scene
      // holds any, because nothing in it is alive. Counted over the box rather
      // than the grid, as the bank's ledger case does: a per-tick assertion over
      // 60,000 cells is not affordable, and nothing can leave a sealed box.
      const BOX = { x0: 39, x1: 81, y0: FLOOR - 41, y1: FLOOR } as const
      const ledger = (): number =>
        countIn(sim, BOX, WATER) + countIn(sim, BOX, STEAM) + countIn(sim, BOX, MUD)
      const opening = ledger()
      let previous = opening
      let wettest = 0
      let peakSteam = 0
      let biggestFall = 0

      for (let t = 0; t < 3000; t++) {
        // Torched once the pour has soaked in, so the fire meets wet soil - and
        // dragged through the *air* over the bed, never over a cell that holds
        // any of the water being counted. A brush that painted over a droplet
        // would be the test deleting the water, not the world.
        if (t === 800) {
          for (let x = 45; x <= 75; x++) {
            if (sim.speciesAt(x, FLOOR - 2) === EMPTY) sim.paint(x, FLOOR - 2, FIRE)
          }
        }
        // Counted before the tick, because a film is what the hook is offered.
        const films = filmsIn(sim, BOX)
        sim.tick()
        const now = ledger()
        // **Nothing makes water.** The half of the old invariant that survives
        // the ruling untouched.
        expect(now).toBeLessThanOrEqual(previous)
        // **And what spends it is shaped like evaporation and nothing else**: a
        // fall of N needs N films to have been standing. The quench, a smoke
        // that faded or a condensation that went missing would all show up here
        // as a fall with no film under it.
        expect(previous - now).toBeLessThanOrEqual(films)
        biggestFall = Math.max(biggestFall, previous - now)
        previous = now
        wettest = Math.max(wettest, countIn(sim, BOX, MUD))
        peakSteam = Math.max(peakSteam, countIn(sim, BOX, STEAM))
      }

      // A film at a time, never a gulp. Measured: the largest fall on any tick
      // of any of four seeds was 1.
      expect(biggestFall).toBeLessThanOrEqual(1)
      // And small: 2-7 cells of the opening 20 over 3000 ticks, four seeds.
      expect(opening - previous).toBeGreaterThan(0)
      expect(opening - previous).toBeLessThan(10)
      // Not vacuous: the water really did move through all three states.
      expect(wettest).toBeGreaterThan(0)
      expect(peakSteam).toBeGreaterThan(0)
    }
  })

  /**
   * **Dry parts burn, wet parts steam** (spec §4.5), on a bare shelf so that
   * every cell of steam in the world came out of a plant rather than out of the
   * soil. The stem carries the fire - which is what lets a burn travel up a
   * plant at all - and the flower and the seedling hand it nothing.
   */
  it('steams the wet parts of a plant and lets the dry ones carry the fire', () => {
    const sim = new Sim({ seed: 1 })
    shelf(sim, 20, 120)
    const stands = [30, 45, 60, 75, 90, 105]
    for (const x of stands) {
      // A stem with a flower on it, and a seedling beside it.
      for (let i = 1; i <= 4; i++) sim.paint(x, FLOOR - i, STALK)
      sim.paint(x, FLOOR - 5, FLOWER)
      sim.paint(x + 3, FLOOR - 1, SPROUT)
      sim.paint(x, FLOOR - 6, FIRE)
      sim.paint(x + 3, FLOOR - 2, FIRE)
    }
    const stems = count(sim, STALK)
    const wet = count(sim, FLOWER) + count(sim, SPROUT)

    const steamed = peakOver(sim, 300, STEAM)

    // Most of the wet parts are gone, and what left them was **steam**: there is
    // no soil anywhere in this scene for a single cell of it to have come from.
    // Not all of them, and that is fire being a rate rather than a switch - a
    // flame rises off a flower and dies before every draw has come up.
    expect(wet - count(sim, FLOWER) - count(sim, SPROUT)).toBeGreaterThan(wet / 2)
    expect(steamed).toBeGreaterThan(4)
    // And the stem went the other way, which is the half that matters for a
    // burn travelling: it burned rather than quenching the flame.
    expect(stems).toBeGreaterThan(20)
    // Not to nothing: fire is a rate and it dies to smoke in 40-60 ticks, so a
    // stem outlives the flame that reached it as often as not. What is pinned is
    // that the stem is *fuel* - it took the fire rather than quenching it - not
    // that one spark is thorough. Measured: 10 of 24 cells left standing.
    expect(count(sim, STALK)).toBeLessThan(stems / 2)
  })

  /**
   * **A wildfire rains on its own ashes** (spec §4.5), end to end and with no
   * water painted anywhere: a dragged torch clears the standing meadow, the
   * soil's own water is lofted by the quench rather than deleted, it condenses
   * and falls back, the bed re-wets, and the bank - which the fire never
   * reached - germinates into the clearing.
   *
   * **What "cleared" means, and why ticket 06 had to loosen it.** Ticket 05 read
   * the torch as taking the meadow to *nothing*, which held while a stem lived
   * 1400-1800 ticks. With the stem at 2720-3200 there is more standing fuel and
   * more of it to get through, and fire is a rate: over six seeds the torch left
   * a single straggler on four of them (0-10 plant cells of the 27-46 it found).
   * That is the same "fire is a rate rather than a switch" the case above pins,
   * and buffing the torch to beat it would be exactly the over-buffing the ticket
   * warns against - so what is pinned is the *crown* count, which goes to at most
   * one on every seed, and the survivor is left to burn or wither on its own.
   *
   * Measured over six seeds: the crowns were down to one or none in 6-17 ticks,
   * the plume peaked at 36-39 cells, the bed was wet again by 368-382 ticks, the
   * bank had a new plant up by 118-334, and the meadow was back to the mass and
   * the crown count the fire found by 342-2577. That is the recovery on the
   * ticket's 500-3000 tick order, from the bank rather than from a seed rain.
   *
   * **The deletion ruling stretched the tail and nothing else** (ADR 0044 §6).
   * Clearing, plume and re-wetting are identical to the numbers ticket 06
   * recorded, because the quench is what makes this rain and the quench is
   * untouched. Full recovery was 342-884 before and is 342-2577 now: the fast
   * seeds did not move, and the slow ones lost the second and third pass a
   * raindrop used to get at the bed once it had landed. Still inside the
   * ticket's window, with less headroom at the top than it had.
   */
  // ~19s locally (3 seeds, grow-burn-recover) - see the population soak above.
  it('clears a meadow with a dragged torch and rains the bed back to life', { timeout: 180_000 }, () => {
    for (const seed of [1, 2, 3]) {
      const sim = new Sim({ seed })
      tank(sim, 40, 80, 60, MUD)
      for (const x of [44, 50, 56, 62, 68, 74]) sim.paint(x, FLOOR - 1, BURIED)

      let ticks = 0
      while (count(sim, FLOWER) < 3 && ticks < 8000) {
        sim.tick()
        ticks++
      }
      const standing = plantCells(sim)
      const blooming = crowns(sim)
      expect(standing).toBeGreaterThan(10)

      for (let x = 40; x <= 80; x++) sim.paint(x, FLOOR - 2, FIRE)

      let cleared = -1
      let rewet = -1
      let regrown = -1
      let recovered = -1
      let survivors = -1
      let plume = 0
      for (let t = 0; t < 4000; t++) {
        sim.tick()
        plume = Math.max(plume, count(sim, STEAM))
        if (cleared < 0 && crowns(sim) <= 1) cleared = t
        // The straggler, counted once the flames are out, so "regrown" means the
        // *bank* put a plant up rather than one having stood through the fire.
        if (t === 100) survivors = crowns(sim)
        if (survivors >= 0 && rewet < 0 && count(sim, MUD) > 5) rewet = t
        if (survivors >= 0 && regrown < 0 && crowns(sim) > survivors) regrown = t
        if (recovered < 0 && t > 100 && plantCells(sim) >= standing && crowns(sim) >= blooming)
          recovered = t
      }

      // Swept, and quickly - a dragged torch is the ignition story. Measured
      // 6-17 ticks over six seeds; at most one crown is left standing.
      expect(cleared).toBeGreaterThanOrEqual(0)
      expect(cleared).toBeLessThan(100)
      expect(survivors).toBeLessThanOrEqual(1)
      // The plume is the bed's own water, lofted rather than deleted.
      expect(plume).toBeGreaterThan(20)
      // And it came back down on the ground it came off.
      expect(rewet).toBeGreaterThan(0)
      expect(rewet).toBeLessThan(3000)
      // The bank survived the fire (it is not flammable and it lives *under* the
      // surface) and put up a plant the fire had not left standing.
      expect(regrown).toBeGreaterThan(0)
      expect(regrown).toBeLessThan(3000)
      // **The whole cycle**, not just its first sign: the meadow is back to the
      // mass and the crown count the torch found. Measured 342-884 ticks over
      // six seeds, which is the burn-and-recover feel the ticket asks for.
      expect(recovered).toBeGreaterThan(0)
      expect(recovered).toBeLessThan(3000)
    }
  })

  /**
   * The last link of the burn-to-regrowth loop (spec §4.5, burnables ADR 0042
   * §6), and the only one this epic did not have to write: `ash + water -> mud`
   * was already there, and what ticket 05 supplies is the *water*. No rain is
   * painted - every cell of it is soil the fire dried and the sky handed back.
   *
   * **The ash washing is now marginal, and that is the deletion ruling's one
   * real cost** (ADR 0044 §6). While a film lofted, a raindrop that landed on
   * the bed beside the drift got another pass at it, and another - so the drift
   * lost a cell or two on every seed. A raindrop now dries where it lands and
   * has exactly one chance to fall on ash. Measured over six seeds the drift
   * lost 0, 2, 2, 2, 1 and 0 cells: it still happens, on four seeds of six, but
   * it is no longer a per-seed claim and pinning it as one would be tuning
   * around the ruling. So the sweep is what carries it - over three seeds the
   * rain reaches the ash at least once - and the per-seed pins are the ones the
   * ruling left alone.
   *
   * Measured over six seeds: the torch dried 17 of the bed's 35 cells and lofted
   * 17, the bed was wetter than the fire left it by 13-16 cells (mud 18 -> 31-34,
   * against 29-34 before the ruling - the quench is untouched, so the burn's own
   * rain is the same rain), and the first crown was up between 32 and 311 ticks.
   */
  // ~17s locally (6 seeds) - see the population soak above.
  it('washes its own ash into the bed with the rain the burn made', { timeout: 180_000 }, () => {
    let washedOverall = 0
    for (const seed of [1, 2, 3]) {
      const sim = new Sim({ seed })
      tank(sim, 40, 80, 60, MUD)
      for (const x of [44, 50, 56, 62, 68, 74]) sim.paint(x, FLOOR - 1, BURIED)
      // A drift of ash over one half of the bed and a torch over the other, so
      // the water that reaches the ash can only have come from the burn.
      for (let x = 62; x <= 78; x++) sim.paint(x, FLOOR - 2, ASH)
      const drift = count(sim, ASH)
      for (let x = 41; x <= 60; x++) sim.paint(x, FLOOR - 2, FIRE)

      let regrown = -1
      let scorched = 0
      let wettest = 0
      for (let t = 0; t < 6000; t++) {
        sim.tick()
        // The torch dries half the bed in the first few ticks - that is the
        // quench - so the number to beat is what it left, not what it found.
        if (t === 100) scorched = count(sim, MUD)
        if (t > 100) wettest = Math.max(wettest, count(sim, MUD))
        if (regrown < 0 && crowns(sim) > 0) regrown = t
      }

      // The bed ended up wetter than the fire left it - all of it the burn's own
      // water, none of it painted. Measured 13-16 cells over six seeds.
      expect(scorched).toBeGreaterThan(0)
      expect(wettest).toBeGreaterThan(scorched + 8)
      expect(regrown).toBeGreaterThan(0)
      expect(regrown).toBeLessThan(3000)
      washedOverall += drift - count(sim, ASH)
    }

    // **And the rain does reach the ash** - across the sweep rather than on
    // every seed, which is the honest shape of it since a drop that lands now
    // dries instead of getting a second pass. Measured 4 cells over these three
    // seeds (0, 2, 2), and 7 over six.
    expect(washedOverall).toBeGreaterThan(0)
  })
})
