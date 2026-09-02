import { describe, expect, it, vi } from 'vitest'

import { DIRT, EMPTY, LAVA, OBSIDIAN, SAND, WATER } from './elements.ts'
import { GRID_HEIGHT, GRID_WIDTH, VARIANT_SLOTS } from './constants.ts'
import { Sim } from './sim.ts'

const FLOOR = GRID_HEIGHT - 1

/** Dirt across the bottom row — the surface most of these cases land on. */
function withDirtFloor(sim: Sim): Sim {
  for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, DIRT)
  return sim
}

describe('powder movement', () => {
  it('falls exactly one cell per tick', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 10, SAND)

    sim.tick()

    expect(sim.speciesAt(10, 10)).toBe(EMPTY)
    expect(sim.speciesAt(10, 11)).toBe(SAND)
  })

  it('stops at the floor', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, FLOOR, SAND)

    for (let i = 0; i < 5; i++) sim.tick()

    expect(sim.speciesAt(10, FLOOR)).toBe(SAND)
  })

  it('rests on dirt when both diagonals are blocked', () => {
    const sim = withDirtFloor(new Sim({ seed: 1 }))
    sim.paint(10, FLOOR - 1, SAND)

    for (let i = 0; i < 5; i++) sim.tick()

    expect(sim.speciesAt(10, FLOOR - 1)).toBe(SAND)
  })

  it('slides off a pile', () => {
    const sim = withDirtFloor(new Sim({ seed: 1 }))
    sim.paint(10, FLOOR - 1, DIRT)
    sim.paint(10, FLOOR - 2, SAND)

    for (let i = 0; i < 5; i++) sim.tick()

    expect(sim.speciesAt(10, FLOOR - 2)).toBe(EMPTY)
    const landed = [9, 11].filter((x) => sim.speciesAt(x, FLOOR - 1) === SAND)
    expect(landed).toHaveLength(1)
  })

  it('treats the world edge as wall', () => {
    const sim = withDirtFloor(new Sim({ seed: 1 }))
    sim.paint(0, FLOOR - 1, DIRT)
    sim.paint(0, FLOOR - 2, SAND)

    // The only diagonal that is not off-world is the one to the right, so a
    // grain in the corner must take it however the coin lands.
    for (let i = 0; i < 5; i++) sim.tick()

    expect(sim.speciesAt(1, FLOOR - 1)).toBe(SAND)
  })

  it('does not fall through static elements', () => {
    const sim = withDirtFloor(new Sim({ seed: 1 }))
    for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, 20, SAND)

    for (let i = 0; i < 30; i++) sim.tick()

    for (let x = 0; x < GRID_WIDTH; x++) {
      expect(sim.speciesAt(x, FLOOR)).toBe(DIRT)
    }
  })
})

/**
 * A grain resting on dirt with dirt to its lower right and open world to its
 * lower left: exactly one way out, and the coin decides each tick whether the
 * grain even looks that way.
 */
function inANotch(seed: number): Sim {
  const sim = new Sim({ seed })
  for (let x = 10; x < 20; x++) sim.paint(x, FLOOR, DIRT)
  sim.paint(10, FLOOR - 1, SAND)
  return sim
}

const escaped = (sim: Sim) => sim.speciesAt(9, FLOOR) === SAND

describe('a one-sided notch', () => {
  it('is escaped on some ticks and not others', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => i + 1)

    const escapedFirstTick = seeds.filter((seed) => {
      const sim = inANotch(seed)
      sim.tick()
      return escaped(sim)
    })

    // The coin picks the direction, not the order: trying both diagonals would
    // escape on every tick, trying one escapes on about half of them.
    expect(escapedFirstTick.length).toBeGreaterThan(5)
    expect(escapedFirstTick.length).toBeLessThan(35)
  })

  it('keeps the grain awake once its paint rect has run out', () => {
    // A paint keeps the chunk awake for exactly two ticks — the dirty rect is
    // double-buffered, so the notch gets two free draws before sleeping is even
    // on the table. Anything asserted before the third tick passes whether or
    // not the kernel calls `keepAwake`, which is what makes the naive version of
    // this test vacuous.
    const stuck = Array.from({ length: 40 }, (_, i) => inANotch(i + 1)).filter((sim) => {
      sim.tick()
      sim.tick()
      return !escaped(sim)
    })
    expect(stuck.length).toBeGreaterThan(0)

    for (const sim of stuck) {
      // The third tick is the one that tells the two kernels apart: a declined
      // diagonal writes nothing, so without `keepAwake` the chunk is asleep here
      // and the grain is wedged in the notch for good.
      sim.tick()
      expect(sim.scannedLastTick).toBeGreaterThan(0)

      for (let i = 0; i < 30; i++) sim.tick()
      expect(escaped(sim)).toBe(true)
    }
  })
})

