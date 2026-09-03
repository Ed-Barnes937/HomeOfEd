import { describe, expect, it } from 'vitest'

import { BYTES_PER_CELL, GRID_HEIGHT, GRID_WIDTH, RA_OFFSET } from './constants.ts'
import { EMPTY, LAVA, OBSIDIAN, OIL, SAND, WATER, v1Elements } from './elements.ts'
import { MOMENTUM_TICKS, momentumOf, packOpinion, parityOf } from './kernels.ts'
import { Sim } from './sim.ts'
import type { ElementDef } from './types.ts'

const FLOOR = GRID_HEIGHT - 1

/** Obsidian, not dirt: water turns dirt into mud (materials spec §4 row 10),
 * and these cases are about how a liquid moves, not what it reacts with. */
function withFloor(sim: Sim): Sim {
  for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, OBSIDIAN)
  return sim
}

/** Every cell of a species, as `{ x, y }` — enough to describe a puddle. */
function cellsOf(sim: Sim, species: number): { x: number; y: number }[] {
  const found: { x: number; y: number }[] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (sim.speciesAt(x, y) === species) found.push({ x, y })
    }
  }
  return found
}

/** A column `height` tall sitting on the floor, centred on `x`. */
function pourColumn(sim: Sim, x: number, height: number, species: number): void {
  for (let i = 1; i <= height; i++) sim.paint(x, FLOOR - i, species)
}

/** A one-cell-wide shaft, so a liquid inside it can only move vertically. */
function wellAt(sim: Sim, x: number, depth: number): Sim {
  withFloor(sim)
  for (let i = 1; i <= depth; i++) {
    sim.paint(x - 1, FLOOR - i, OBSIDIAN)
    sim.paint(x + 1, FLOOR - i, OBSIDIAN)
  }
  return sim
}

/** A floor with a wall at either end, so a pool inside it is conserved. */
function basinBetween(sim: Sim, left: number, right: number, height: number): Sim {
  withFloor(sim)
  for (let i = 1; i <= height; i++) {
    sim.paint(left, FLOOR - i, OBSIDIAN)
    sim.paint(right, FLOOR - i, OBSIDIAN)
  }
  return sim
}

function raAt(sim: Sim, x: number, y: number): number {
  return sim.cells[(y * GRID_WIDTH + x) * BYTES_PER_CELL + RA_OFFSET]!
}

type Place = (x: number, y: number, species: number, ra?: number) => void

/**
 * A world built plane by plane and loaded with `restore` — the only way to
 * start a cell with an `ra` already set, which is what a current *already
 * running* looks like. `paint` clears the scratch bytes.
 */
function restoreWith(sim: Sim, place: (put: Place) => void): void {
  const size = GRID_WIDTH * GRID_HEIGHT
  const species = new Uint8Array(size)
  const ra = new Uint8Array(size)
  place((x, y, id, scratch = 0) => {
    species[y * GRID_WIDTH + x] = id
    ra[y * GRID_WIDTH + x] = scratch
  })
  sim.restore(species, ra, new Uint8Array(size))
}

