import { describe, expect, it } from 'vitest'

import {
  ACID,
  APEX,
  BLOSSOM,
  CACTUS,
  DUNED,
  EMPTY,
  FIRE,
  NUB,
  OBSIDIAN,
  PETAL,
  SAND,
  SEED,
  STEAM,
  SULPHUR,
  v1Elements,
  v1Reactions,
} from './elements.ts'
import { GRID_HEIGHT, GRID_WIDTH } from './constants.ts'
import { createRegistry } from './registry.ts'
import { Sim } from './sim.ts'

/**
 * **The desert** (cactus spec §2-§4,
 * [ADR 0054](../../../docs/adr/0054-silt-sand-is-the-third-biome.md)) - the
 * third branch of the biome decision the seed bank has embodied since ADR 0043.
 * Sand was the roster's one dead-end bed; now a seed that lands on a dune beds
 * in it and comes up a cactus.
 *
 * The hooks themselves are tested against stubs in `sandBank.test.ts` and
 * `stalk.test.ts`, where a draw and a write can be pinned exactly. What is here
 * is the roster - ids, colours, tags and the two lifetimes - and the *whole
 * plant running in a world*, which is the only place the pieces can be seen to
 * fit together.
 */

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

/**
 * The same count over an inclusive cell window. The cases that sample every tick
 * use this rather than `count`: a per-tick pass over 60,000 cells is not
 * affordable, and a scene walled into a shelf cannot leave it (`life.test.ts`'
 * `countIn`, same reasoning).
 */
function countIn(
  sim: Sim,
  box: { x0: number; x1: number; y0: number; y1: number },
  species: number,
): number {
  let total = 0
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      if (sim.speciesAt(x, y) === species) total++
    }
  }
  return total
}

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.tick()
}

function runUntil(sim: Sim, done: (sim: Sim) => boolean, budget: number): void {
  for (let i = 0; i < budget && !done(sim); i++) sim.tick()
}

/**
 * The plant standing on the floor in column `x`: how many cells of flesh, and
 * what sits on top of them. Counted as a run of flesh rather than as "everything
 * above the floor" on purpose - a living blossom shows the odd petal, and one
 * that came to rest over the crown would otherwise read as part of the column.
 */
function columnAt(sim: Sim, x: number): { height: number; crowned: boolean } {
  let flesh = 0
  while (sim.speciesAt(x, FLOOR - 1 - flesh) === CACTUS) flesh++
  // An uncrowned column *is* flesh to the top, so the two endings cannot be told
  // apart by the run: what says which happened is whether a blossom sits on it.
  const crowned = sim.speciesAt(x, FLOOR - 1 - flesh) === BLOSSOM
  return { height: flesh + (crowned ? 1 : 0), crowned }
}

/** Enough draws that a 0.3 terminal split is separated from luck. */
const RNG_SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)

/** Anything a standing plant is made of, growing or grown. */
function isColumn(species: number): boolean {
  return species === NUB || species === APEX || species === CACTUS || species === BLOSSOM
}

/**
 * A long bed of sand on an obsidian floor with the sky open over it, walls it
 * cannot leave, and a scatter of banked seed already in it - `life.test.ts`'
 * `meadowBed` with mud swapped for sand and `buried` for `duned`, deliberately
 * cell for cell, so the two biomes' measured bands are comparable numbers rather
 * than two differently-shaped worlds.
 *
 * 261 cells of bed and 7 dunes at x 30, 70 ... 270.
 */
function desertBed(sim: Sim, left: number, right: number): void {
  for (let x = left - 1; x <= right + 1; x++) sim.paint(x, FLOOR, OBSIDIAN)
  for (let i = 1; i <= 30; i++) {
    sim.paint(left - 1, FLOOR - i, OBSIDIAN)
    sim.paint(right + 1, FLOOR - i, OBSIDIAN)
  }
  for (let x = left; x <= right; x++) sim.paint(x, FLOOR - 1, SAND)
  for (let x = left + 10; x < right; x += 40) sim.paint(x, FLOOR - 1, DUNED)
}