describe('determinism', () => {
  const paintPile = (sim: Sim) => {
    withDirtFloor(sim)
    for (let y = 0; y < 12; y++) {
      for (let x = 40; x < 60; x++) sim.paint(x, y, SAND)
    }
  }

  it('same seed and same paint sequence give an identical grid', () => {
    const a = new Sim({ seed: 0xc0ffee })
    const b = new Sim({ seed: 0xc0ffee })
    paintPile(a)
    paintPile(b)

    for (let i = 0; i < 60; i++) {
      a.tick()
      b.tick()
    }

    expect(a.cells).toEqual(b.cells)
  })

  it('never reaches Math.random', () => {
    const random = vi.spyOn(Math, 'random')
    const sim = new Sim({ seed: 7 })
    paintPile(sim)

    for (let i = 0; i < 20; i++) sim.tick()

    expect(random).not.toHaveBeenCalled()
    random.mockRestore()
  })
})

describe('grid storage', () => {
  it('is a transferable typed-array buffer', () => {
    const sim = new Sim({ seed: 1 })

    expect(sim.buffer).toBeInstanceOf(ArrayBuffer)
    expect(sim.cells).toBeInstanceOf(Uint8Array)
    expect(sim.cells.buffer).toBe(sim.buffer)
    expect(sim.buffer.byteLength).toBe(GRID_WIDTH * GRID_HEIGHT * 4)
  })

  it('rejects painting an unregistered species', () => {
    const sim = new Sim({ seed: 1 })

    expect(() => sim.paint(0, 0, 99)).toThrow(/unknown species/i)
  })

  it('runs over a caller-provided SharedArrayBuffer, identically to its own', () => {
    const shared = new SharedArrayBuffer(GRID_WIDTH * GRID_HEIGHT * 4)
    const a = new Sim({ seed: 0xc0ffee, buffer: shared })
    const b = new Sim({ seed: 0xc0ffee })
    for (const sim of [a, b]) {
      withDirtFloor(sim)
      for (let x = 40; x < 60; x++) sim.paint(x, 0, SAND)
    }

    for (let i = 0; i < 30; i++) {
      a.tick()
      b.tick()
    }

    expect(a.buffer).toBe(shared)
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells))
  })

  it('rejects a provided buffer of the wrong size', () => {
    expect(() => new Sim({ buffer: new SharedArrayBuffer(8) })).toThrow(/byte/i)
  })
})

describe('colour variants in `rb`', () => {
  const rbOf = (sim: Sim, cells: readonly (readonly [number, number])[]) =>
    new Set(cells.map(([x, y]) => sim.rbAt(x, y)))

  it('seeds a painted cell, so a fresh pour is not one flat slab', () => {
    const sim = new Sim({ seed: 1 })
    const cells = Array.from({ length: 200 }, (_, i) => [i % 100, (i / 100) | 0] as const)
    for (const [x, y] of cells) sim.paint(x, y, SAND)

    // The renderer takes the low bits, so what matters is that the byte spreads
    // across the variant slots rather than merely varying.
    const slots = new Set([...rbOf(sim, cells)].map((rb) => rb & (VARIANT_SLOTS - 1)))
    expect(slots.size).toBe(VARIANT_SLOTS)
  })

  it('seeds a transmuted cell, so a reaction product is not one flat slab', () => {
    const sim = new Sim({ seed: 1 })
    const band = Array.from({ length: 60 }, (_, i) => 40 + i)
    for (const x of band) {
      sim.paint(x, 100, WATER)
      sim.paint(x, 101, LAVA)
    }

    for (let i = 0; i < 5; i++) sim.tick()

    // `grid.write` clears the cell, so without seeding in `CellApi` every one of
    // these would be variant 0 and the crust would read as a single slab.
    const obsidian = band
      .flatMap((x) => [100, 101].map((y) => [x, y] as const))
      .filter(([x, y]) => sim.speciesAt(x, y) === OBSIDIAN)
    expect(obsidian.length).toBeGreaterThan(10)
    expect(rbOf(sim, obsidian).size).toBeGreaterThan(1)
  })

  it('keeps the stored variant through a restore, so a saved world loads grain-exact', () => {
    const sim = new Sim({ seed: 1 })
    const size = GRID_WIDTH * GRID_HEIGHT
    const species = new Uint8Array(size)
    const rb = new Uint8Array(size)
    const index = GRID_WIDTH + 200
    species[index] = SAND
    rb[index] = 200

    sim.restore(species, new Uint8Array(size), rb)

    expect(sim.rbAt(200, 1)).toBe(200)
  })
})

describe('revision', () => {
  it('bumps on everything that changes the world', () => {
    const sim = new Sim({ seed: 1 })
    const start = sim.revision

    sim.paint(10, 10, SAND)
    const afterPaint = sim.revision
    expect(afterPaint).toBeGreaterThan(start)

    sim.tick()
    const afterTick = sim.revision
    expect(afterTick).toBeGreaterThan(afterPaint)

    sim.clear()
    const afterClear = sim.revision
    expect(afterClear).toBeGreaterThan(afterTick)

    const size = GRID_WIDTH * GRID_HEIGHT
    sim.restore(new Uint8Array(size), new Uint8Array(size), new Uint8Array(size))
    expect(sim.revision).toBeGreaterThan(afterClear)
  })

  it('does not move on a read', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, 10, SAND)
    const revision = sim.revision

    sim.speciesAt(10, 10)
    expect(sim.revision).toBe(revision)
  })
})