describe('liquid movement', () => {
  it('falls one cell per tick while nothing is under it', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 10, WATER)

    sim.tick()

    expect(sim.speciesAt(10, 10)).toBe(EMPTY)
    expect(sim.speciesAt(10, 11)).toBe(WATER)
  })

  /**
   * **Oil rather than water since life ticket 05.** These two cases are about
   * the *kernel* - spreading, levelling, and then going quiet (ADR 0038) - and a
   * one-cell-deep sheet of water on open ground is no longer a resting state: it
   * is a film, and it lifts as steam (`evaporation.ts`, ADR 0044). Oil is the
   * roster's other plain liquid and carries no hook, so the claim survives the
   * chemistry. Its `move` throttle is half water's pace, which is the whole of
   * why the tick budgets here are doubled.
   */
  it('spreads sideways along a floor it cannot fall through', () => {
    const sim = withFloor(new Sim({ seed: 1 }))
    pourColumn(sim, 150, 12, OIL)

    for (let i = 0; i < 400; i++) sim.tick()

    const water = cellsOf(sim, OIL)
    expect(water).toHaveLength(12)

    // A column 12 tall has levelled when it is no longer 12 tall and has
    // reached cells the column never occupied.
    const top = Math.min(...water.map((c) => c.y))
    const span = Math.max(...water.map((c) => c.x)) - Math.min(...water.map((c) => c.x)) + 1
    expect(top).toBeGreaterThan(FLOOR - 12)
    expect(span).toBeGreaterThan(1)
  })

  it('flattens to one layer on open ground and lets the world go quiet', () => {
    const sim = withFloor(new Sim({ seed: 1 }))
    pourColumn(sim, 150, 12, OIL)

    for (let i = 0; i < 800; i++) sim.tick()

    const water = cellsOf(sim, OIL)
    expect(water).toHaveLength(12)
    expect(water.every((c) => c.y === FLOOR - 1)).toBe(true)
    // And then stops dead. Under the coin this never quite happened — a cell
    // with a neighbour drew a fresh direction every tick and kept finding one
    // of its two sides open, so a levelled pool shuffled for ever. A cell that
    // commits to one direction runs out of moves and writes nothing, which is
    // what finally lets the chunk sleep (ADR 0038).
    expect(sim.scannedLastTick).toBe(0)
  })

  it('does not displace an equally dense neighbour', () => {
    // Two water cells stacked on the floor must not trade places forever.
    const sim = withFloor(new Sim({ seed: 1 }))
    sim.paint(10, FLOOR - 1, WATER)
    sim.paint(10, FLOOR - 2, WATER)

    for (let i = 0; i < 50; i++) sim.tick()

    expect(cellsOf(sim, WATER)).toHaveLength(2)
  })

  it('lets a denser powder sink through it', () => {
    const sim = wellAt(new Sim({ seed: 1 }), 150, 8)
    pourColumn(sim, 150, 6, WATER)
    sim.paint(150, FLOOR - 7, SAND)

    for (let i = 0; i < 60; i++) sim.tick()

    // The grain sank to the bottom of the well and the water closed over it.
    expect(sim.speciesAt(150, FLOOR - 1)).toBe(SAND)
    expect(sim.speciesAt(150, FLOOR - 2)).toBe(WATER)
  })
})

/**
 * Sandspiel's opinion field (ticket 01, ADR 0038): a liquid keeps its lateral
 * direction in `ra` rather than re-rolling it every tick, spreads that opinion
 * to a neighbour whenever it moves, and holds it against a wall for a few
 * frames before turning around.
 */