/**
 * The x of every plant standing on the bed, read off the one row above it.
 *
 * A cactus is a column rooted in the cell over the dune that raised it, so one
 * occupied cell in that row is one plant - which is the desert's answer to the
 * meadow's `crowns()`. The meadow can count sprouts, tips and flowers because a
 * land plant always has exactly one growing or terminal end; a cactus that spent
 * its terminal draw on the *cap* is flesh to the top and has no such cell, so
 * counting ends here would silently miss the seven columns in ten that never
 * bloom. Counting a window of 261 cells rather than the grid also keeps a
 * per-tick sample affordable, as `life.test.ts`' `countIn` does.
 */
function columnsOn(sim: Sim, left: number, right: number): number[] {
  const xs: number[] = []
  for (let x = left; x <= right; x++) {
    if (isColumn(sim.speciesAt(x, FLOOR - 2))) xs.push(x)
  }
  return xs
}

/** The longest shoulder-to-shoulder run in a sorted list of column positions. */
function longestRun(xs: number[]): number {
  let best = 0
  let run = 0
  let previous = Number.NEGATIVE_INFINITY
  for (const x of xs) {
    run = x === previous + 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = x
  }
  return best
}

describe('the cactus roster', () => {
  it('boots with its five ids pinned, appended and never renumbered', () => {
    expect([DUNED, NUB, APEX, CACTUS, BLOSSOM]).toEqual([26, 27, 28, 29, 30])
    for (const id of [DUNED, NUB, APEX, CACTUS, BLOSSOM]) {
      expect(registry.get(id)).toBeDefined()
      // Everything the desert adds is hardness 0 and static: a plant is soft,
      // and nothing about a cactus is *movement* (the archetype set is closed).
      expect(registry.get(id)?.hardness).toBe(0)
      expect(registry.get(id)?.archetype).toEqual({ kind: 'static' })
    }
  })

  /**
   * The tags are the whole of the desert's chemistry, because every row that
   * reaches it is keyed on one - and `duned`'s missing `flammable` is the load
   * bearing absence, exactly as `buried`'s is: it is what makes the bank survive
   * a fire that clears the stand above it.
   */
  it('tags the four living parts as burnable matter and the bank as neither', () => {
    for (const part of [NUB, APEX, CACTUS, BLOSSOM]) {
      expect(registry.get(part)?.tags).toEqual(['solid', 'flammable'])
    }
    expect(registry.get(DUNED)?.tags).toEqual(['solid'])
    expect(registry.has(DUNED, 'flammable')).toBe(false)
  })

  /**
   * The mass rule (ADR 0040): four shades for anything that forms a mass, one
   * colour for a single travelling cell. The apex is the second element in the
   * roster to take the exception, and it takes it for the stalk tip's reason.
   */
  it('declares four shades for every mass and one colour for the travelling apex', () => {
    for (const mass of [DUNED, NUB, CACTUS, BLOSSOM]) {
      expect(registry.get(mass)?.colours).toHaveLength(4)
    }
    expect(registry.get(APEX)?.colours).toHaveLength(1)
    // `colours[0]` is the base everywhere, because the rail swatch reads it.
    expect(registry.get(CACTUS)?.colours?.[0]).toBe('#3f7d55')
  })

  /**
   * **The growers own `ra`, so none of the three may ever be given a lifetime**
   * (ADR 0043, and ADR 0054 §2 for the apex, which is the roster's fifth
   * claimant). Handing the byte back would have the column climb on a countdown
   * and the bank forget it is a bank. The trap is this assertion rather than a
   * surprise at runtime.
   */
  it('leaves every grower without a lifetime and gives both products one', () => {
    for (const grower of [DUNED, NUB, APEX]) {
      expect(registry.lifetimeOf(grower)).toBeUndefined()
    }

    // 6400-8160 ticks of flesh - roughly two minutes at 60 tps, and two and a
    // half times the meadow's stem, because slow is the plant's character.
    expect(registry.lifetimeOf(CACTUS)).toEqual({
      ticks: 200,
      jitter: 55,
      every: 32,
      becomes: EMPTY,
    })
    // 1600-2400 ticks of crown, dying to a seed and shedding a petal or two -
    // the flower's death drop at the desert's sparser rate (`emits` is the
    // brood thrown clear; `becomes` is what is left in the cell).
    expect(registry.lifetimeOf(BLOSSOM)).toEqual({
      ticks: 100,
      jitter: 50,
      every: 16,
      becomes: SEED,
      emits: { species: PETAL, min: 1, max: 2 },
    })
  })

  /**
   * **The hanging-flower invariant**, carried over from the meadow (life ticket
   * 06): the flesh's *minimum* life has to clear the crown's *maximum*, or a
   * column crumbles out from under a living blossom and leaves it in mid-air.
   * Stated as arithmetic off the registry rather than as two literals, so it
   * goes on holding when ticket 04 retunes either number.
   */
  it('outlives its own crown, so a blossom is never left hanging in the air', () => {
    const flesh = registry.lifetimeOf(CACTUS)!
    const crown = registry.lifetimeOf(BLOSSOM)!
    const min = (life: typeof flesh) => life.ticks * life.every
    const max = (life: typeof flesh) => (life.ticks + life.jitter) * life.every

    expect(min(flesh)).toBe(6400)
    expect(max(crown)).toBe(2400)
    expect(min(flesh)).toBeGreaterThan(max(crown))
  })
})

