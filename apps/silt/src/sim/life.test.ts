import { describe, expect, it } from 'vitest'

import {
  ACID,
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

  it('is dissolved by acid and burnt by fire through the rows stages 01–02 already wrote', () => {
    for (const plant of [SEED, MOSS, VINE]) {
      // Hardness 0 plus `solid`/`powder` is the whole of it — no `[corrodible]`
      // tag, and no row naming any of the three.
      expect(registry.get(plant)?.hardness).toBe(0)
      expect(registry.reactionFor(ACID, plant)).toMatchObject({
        aBecomes: EMPTY,
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
      // Corrodible and burnable for free, through the tag rows alone - no row
      // names any of the four, exactly as none names moss or vine.
      expect(registry.get(part)?.hardness).toBe(0)
      expect(registry.reactionFor(ACID, part)).toMatchObject({
        aBecomes: EMPTY,
        bBecomes: EMPTY,
      })
      expect(registry.has(part, 'flammable')).toBe(true)
      expect(registry.reactionFor(FIRE, part)).toMatchObject({ aBecomes: FIRE, bBecomes: FIRE })
    }

    // **The growers own `ra`, so neither may ever be given a lifetime** - doing
    // so hands the byte back to the engine and the tip would climb on a
    // countdown (ADR 0043). The trap is this assertion rather than a surprise.
    expect(registry.lifetimeOf(SPROUT)).toBeUndefined()
    expect(registry.lifetimeOf(TIP)).toBeUndefined()

    // And the products expire, coarsely: 1400-1800 ticks of stem and 600-1200
    // of flower are both past `MAX_LIFETIME_TICKS`, so `every` is what makes
    // them fit the byte at all (life ticket 01).
    expect(registry.lifetimeOf(STALK)).toEqual({
      ticks: 175,
      jitter: 50,
      every: 8,
      becomes: EMPTY,
    })
    // The flower's is also the death drop (life ticket 04): the seed is what is
    // left in its own cell, the petals are what is thrown clear of it.
    expect(registry.lifetimeOf(FLOWER)).toEqual({
      ticks: 75,
      jitter: 75,
      every: 8,
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

    // Well inside the shortest life (8 × 175 = 1400 ticks): a stem that decayed
    // at the flat rate would already be half gone here.
    run(sim, 1200)
    expect(count(sim, STALK)).toBe(standing)

    // And past the longest (8 × 225, plus up to `every` ticks of phase).
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

    // Inside 8 × 75 = 600 ticks, so not one has had its last draw.
    run(sim, 500)
    expect(count(sim, FLOWER)).toBe(blooming)

    // The jitter is coarse too, so the cohort dies over a window rather than
    // together - which is what stops a painted meadow vanishing in one frame.
    run(sim, 400)
    const half = count(sim, FLOWER)
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(blooming)

    // Past 8 × 150 plus the phase.
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

    // Past both lifetimes: 1800 ticks of stem, 1200 of flower.
    run(sim, 2000)

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
    // Acid still reaches it, through the `[powder]` row every grain sits under.
    expect(registry.reactionFor(ACID, PETAL)).toMatchObject({ aBecomes: EMPTY, bBecomes: EMPTY })

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

    // Past the longest flower (1200 ticks) and inside the shortest stem (1400),
    // so the plant it stood on is still there to read the drop against.
    const petals = peakOver(sim, 1300, PETAL)

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

    // Inside 8 x 75 = 600 ticks, the shortest life any of them can have, so not
    // one of these petals can have come from a death drop.
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
   * **The soak** (ticket 04's acceptance). Seven banked seeds on a 261-cell bed
   * and nothing else: the meadow establishes itself and then holds, neither
   * dying out nor running away. Measured over seeds 1-8, sampled every 1000
   * ticks from 2000 on: the low sample was 5-11 crowns and the high 17-23, which
   * is the "20+ crowns" ruling 4 asked for. The thresholds sit well outside both,
   * since what is pinned is that a population *settles*, not the arithmetic of
   * one bed - ticket 06 owns the density knob.
   *
   * Swept over three seeds rather than pinned to one: a self-seeding meadow that
   * only survives on seed 1 is a coincidence, not a loop.
   */
  it('holds a population over a long seeded run, neither dying out nor exploding', () => {
    for (const seed of [1, 2, 3]) {
      const sim = new Sim({ seed })
      meadowBed(sim, 20, 280)

      let low = Number.POSITIVE_INFINITY
      let high = 0
      for (let t = 0; t <= 12000; t++) {
        if (t % 1000 === 0 && t >= 2000) {
          const crowns = count(sim, SPROUT) + count(sim, TIP) + count(sim, FLOWER)
          low = Math.min(low, crowns)
          high = Math.max(high, crowns)
        }
        sim.tick()
      }

      // Never extinct: there was a living crown at every sample past the first
      // generation. Before the death drop this bed grew seven plants and stopped.
      expect(low).toBeGreaterThan(0)
      // Really a meadow, not one straggler holding on.
      expect(high).toBeGreaterThan(10)
      // And not a runaway: reproduction is limited by open wet ground, and a
      // full meadow roofs its own bed, so the bank under it sleeps.
      expect(high).toBeLessThan(40)
    }
  })

  /**
   * **What ends it, and why that is ticket 05's problem rather than a bug here.**
   * Ruling 2 reinstated plant drinking: germination refunds the soil cell it
   * grew out of as *dirt*, not mud, so every generation spends one cell of the
   * bed's water. The prototype refunded mud and so never met this - measured
   * here, a 261-cell bed carries a meadow for something over 12,000 ticks and
   * then thins out as the last of the soil dries, around 20,000-30,000.
   *
   * That is the water cycle's absence, not the loop's failure: fire lofting the
   * soil's water as steam and raining it back (spec §4.5) is what returns it,
   * and it lands in ticket 05. What is pinned here is the ledger - the bed's
   * soil is conserved and only ever moves one way - so the day the cycle arrives
   * there is a number to hold it against.
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