describe('liquid direction persistence', () => {
  /** Parity 0 is leftward, 1 is rightward — the kernel reads bit 0 as a sign. */
  const LEFT = 0
  const RIGHT = 1

  /**
   * A throwaway liquid that spends `ra` on a countdown. No liquid in the roster
   * declares a `lifetime`, so this is the only way to reach the `raIsFree` gate
   * — and the gate is the whole reason the opinion field is safe to add.
   */
  const BRINE_TICKS = 200
  const brine: ElementDef = {
    id: 101,
    name: 'brine',
    colours: ['#7fb2c8'],
    tags: ['liquid'],
    archetype: { kind: 'liquid', density: 30, dispersion: 5 },
    lifetime: { ticks: BRINE_TICKS, becomes: null },
  }

  it('stands down for a liquid that spends `ra` on a lifetime', () => {
    // Walled in and stacked, so the cell is not a stray and the lateral step
    // really is reached. On the first tick `ra` is still 0, which reads as
    // "not seeded yet" to the opinion field *and* to the countdown — so an
    // ungated kernel would write a parity here and the cell would then age from
    // 128 rather than from 200.
    const sim = wellAt(new Sim({ seed: 1, elements: [...v1Elements, brine] }), 150, 8)
    sim.paint(150, FLOOR - 1, brine.id)
    sim.paint(150, FLOOR - 2, brine.id)

    for (let i = 0; i < 5; i++) sim.tick()

    expect(raAt(sim, 150, FLOOR - 1)).toBe(BRINE_TICKS - 5)
  })

  /** Fraction of side-by-side water pairs that want to go the same way. */
  function agreementIn(sim: Sim): number {
    let pairs = 0
    let agreed = 0
    for (const c of cellsOf(sim, WATER)) {
      if (sim.speciesAt(c.x + 1, c.y) !== WATER) continue
      pairs++
      if (parityOf(raAt(sim, c.x, c.y)) === parityOf(raAt(sim, c.x + 1, c.y))) agreed++
    }
    expect(pairs).toBeGreaterThan(50)
    return agreed / pairs
  }

  it('seeds a fresh pour with both directions rather than letting it lean', () => {
    const sim = basinBetween(new Sim({ seed: 1 }), 100, 160, 20)
    for (let x = 105; x < 125; x++) pourColumn(sim, x, 10, WATER)

    for (let i = 0; i < 25; i++) sim.tick()

    // `paint` clears `ra`, so a pour arrives with no opinion at all. Every cell
    // must draw one, and bit 7 is what stops a cell whose parity and momentum
    // are both spent from reading as unseeded and drawing again.
    const water = cellsOf(sim, WATER)
    expect(water.every((c) => raAt(sim, c.x, c.y) !== 0)).toBe(true)
    expect(new Set(water.map((c) => parityOf(raAt(sim, c.x, c.y))))).toEqual(new Set([LEFT, RIGHT]))
  })

  it('spreads one opinion through a pool that starts divided', () => {
    // The worst case for contagion: a pool in which every neighbour disagrees.
    const sim = new Sim({ seed: 1 })
    restoreWith(sim, (put) => {
      for (let x = 0; x < GRID_WIDTH; x++) put(x, FLOOR, OBSIDIAN)
      for (let i = 1; i <= 20; i++) {
        put(100, FLOOR - i, OBSIDIAN)
        put(160, FLOOR - i, OBSIDIAN)
      }
      for (let x = 105; x < 125; x++) {
        for (let i = 1; i <= 10; i++) put(x, FLOOR - i, WATER, packOpinion((x + i) & 1, 0))
      }
    })
    expect(agreementIn(sim)).toBe(0)

    for (let i = 0; i < 100; i++) sim.tick()

    // Every successful step recruits one neighbour, so the body votes itself
    // into currents. It never reaches 1: the pool is open at the top, and cells
    // at the ends of the surface go on turning around.
    expect(agreementIn(sim)).toBeGreaterThan(0.7)
  })

  it('presses against a wall for the momentum window before turning around', () => {
    // Three cells of a current already running rightwards into a wall. Only the
    // leftmost has an open cell behind it, so it is the one that can turn.
    const sim = new Sim({ seed: 1 })
    const running = packOpinion(RIGHT, MOMENTUM_TICKS)
    restoreWith(sim, (put) => {
      for (let x = 0; x < GRID_WIDTH; x++) put(x, FLOOR, OBSIDIAN)
      put(20, FLOOR - 1, OBSIDIAN)
      // **Lidded since life ticket 05.** The current is one cell deep, so under
      // an open sky every cell of it is a film with a draw to make every tick
      // (`evaporation.ts`) - which moves the shared PRNG stream out from under
      // an assertion that is about the opinion byte and nothing else. Roofed,
      // the hook returns before it draws and the current is left alone.
      for (const x of [16, 17, 18, 19, 20]) put(x, FLOOR - 2, OBSIDIAN)
      for (const x of [17, 18, 19]) put(x, FLOOR - 1, WATER, running)
    })

    for (let tick = 1; tick <= MOMENTUM_TICKS; tick++) {
      sim.tick()
      const ra = raAt(sim, 17, FLOOR - 1)
      expect(parityOf(ra)).toBe(RIGHT)
      expect(momentumOf(ra)).toBe(MOMENTUM_TICKS - tick)
    }

    // Momentum spent, and an open cell behind: now it turns.
    sim.tick()
    expect(parityOf(raAt(sim, 17, FLOOR - 1))).toBe(LEFT)

    sim.tick()
    expect(Math.min(...cellsOf(sim, WATER).map((c) => c.x))).toBeLessThan(17)
  })

  it('levels a stepped pool across the step', () => {
    const sim = basinBetween(new Sim({ seed: 1 }), 100, 160, 20)
    // A shelf five cells tall over the right half of the bed.
    for (let x = 131; x < 160; x++) {
      for (let d = 1; d <= 5; d++) sim.paint(x, FLOOR - d, OBSIDIAN)
    }
    for (let x = 101; x <= 130; x++) pourColumn(sim, x, 12, WATER)

    for (let i = 0; i < 600; i++) sim.tick()

    const water = cellsOf(sim, WATER)
    expect(water).toHaveLength(30 * 12)

    const surfaceOf = (from: number, to: number) => {
      const side = water.filter((c) => c.x >= from && c.x <= to)
      expect(side).not.toHaveLength(0)
      return Math.min(...side.map((c) => c.y))
    }
    // Water stands over the shelf, and at the same height as over the deep end.
    expect(Math.abs(surfaceOf(101, 130) - surfaceOf(131, 159))).toBeLessThanOrEqual(2)
  })
})