describe('the desert loop', () => {
  /**
   * **Burial, and the row this whole epic turns on** (ADR 0054 §1). Sand had no
   * water row and so no route into the ground; now it beds a seed exactly as mud
   * does, at a third of the rate. No new seed species: the *bed* decides the
   * biome.
   */
  it('beds a seed into the dune it lands on, and spends the grain doing it', () => {
    expect(registry.reactionFor(SEED, SAND)).toMatchObject({
      p: 0.03,
      aBecomes: EMPTY,
      bBecomes: DUNED,
    })
    // A third of mud's, and the gap is the desert's whole attrition: a loose
    // seed's rot clock is racing a burial it usually loses.
    expect(registry.reactionFor(SEED, SAND)!.p).toBeLessThan(0.1)
  })

  it('banks a seed poured onto an open dune bed', () => {
    const sim = new Sim({ seed: 1 })
    for (let x = 90; x <= 110; x++) sim.paint(x, FLOOR, OBSIDIAN)
    for (let x = 90; x <= 110; x++) sim.paint(x, FLOOR - 1, SAND)
    // Poured rather than placed: falling grains keep the chunk awake, so the
    // p 0.03 row goes on being offered its draws.
    for (let x = 95; x <= 105; x++) sim.paint(x, FLOOR - 8, SEED)

    runUntil(sim, (world) => count(world, DUNED) > 0, 600)

    expect(count(sim, DUNED)).toBeGreaterThan(0)
    // One cell of bed in, one cell of bank out, and the grain spent - the same
    // trade `seed + mud` makes.
    expect(count(sim, SAND) + count(sim, DUNED)).toBe(21)
  })

  /**
   * **Germination, and the one place the two banks differ visibly** (ADR 0054
   * §6): the bed comes *back*. The mud bank refunds dirt because the plant drank
   * the moisture it grew out of, and that refund is what caps the meadow at one
   * plant per cell of wet soil. The desert has no such ledger, so a dune
   * germinates and is still a dune.
   */
  it('raises a nub under open sky and hands the bed back as sand', () => {
    const sim = new Sim({ seed: 1 })
    for (let x = 140; x <= 156; x++) sim.paint(x, FLOOR, DUNED)

    runUntil(sim, (world) => count(world, NUB) > 0, 3000)

    const raised = count(sim, NUB)
    expect(raised).toBeGreaterThan(0)
    // Nothing was spent: every dune that came up is a grain of sand again, and
    // the bed is still 17 cells wide.
    expect(count(sim, SAND)).toBe(raised)
    expect(count(sim, SAND) + count(sim, DUNED)).toBe(17)
  })

  it('stays dormant under a roof, however long the lid is on', () => {
    const sim = new Sim({ seed: 1 })
    // A dune in a sealed obsidian shaft: roofed by anything at all - a grain, a
    // plant, stone, standing water - there is nothing above to germinate into.
    for (let i = -1; i <= 1; i++) sim.paint(150 + i, FLOOR, OBSIDIAN)
    sim.paint(149, FLOOR - 1, OBSIDIAN)
    sim.paint(151, FLOOR - 1, OBSIDIAN)
    sim.paint(150, FLOOR - 1, DUNED)
    sim.paint(150, FLOOR - 2, OBSIDIAN)

    run(sim, 3000)

    expect(sim.speciesAt(150, FLOOR - 1)).toBe(DUNED)
    expect(count(sim, NUB)).toBe(0)
  })

  /**
   * **The raise**, `createSprout` with the cactus's ids: the seedling puts an
   * apex above itself and is spent becoming the bottom cell of the column, so
   * the plant crumbles from the ground up like the meadow's does.
   */
  it('spends the nub raising its apex, becoming the base of the column', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(150, FLOOR, OBSIDIAN)
    sim.paint(150, FLOOR - 1, NUB)

    sim.tick()

    expect(sim.speciesAt(150, FLOOR - 1)).toBe(CACTUS)
    expect(sim.speciesAt(150, FLOOR - 2)).toBe(APEX)
  })

  /**
   * The column, end to end. The apex climbs on the budget the nub prepaid,
   * leaving flesh behind, and finishes with the terminal draw - the one thing
   * neither a lifetime nor a reaction row could express (ADR 0054 §4).
   */
  it('climbs a tall, slow column and finishes it with one draw', () => {
    const heights = new Set<number>()
    let crowned = 0

    for (const seed of RNG_SEEDS) {
      const sim = new Sim({ seed })
      sim.paint(150, FLOOR, OBSIDIAN)
      sim.paint(150, FLOOR - 1, NUB)

      // p 0.08 over a dozen-odd cells: measured, every one of these seeds is
      // finished inside 600 ticks, where a meadow stalk at p 0.3 takes 30.
      runUntil(sim, (world) => count(world, APEX) === 0 && count(world, CACTUS) > 0, 600)
      expect(count(sim, APEX)).toBe(0)

      const column = columnAt(sim, 150)
      heights.add(column.height)
      if (column.crowned) crowned++
      // The whole plant, and nothing beside it: one column, no branches. Arms
      // are deliberately out of scope (ADR 0054's consequences).
      expect(count(sim, CACTUS) + count(sim, BLOSSOM)).toBe(column.height)
    }

    // 10-16 cells of height, prepaid as height + 1 and spent one per climb, plus
    // the nub's own cell and the crown: 12 to 18 cells standing. It is the
    // meadow's arithmetic with the meadow's numbers swapped out.
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(12)
    expect(Math.max(...heights)).toBeLessThanOrEqual(18)
    // And the heights genuinely vary, which is what `heightJitter` buys: a stand
    // of identical columns would satisfy the bounds above and read as a fence.
    // Measured over these 40 seeds, all seven heights come up.
    expect(heights.size).toBeGreaterThan(3)

    // **A blossom is an event, not a stage** (ADR 0054 §4). Both endings happen,
    // and the crowned ones are the minority - bounded either side rather than at
    // a measured count, since 0.3 is ticket 04's to tune: never crowning would
    // be the draw missing entirely, and always crowning would be `flowerP`
    // silently back at the meadow's 1. Measured, 13 of the 40.
    expect(crowned).toBeGreaterThan(0)
    expect(crowned).toBeLessThan(RNG_SEEDS.length / 2)
  })

  /**
   * The loop closes the way the meadow's does: the crown dies to a seed left in
   * its own cell, with a petal or two thrown clear. So seed -> duned -> nub ->
   * apex -> cactus/blossom -> seed comes round with no rule anywhere saying
   * "reproduce".
   */
  it('dies to a falling seed, so the desert reproduces itself', () => {
    const sim = new Sim({ seed: 1 })
    for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, OBSIDIAN)
    for (let x = 140; x <= 160; x++) sim.paint(x, FLOOR - 1, BLOSSOM)

    // 1600-2400 ticks, and `jitter` is added rather than subtracted.
    runUntil(sim, (world) => count(world, BLOSSOM) === 0, 2500)

    expect(count(sim, BLOSSOM)).toBe(0)
    expect(count(sim, SEED)).toBeGreaterThan(0)
  })

  /**
   * **The loop, closing on itself, with nothing painted but one dune** (ticket
   * 04). Every case above holds one link of the chain against a scene built for
   * it; this one starts from a bedded seed on a strip of sand and watches the
   * whole of `duned -> nub -> apex -> cactus -> blossom -> seed -> duned` happen
   * in one world, in that order, with no hand on it.
   *
   * Swept over seeds 1-6 because the round trip needs the terminal draw to come
   * up, and at p 0.3 it will not on most of them. Measured on a 21-cell shelf:
   *
   * | seed | nub | apex/flesh | blossom | its seed | bedded again |
   * | --- | --- | --- | --- | --- | --- |
   * | 1 | 165 | 166 | 331 | 2337 | 2356 |
   * | 2 | 3398 | 3399 | - | - | - |
   * | 3 | 594 | 595 | - | - | - |
   * | 4 | 625 | 626 | 791 | 2993 | 3016 |
   * | 5 | 656 | 657 | - | - | - |
   * | 6 | 924 | 925 | 1151 | 2881 | 2920 |
   *
   * Three of the six, which is the 0.3 draw showing up at the scale of a whole
   * plant. The apex and the first cell of flesh arrive on the *same* tick - the
   * nub becomes the base and sets the apex above itself in one write.
   */
  it('closes on its own: one dune, and its blossom beds the next seed', { timeout: 180_000 }, () => {
    // The shelf, walls included: nothing in this scene can leave it, so every
    // per-tick sample below is 23 x 31 cells rather than the whole grid.
    const shelf = { x0: 139, x1: 161, y0: FLOOR - 30, y1: FLOOR }
    let closed = 0

    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = new Sim({ seed })
      for (let x = shelf.x0; x <= shelf.x1; x++) sim.paint(x, FLOOR, OBSIDIAN)
      for (let i = 1; i <= 30; i++) {
        sim.paint(shelf.x0, FLOOR - i, OBSIDIAN)
        sim.paint(shelf.x1, FLOOR - i, OBSIDIAN)
      }
      for (let x = 140; x <= 160; x++) sim.paint(x, FLOOR - 1, SAND)
      sim.paint(150, FLOOR - 1, DUNED)

      const at = { nub: -1, apex: -1, flesh: -1, blossom: -1, seed: -1, bedded: -1 }
      // 8000 ticks: past the slowest germination measured (3398) with the whole
      // of a blossom's life (2400) and the seed's tumble still to spare.
      for (let t = 0; t <= 8000; t++) {
        if (at.nub < 0 && countIn(sim, shelf, NUB) > 0) at.nub = t
        if (at.apex < 0 && countIn(sim, shelf, APEX) > 0) at.apex = t
        if (at.flesh < 0 && countIn(sim, shelf, CACTUS) > 0) at.flesh = t
        if (at.blossom < 0 && countIn(sim, shelf, BLOSSOM) > 0) at.blossom = t
        // Only after a blossom, so this is *its* seed and not the one that was
        // painted - nothing loose was ever put in this world.
        if (at.blossom >= 0 && at.seed < 0 && countIn(sim, shelf, SEED) > 0) at.seed = t
        if (at.seed >= 0 && at.bedded < 0 && countIn(sim, shelf, DUNED) > 0) at.bedded = t
        sim.tick()
      }

      // The column happens on every seed, and in order: the seedling first, then
      // the grower and the flesh it leaves, together.
      expect(at.nub).toBeGreaterThan(0)
      expect(at.apex).toBeGreaterThan(at.nub)
      expect(at.flesh).toBe(at.apex)
      // The crown is the draw, so it is the link that may not happen at all.
      if (at.blossom < 0) continue
      expect(at.blossom).toBeGreaterThan(at.flesh)
      // And when it does, the loop shuts: the crown dies to a seed, the seed
      // tumbles off a column one cell wide, and the sand takes it back.
      expect(at.seed).toBeGreaterThan(at.blossom)
      expect(at.bedded).toBeGreaterThan(at.seed)
      closed++
    }

    // Measured 3 of the 6. Bounded either side rather than pinned: never closing
    // would be the loop broken, and closing on all six would be `flowerP` back
    // at the meadow's 1.
    expect(closed).toBeGreaterThan(0)
    expect(closed).toBeLessThan(6)
  })

  /**
   * **The rot race** (ADR 0054 §1), which the two halves of one shelf state as a
   * contrast: a seed on stone has no bed to bury into, so its lifetime is the
   * whole of what happens to it, while the same seed on sand is bedded almost at
   * once and is a column by the time the stone half has cleared.
   *
   * **And the race is not close, which is a finding rather than a pin.** The ADR
   * has "the seed's rot clock racing a slow burial" as the desert's attrition;
   * measured, burial wins every time on an open bed - p 0.03 a contact tick
   * against 1280 ticks of clock is a coin that comes up ~1 in 10^17. Over seeds
   * 1-6, all 8 grains on the sand bedded (the first within 1-4 ticks) and all 8
   * on the stone rotted to nothing. What actually caps the desert is measured in
   * the band case below.
   */
  it('rots on stone, where there is no bed to bury into, and beds on sand', () => {
    for (const seed of [1, 2, 3]) {
      const sim = new Sim({ seed })
      for (let x = 20; x <= 280; x++) sim.paint(x, FLOOR, OBSIDIAN)
      for (let x = 160; x <= 280; x++) sim.paint(x, FLOOR - 1, SAND)
      const stone = [30, 45, 60, 75, 90, 105, 120, 135]
      const dune = [170, 185, 200, 215, 230, 245, 260, 275]
      for (const x of stone) sim.paint(x, FLOOR - 1, SEED)
      for (const x of dune) sim.paint(x, FLOOR - 2, SEED)

      // Past 8 x 250 plus the phase, as `a stranded seed` runs it: every loose
      // grain in this world has had its last draw by here.
      run(sim, 3000)

      // The stone half is bare: not a grain of it left, and nothing else either,
      // because there was nothing for a seed on stone to become.
      for (const x of stone) expect(sim.speciesAt(x, FLOOR - 1)).toBe(EMPTY)
      expect(countIn(sim, { x0: 20, x1: 159, y0: FLOOR - 20, y1: FLOOR }, SEED)).toBe(0)
      // And the sand half is a desert: all eight of its grains became plants,
      // still banked or already standing. `>=` rather than `=` because 3000
      // ticks is long enough for the first crowns to have seeded the bed again.
      const standing = columnsOn(sim, 160, 280).length
      expect(standing + count(sim, DUNED)).toBeGreaterThanOrEqual(dune.length)
      expect(standing).toBeGreaterThan(0)
    }
  })

  /**
   * **The band, measured** (ticket 04, cactus spec §5), in `life.test.ts`'
   * `the meadow loop` idiom and on the same bed: 261 cells and 7 banked seeds,
   * mud swapped for sand. Sampled every 100 ticks over seeds 1-6 to a horizon of
   * 12,000, counting *columns* rather than crowns (see `columnsOn`).
   *
   * | seed | 1000 | 2000 | 3000 | 4000 | 6000 | 8000 | 10,000 | 12,000 | peak (tick) | widest run |
   * | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
   * | 1 | 4 | 5 | 7 | 7 | 9 | 7 | 3 | 1 | 9 (4491) | 3 |
   * | 2 | 4 | 6 | 7 | 8 | 10 | 11 | 5 | 4 | 11 (6452) | 3 |
   * | 3 | 4 | 6 | 8 | 8 | 9 | 5 | 1 | 1 | 9 (5246) | 2 |
   * | 4 | 4 | 6 | 6 | 7 | 7 | 4 | 1 | 0 | 7 (3239) | 1 |
   * | 5 | 2 | 5 | 7 | 7 | 9 | 4 | 2 | 2 | 9 (4664) | 2 |
   * | 6 | 2 | 6 | 7 | 7 | 9 | 9 | 3 | 3 | 10 (7293) | 3 |
   *
   * **It is a desert, not a hedge**: 7-11 columns over 261 cells is one plant per
   * 24-37 cells of bed, and the widest shoulder-to-shoulder run over all six runs
   * is 3. Three columns get up promptly - by tick 413-1529 - so it is not barren
   * either.
   *
   * **What it is, and it is ticket 04's finding, is a run rather than a steady
   * state.** Carried past the meadow's horizon the desert empties: 0 columns,
   * 0 dunes and no flesh left by tick 11,521-18,337 on every seed. The cause is
   * arithmetic and not attrition, and it is worth stating exactly, because the
   * knob is spec §5's and so Ed's:
   *
   * - Every blossom's seed reaches the bed and beds. Counted over 24,000 ticks,
   *   burials equalled seeds born equalled blossoms, on all six seeds (16 in
   *   total). Neither the rot clock nor burial p 0.03 removed a single one.
   * - So a column's expected successors are exactly `flowerP` - **0.3, which is
   *   under one**. A bed of 7 therefore raises about `7 / (1 - 0.3)` = 10 plants
   *   in its life and then stops; measured 7, 9, 9, 9, 10, 11, 12.
   *
   * Neither of the two ticket 04 names as stop conditions, so nothing is tuned
   * here. What is pinned is the establishment and the spacing, generously, and
   * *not* the decline - a raised `flowerP` should not have to come back and edit
   * this case.
   */
  // ~7s locally (6 seeds x 12k ticks) - a shared CI runner needs more than the
  // file's 30s ceiling, the same reasoning `the meadow loop` gives.
  it('establishes a desert from a bed of banked seed, spaced rather than massed', { timeout: 180_000 }, () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = new Sim({ seed })
      desertBed(sim, 20, 280)

      let peak = 0
      let widest = 0
      let established = -1
      for (let t = 0; t <= 12000; t++) {
        if (t % 100 === 0) {
          const columns = columnsOn(sim, 20, 280)
          if (established < 0 && columns.length >= 3) established = t
          peak = Math.max(peak, columns.length)
          widest = Math.max(widest, longestRun(columns))
        }
        sim.tick()
      }

      // **Not barren**: the bed really does fill out, and promptly. Measured
      // peak 7-11 and three columns up by 413-1529 ticks.
      expect(established).toBeGreaterThan(0)
      expect(established).toBeLessThan(3000)
      expect(peak).toBeGreaterThanOrEqual(5)
      // **Not a hedge**, at either scale: the whole bed never carries more than a
      // few dozen plants, and they never stand in a wall. A desert that read as
      // scrub would break the first line; a crowding gate (deliberately not in
      // v1, spec §5) would be the answer to the second.
      expect(peak).toBeLessThan(40)
      expect(widest).toBeLessThan(8)
    }
  })
})

