import { describe, expect, it } from 'vitest'

import {
  DIRT,
  EMBER,
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

  // Ember is what makes wood read as wood (burnables spec §2): it chars and
  // glows rather than flashing, and it is already burning, so it carries no
  // `flammable` tag and no fuel row of its own can reach it.
  it('boots the ember as a glowing char that is not itself a fuel', () => {
    expect(EMBER).toBe(18)
    expect(registry.get(EMBER)?.tags).toEqual(['solid'])
    expect(registry.has(EMBER, 'flammable')).toBe(false)
    // As wood: acid's `[solid]` rows at maxHardness 1 still reach a smoldering
    // wall, so it is no more acid-proof than the wood it came from.
    expect(registry.get(EMBER)?.hardness).toBe(1)
    // 120 + 60 is under MAX_LIFETIME_TICKS (255), and the countdown owns `ra`
    // - which is why ember is static: no opinion field to collide with.
    // `every: 1` is the default the registry fills in: a tick-by-tick countdown,
    // which is every lifetime on the roster (life ticket 01).
    expect(registry.lifetimeOf(EMBER)).toEqual({
      ticks: 120,
      jitter: 60,
      every: 1,
      becomes: FIRE,
    })
    expect(registry.get(EMBER)?.archetype).toEqual({ kind: 'static' })
    // The mass rule (ADR 0040): four shades, base first.
    expect(registry.get(EMBER)?.colours).toHaveLength(4)
  })

  // Rows 1–16 are this group's; later groups append to the same table, so this
  // pins the head of it rather than the whole thing.
  it('registers rows 1–16 in the declared order', () => {
    expect(v1Reactions.slice(0, 16).map((row) => [row.a, row.b])).toEqual([
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
  it('ranks the fuels by ignition rate, flash powder down to a slow mat', () => {
    const p = (fuel: number) => registry.reactionFor(FIRE, fuel)?.p

    expect(p(SULPHUR)).toBe(1)
    expect(p(SULPHUR)).toBeGreaterThan(p(OIL)!)
    expect(p(OIL)).toBeGreaterThan(p(VINE)!)
    expect(p(VINE)).toBeGreaterThan(p(SEED)!)
    expect(p(SEED)).toBeGreaterThan(p(MOSS)!)
  })

  // The ordering trap, on the ember's side: wood is flammable, so both tag rows
  // cover these pairs too, and `resolvePairs` keeps the first registration and
  // drops the rest without a word. Reorder the table and wood silently goes
  // back to flashing - these two assertions are what turn that into a failure.
  it('chars wood to ember rather than lighting it, from fire and from lava alike', () => {
    expect(registry.reactionFor(FIRE, WOOD)).toMatchObject({ aBecomes: FIRE, bBecomes: EMBER })
    expect(registry.reactionFor(LAVA, WOOD)).toMatchObject({ aBecomes: LAVA, bBecomes: EMBER })
    // Reached from the wood side the answer is the same pair, sides swapped.
    expect(registry.reactionFor(WOOD, FIRE)).toMatchObject({ aBecomes: EMBER, bBecomes: FIRE })
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

  // The contact point chars rather than catching (spec §2): whatever the draw
  // does, the cell on the wood side is never fire.
  it('chars the wood it touches rather than lighting it', () => {
    const touched = RNG_SEEDS.map((seed) => {
      const sim = new Sim({ seed })
      pocket(sim, 100, FIRE, WOOD)

      sim.tick()

      return sim.speciesAt(101, FLOOR - 1)
    })

    // Never fire, whichever way the draw went: that is the invariant.
    expect(touched.filter((species) => species !== WOOD && species !== EMBER)).toEqual([])
    // p 0.2, plus the fire cell's own draw at the same pair, so this reads a
    // little above the row - measured, 11 of the 40 seeds. Both ends matter: no
    // ember at all would be a missing row, and every seed charring would be
    // certainty the row does not claim.
    const charred = touched.filter((species) => species === EMBER)
    expect(charred.length).toBeGreaterThan(0)
    expect(charred.length).toBeLessThan(RNG_SEEDS.length)
  })

  // The creep (spec §2). The first window is deliberately under the 120-tick
  // floor on the ember's own life, so it sees the `ember + wood` row and
  // nothing else - no eruption, and none of the fire an eruption spawns.
  it('creeps along a wood beam through orthogonal contacts only', () => {
    let cleared = 0
    const BEAM = 11
    const beam = (seed: number) => {
      const sim = new Sim({ seed })
      for (let x = 100; x <= 110; x++) sim.paint(x, 100, WOOD)
      // A cell touching the beam's lit end at a corner and nowhere else.
      sim.paint(99, 99, WOOD)
      sim.paint(100, 100, EMBER)
      return sim
    }
    const beamHolds = (sim: Sim, species: number) => {
      let held = 0
      for (let x = 100; x < 100 + BEAM; x++) if (sim.speciesAt(x, 100) === species) held++
      return held
    }

    for (const seed of RNG_SEEDS) {
      const sim = beam(seed)
      run(sim, 100)

      // The glow has spread - measured, 2 to 10 cells over these seeds at
      // p 0.02 a contact - and nothing has erupted yet.
      const lit = count(sim, EMBER)
      expect(lit).toBeGreaterThan(1)
      expect(count(sim, FIRE)).toBe(0)
      // Into the beam and nowhere else: a contiguous run from the lit end.
      for (let x = 100; x < 100 + lit; x++) expect(sim.speciesAt(x, 100)).toBe(EMBER)
      // The corner is an invariant, not a probability: `applyReactions` counts
      // orthogonal contacts only, so no seed may ever reach the diagonal cell
      // inside this window. Past it the eruption's fire drifts and does reach
      // it, which is movement rather than contact and is not this row's story.
      expect(sim.speciesAt(99, 99)).toBe(WOOD)

      // And the burn carries along the beam: creep, eruption and the fire the
      // eruption leaves take it end to end. Measured, the slowest of these
      // seeds clears at tick 390, so 800 is roughly twice the horizon it needs.
      run(sim, 700)
      const left = beamHolds(sim, WOOD)
      if (left === 0) cleared++
      // Bar a stub, and only ever at the far end. A floating beam is the one
      // arrangement where the burn can strand itself: the last ember of the
      // creep front may erupt before its 0.02 draw on the next cell lands, and
      // the flame that eruption makes is a *gas* with nothing under the beam to
      // hold it, so it rises away and there is then nothing left in the world
      // that can light what remains. Measured over these 40 seeds at ticket
      // 04's `fire + ember` p of 0.003: one seed (22) keeps its last two cells.
      // A stub on a beam in mid-air is a legible ending; a *structure* has more
      // contact and does not do this - the cabin scene of ticket 04 burns to
      // zero wood on every seed it was measured on.
      //
      // Bounded as a *share of the beam* rather than at the measured maximum,
      // so what it says is "the burn crossed the beam" - a two-cell stub with
      // no slack beside it would be pinning the draws all over again.
      expect(left).toBeLessThan(BEAM / 3)
    }
    // And stranding stays the exception rather than the rule, which is the half
    // of it worth pinning: at 0.05 every one of these seeds cleared, and the
    // lower p trades a couple of them for the eruptions it buys elsewhere.
    expect(cleared).toBeGreaterThan(RNG_SEEDS.length * 0.9)
  })

  it('erupts into open flame once nothing is left to smolder, and that flame dies to smoke', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 0, EMBER)

    // `jitter` is added, never subtracted, so an unfed ember glows for 120–180
    // ticks: long enough to read as a smolder, not long enough to stall.
    let erupted = 0
    for (let i = 1; i <= 181 && erupted === 0; i++) {
      sim.tick()
      if (count(sim, FIRE) > 0) erupted = i
    }

    expect(erupted).toBeGreaterThanOrEqual(120)
    expect(erupted).toBeLessThanOrEqual(180)
    expect(count(sim, EMBER)).toBe(0)

    // And from there it is fire like any other: 40–60 ticks, then smoke.
    run(sim, 61)
    expect(count(sim, FIRE)).toBe(0)
    expect(count(sim, SMOKE)).toBe(1)
  })

  // The douse (spec §2) - the new player verb: a smoldering structure can be
  // saved. Quenching to wood rather than to char keeps the roster tight.
  it('lets water save a smoldering structure, quenching the ember back to wood', () => {
    const sim = new Sim({ seed: 1 })
    pocket(sim, 100, WATER, EMBER)

    sim.tick()

    expect(sim.speciesAt(100, FLOOR - 1)).toBe(STEAM)
    expect(sim.speciesAt(101, FLOOR - 1)).toBe(WOOD)
  })

  // Was `keeps burning while it is touching wood`, which asserted a wall of
  // wood entirely gone inside 70 ticks. With the ember that timeline is wrong
  // by design, so this asserts the new story rather than a loosened old one:
  // char, crawl, erupt. Its point is the same one - a torched wall goes on
  // burning long past a lone fire cell's 60-tick ceiling - but what carries the
  // burn now is the char rather than a wave of ignitions through the wood.
  it('smolders through a wall of wood rather than detonating it', () => {
    const sim = new Sim({ seed: 1 })
    for (let y = FLOOR - 12; y <= FLOOR; y++) {
      for (let x = 40; x < 60; x++) sim.paint(x, y, WOOD)
    }
    sim.paint(50, FLOOR - 6, FIRE)

    run(sim, 70)

    // Charring, and nowhere near consumed: this is the whole change. Measured,
    // 92 of the wall's 260 cells glow here and the other 166 are still wood.
    expect(count(sim, EMBER)).toBeGreaterThan(0)
    expect(count(sim, WOOD)).toBeGreaterThan(0)
    // **At most** the one flame that was painted - the assertion that says the
    // fire has not *spread*. Ember carries no `flammable` tag, so the contacts
    // it charred are not fuel any ignition row can reach, and a wall of char
    // can therefore never carry a wave of ignitions through itself.
    //
    // Whether that one cell is still *alight* at tick 70 is deliberately not
    // pinned, and the reason is ticket 04's retune. The ash branch
    // (`fire + ember -> fire + ash`) rewrites the fire side, and a rewrite
    // clears `ra`, so a walled-in flame is renewed every time it burns a
    // neighbour down to residue - at ticket 03's p of 0.05 that happened often
    // enough that "still exactly 1" was an invariant, and at ticket 04's 0.003
    // it is a coin the draws decide (measured: alight on seeds 1-5 of this
    // wall, out by tick 70 on some seeds of others). Pinning `=== 1` here would
    // be pinning that coin, so the bound is one-sided.
    expect(count(sim, FIRE)).toBeLessThanOrEqual(1)

    // Then the char erupts, and the open flame it becomes is what finishes the
    // wall off. Slow, in other words, not stalled. Counted as *more* flame than
    // the one cell above rather than as "any flame at all", which a still-lit
    // torch would satisfy for free - measured, the eruptions take it to 100
    // cells inside this window.
    let mostFire = 0
    for (let i = 0; i < 250; i++) {
      sim.tick()
      mostFire = Math.max(mostFire, count(sim, FIRE))
    }

    expect(mostFire).toBeGreaterThan(1)
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

    // "Lit" now means either product: oil catches, wood chars to ember first
    // (spec §2). Lava reaches both through its own rows, not the tag row.
    let lit = false
    for (let i = 0; i < 60 && !lit; i++) {
      sim.tick()
      lit = count(sim, FIRE) + count(sim, EMBER) > 0
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