/**
 * Momentum steers the fall (ADR 0041): a liquid that still has momentum in its
 * `ra` falls diagonally in its parity direction, spending one momentum per
 * step, instead of straight down. Only a cell whose last act was a successful
 * lateral spread carries momentum, so the pour stream and a fresh drop still
 * fall straight; the arc is what throws cells stripped off a plateau clear of
 * its vertical faces, which is what lets a poured block shed from three
 * surfaces instead of one (`.scratch/silt-water-towers/spec.md`).
 */
describe('liquid momentum steers the fall', () => {
  const LEFT = 0
  const RIGHT = 1

  it('falls diagonally in its parity direction, spending one momentum per step', () => {
    const sim = new Sim({ seed: 1 })
    restoreWith(sim, (put) => {
      put(10, 10, WATER, packOpinion(RIGHT, MOMENTUM_TICKS))
      put(50, 10, WATER, packOpinion(LEFT, MOMENTUM_TICKS))
    })

    sim.tick()

    expect(sim.speciesAt(11, 11)).toBe(WATER)
    expect(sim.speciesAt(49, 11)).toBe(WATER)
    for (const x of [11, 49]) {
      expect(momentumOf(raAt(sim, x, 11))).toBe(MOMENTUM_TICKS - 1)
    }
  })

  it('falls straight once momentum is spent', () => {
    const sim = new Sim({ seed: 1 })
    restoreWith(sim, (put) => {
      put(10, 10, WATER, packOpinion(RIGHT, 0))
    })

    sim.tick()

    expect(sim.speciesAt(10, 11)).toBe(WATER)
  })

  it('falls straight when the diagonal is blocked, keeping its momentum', () => {
    const sim = new Sim({ seed: 1 })
    restoreWith(sim, (put) => {
      put(10, 10, WATER, packOpinion(RIGHT, MOMENTUM_TICKS))
      put(11, 11, OBSIDIAN)
    })

    sim.tick()

    expect(sim.speciesAt(10, 11)).toBe(WATER)
    expect(momentumOf(raAt(sim, 10, 11))).toBe(MOMENTUM_TICKS)
  })

  /** Highest water column minus the median column: how far from level. */
  function towerExcess(sim: Sim): number {
    const heights: number[] = []
    for (let x = 0; x < GRID_WIDTH; x++) {
      for (let y = 0; y < FLOOR; y++) {
        if (sim.speciesAt(x, y) === WATER) {
          heights.push(FLOOR - y)
          break
        }
      }
    }
    heights.sort((a, b) => a - b)
    if (heights.length === 0) return 0
    return Math.max(0, heights[heights.length - 1]! - heights[heights.length >> 1]!)
  }

  it('levels a solid block on a floor in bounded ticks', () => {
    // The spec's mechanism-2 scenario: without the drift the same block still
    // shows excess 14 at t=200 (probe, seed 1); with it, 3.
    const sim = withFloor(new Sim({ seed: 1 }))
    for (let y = FLOOR - 40; y <= FLOOR - 1; y++) {
      for (let x = 135; x < 165; x++) sim.paint(x, y, WATER)
    }

    for (let i = 0; i < 200; i++) sim.tick()

    expect(towerExcess(sim)).toBeLessThan(5)
  })

  it('collapses a poured column in bounded ticks once the pour stops', () => {
    // The pour that motivated the epic: a fat stream held long enough to grow
    // a standing block, then stopped. Without the drift this pour's remnant
    // tower still shows excess 10 two hundred ticks after the pour ends; with
    // it, 6. (The spec harness's longer pour measured 18 -> 6.)
    const sim = withFloor(new Sim({ seed: 1 }))
    for (let tick = 0; tick < 150; tick++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy <= 4) sim.paint(150 + dx, 20 + dy, WATER)
        }
      }
      sim.tick()
    }

    for (let i = 0; i < 200; i++) sim.tick()

    expect(towerExcess(sim)).toBeLessThan(8)
  })
})