describe('what removes a cactus', () => {
  /**
   * **Fire cannot clear a desert** (ADR 0054 §5), and this is the case that says
   * it out loud: a flame in the middle of a stand steams the tissue it touches
   * and *never gains a cell*. Contrast a wall of wood, which carries a wave of
   * ignitions through itself until nothing is left.
   */
  it('never lets a flame spread through a stand of cactus', () => {
    const sim = new Sim({ seed: 1 })
    for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, OBSIDIAN)
    for (let y = FLOOR - 10; y < FLOOR; y++) {
      for (let x = 40; x < 60; x++) sim.paint(x, y, CACTUS)
    }
    const stand = count(sim, CACTUS)
    sim.paint(50, FLOOR - 5, FIRE)

    let mostFire = 0
    let steamed = false
    for (let i = 0; i < 300; i++) {
      sim.tick()
      mostFire = Math.max(mostFire, count(sim, FIRE))
      steamed ||= count(sim, STEAM) > 0
    }

    // **At most the one flame that was painted.** Every cactus row hands the
    // fire steam rather than fire, so there is nothing in the world that can
    // make a second flame - which is the whole ruling, stated as an invariant
    // rather than as a count.
    expect(mostFire).toBeLessThanOrEqual(1)
    // What leaves a burning cactus is its water, and that is visible: the stand
    // raises a plume rather than a fire.
    expect(steamed).toBe(true)
    // And the stand is still a stand. The flame eats the cells it touches, but
    // it is a gas with a countdown and it drifts off; measured, 188 of these 200
    // cells outlive it.
    expect(count(sim, CACTUS)).toBeGreaterThan(stand * 0.9)
  })

  /**
   * The other half of the ruling: acid and old age are what remove cacti. The
   * rows are pinned in `acid.test.ts` beside the meadow's eight; this is the
   * runtime half, and the residue is the point - spent acid leaves a grain
   * behind, because organic matter is organic matter.
   */
  it('lets acid eat a column and leave sulphur behind, one grain per cell', () => {
    const sim = new Sim({ seed: 1 })
    for (let x = 40; x < 61; x++) sim.paint(x, FLOOR, OBSIDIAN)
    for (let y = FLOOR - 20; y < FLOOR; y++) {
      sim.paint(39, y, OBSIDIAN)
      sim.paint(61, y, OBSIDIAN)
    }
    for (let x = 40; x < 61; x++) {
      for (let y = FLOOR - 3; y < FLOOR; y++) sim.paint(x, y, CACTUS)
    }
    // Poured rather than wedged, as `acid.test.ts` pours: a chunk with nothing
    // moving in it sleeps, and a sleeping cell is never offered a reaction.
    for (let x = 45; x < 56; x++) {
      for (let y = FLOOR - 12; y < FLOOR - 8; y++) sim.paint(x, y, ACID)
    }
    const acidBefore = count(sim, ACID)
    const fleshBefore = count(sim, CACTUS)

    run(sim, 120)

    const eaten = fleshBefore - count(sim, CACTUS)
    expect(eaten).toBeGreaterThan(0)
    expect(acidBefore - count(sim, ACID)).toBe(eaten)
    expect(count(sim, SULPHUR)).toBe(eaten)
  })

  /**
   * The same ruling swept over a whole bed, and the half that makes it matter
   * (ticket 04): a fire laid along a desert takes the flesh it can reach and
   * **loses not one banked seed**, which is what turns a burnt desert into one
   * generation of regrowth rather than an ending. `life.test.ts`' `survives a
   * fire swept over the bed, seed for seed` is the meadow's version of this case.
   *
   * Counted as a ledger rather than as `duned`, for that case's reason: fire
   * clearing the bed is also fire *opening the sky*, so a dune the flames could
   * not touch may germinate into the burn a moment later. A bank is therefore
   * accounted for if it is still a dune or already standing over its own cell.
   *
   * Measured over seeds 1-6, all four banks survived every run, and the flame
   * never once gained a cell on the 21 that were painted. The column is a
   * different matter and deliberately not asserted here: 21 flames poured onto
   * one column *do* eat it (12 cells of flesh went to 1-27, counting regrowth),
   * because fire not spreading is not fire not burning. What that costs a stand
   * rather than a single column is the case above.
   */
  it('sweeps a fire over a desert bed and loses not one banked seed', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = new Sim({ seed })
      for (let x = 39; x <= 61; x++) sim.paint(x, FLOOR, OBSIDIAN)
      for (let x = 40; x <= 60; x++) sim.paint(x, FLOOR - 1, SAND)
      const banks = [42, 46, 54, 58]
      for (const x of banks) sim.paint(x, FLOOR - 1, DUNED)
      for (let i = 2; i <= 13; i++) sim.paint(50, FLOOR - i, CACTUS)
      const painted = count(sim, FIRE)
      for (let x = 40; x <= 60; x++) sim.paint(x, FLOOR - 2, FIRE)

      let mostFire = 0
      let steamed = false
      for (let t = 0; t < 300; t++) {
        sim.tick()
        mostFire = Math.max(mostFire, count(sim, FIRE))
        steamed ||= count(sim, STEAM) > 0
      }

      const accounted = banks.filter(
        (x) => sim.speciesAt(x, FLOOR - 1) === DUNED || isColumn(sim.speciesAt(x, FLOOR - 2)),
      )
      expect(accounted).toEqual(banks)
      // Never a cell more than was laid down: a burning cactus hands the flame
      // steam, so there is nothing in this world that can make a second flame.
      expect(mostFire).toBeLessThanOrEqual(painted + 21)
      expect(steamed).toBe(true)
    }
  })

  /**
   * And the bank underneath survives the fire, which is what lets a burnt desert
   * regrow: `duned` carries no `flammable` tag, so no ignition row can reach the
   * pair at all - exactly `buried`'s trick, and the reason acid is the only
   * thing in the roster that clears a bank.
   */
  it('leaves the bank fire-proof and acid-erasable, with no residue either way', () => {
    expect(registry.reactionFor(FIRE, DUNED)).toBeUndefined()
    // The `[solid]` tag row reaches it, and leaves nothing: a bedded seed is
    // spent material, like ember, ash and `buried`.
    expect(registry.reactionFor(ACID, DUNED)).toMatchObject({
      aBecomes: EMPTY,
      bBecomes: EMPTY,
    })
  })
})