describe('move probability', () => {
  it('makes lava fall far slower than water', () => {
    const water = new Sim({ seed: 1 })
    water.paint(10, 0, WATER)
    const lava = new Sim({ seed: 1 })
    lava.paint(10, 0, LAVA)

    for (let i = 0; i < 10; i++) {
      water.tick()
      lava.tick()
    }

    expect(water.speciesAt(10, 10)).toBe(WATER)
    // move: 0.15 — roughly one or two steps in ten ticks, never ten.
    const fell = cellsOf(lava, LAVA)[0]!.y
    expect(fell).toBeLessThan(5)
  })

  it('makes oil fall slower than water but quicker than lava', () => {
    const water = new Sim({ seed: 1 })
    water.paint(10, 0, WATER)
    const oil = new Sim({ seed: 1 })
    oil.paint(10, 0, OIL)

    for (let i = 0; i < 10; i++) {
      water.tick()
      oil.tick()
    }

    expect(water.speciesAt(10, 10)).toBe(WATER)
    // move: 0.5 - roughly five steps in ten ticks, never all ten. The floor of
    // 3 is what separates "viscous" from lava's ooze (0.15, pinned above at
    // fewer than 5): oil is still a liquid, not tar.
    const fell = cellsOf(oil, OIL)[0]!.y
    expect(fell).toBeLessThan(9)
    expect(fell).toBeGreaterThanOrEqual(3)
  })

  /**
   * These two pin `canFlow` to what the kernel actually tries: one case where a
   * declined step *was* available, one where it was not. Let them drift apart
   * and a slow liquid either freezes in mid-air or never lets its chunk sleep.
   */
  it('keeps its chunk awake while it has somewhere left to go', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 100, LAVA)

    for (let i = 0; i < 30; i++) sim.tick()

    expect(sim.scannedLastTick).toBeGreaterThan(0)
    expect(cellsOf(sim, LAVA)[0]!.y).toBeGreaterThan(100)
  })

  it('lets its chunk sleep once it is walled in', () => {
    const sim = wellAt(new Sim({ seed: 1 }), 150, 4)
    sim.paint(150, FLOOR - 1, LAVA)

    for (let i = 0; i < 30; i++) sim.tick()

    expect(sim.speciesAt(150, FLOOR - 1)).toBe(LAVA)
    expect(sim.scannedLastTick).toBe(0)
  })

  it('still reaches the floor eventually', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, FLOOR - 20, LAVA)

    // Twenty cells at roughly one step in seven — comfortably inside 400 ticks.
    for (let i = 0; i < 400; i++) sim.tick()

    expect(cellsOf(sim, LAVA).map((c) => c.y)).toEqual([FLOOR])
  })
})

/** A throwaway gas: this suite tests the archetype, not the roster's gases. */
const plume: ElementDef = {
  id: 100,
  name: 'plume',
  colours: ['#cfd6da'],
  tags: ['gas'],
  archetype: { kind: 'gas', density: -20, dispersion: 3 },
}

describe('gas movement', () => {
  it('rises one cell per tick', () => {
    const sim = new Sim({ seed: 1, elements: [...v1Elements, plume] })
    sim.paint(10, 10, plume.id)

    sim.tick()

    expect(sim.speciesAt(10, 10)).toBe(EMPTY)
    expect(sim.speciesAt(10, 9)).toBe(plume.id)
  })

  it('stops at the ceiling', () => {
    const sim = new Sim({ seed: 1, elements: [...v1Elements, plume] })
    sim.paint(10, 0, plume.id)

    for (let i = 0; i < 5; i++) sim.tick()

    expect(cellsOf(sim, plume.id).map((c) => c.y)).toEqual([0])
  })

  it('bubbles up through a denser liquid', () => {
    const sim = withFloor(new Sim({ seed: 1, elements: [...v1Elements, plume] }))
    pourColumn(sim, 150, 8, WATER)
    sim.paint(150, FLOOR - 1, plume.id)

    for (let i = 0; i < 40; i++) sim.tick()

    const bubble = cellsOf(sim, plume.id)
    expect(bubble).toHaveLength(1)
    // Negative density means the water sinks past it rather than the other way
    // round, but the bubble still ends up above the water it started under.
    expect(cellsOf(sim, WATER).filter((c) => c.y > bubble[0]!.y)).not.toHaveLength(0)
  })
})

describe('liquid determinism', () => {
  const pourBoth = (sim: Sim) => {
    withFloor(sim)
    for (let x = 140; x < 160; x++) pourColumn(sim, x, 10, WATER)
    for (let x = 100; x < 110; x++) pourColumn(sim, x, 6, LAVA)
  }

  it('same seed gives an identical grid', () => {
    const a = new Sim({ seed: 0xfeed })
    const b = new Sim({ seed: 0xfeed })
    pourBoth(a)
    pourBoth(b)

    for (let i = 0; i < 120; i++) {
      a.tick()
      b.tick()
    }

    expect(a.cells).toEqual(b.cells)
  })
})
