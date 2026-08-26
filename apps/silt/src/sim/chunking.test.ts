import { describe, expect, it } from 'vitest'

import { CHUNK_MARGIN, CHUNK_SIZE, GRID_HEIGHT, GRID_WIDTH } from './constants.ts'
import { ChunkMap } from './chunks.ts'
import { DIRT, EMPTY, SAND } from './elements.ts'
import { Sim } from './sim.ts'

const FLOOR = GRID_HEIGHT - 1

describe('chunk map', () => {
  it('tiles the world in a fixed row-major order', () => {
    const chunks = new ChunkMap(GRID_WIDTH, GRID_HEIGHT)

    expect(chunks.cols).toBe(Math.ceil(GRID_WIDTH / CHUNK_SIZE))
    expect(chunks.rows).toBe(Math.ceil(GRID_HEIGHT / CHUNK_SIZE))
    expect(chunks.all).toHaveLength(chunks.cols * chunks.rows)
    // `all` is the fixed resolution order — position in it is derivable, not
    // an accident of insertion.
    chunks.all.forEach((chunk, index) => {
      expect(chunks.at(index % chunks.cols, Math.floor(index / chunks.cols))).toBe(chunk)
    })
  })

  it('clamps the last row and column to the world edge', () => {
    const chunks = new ChunkMap(GRID_WIDTH, GRID_HEIGHT)
    const last = chunks.at(chunks.cols - 1, chunks.rows - 1)

    expect(last.maxX).toBe(GRID_WIDTH - 1)
    expect(last.maxY).toBe(GRID_HEIGHT - 1)
  })

  it('touches the working rect, not the active one, with a 2-cell margin', () => {
    const chunks = new ChunkMap(GRID_WIDTH, GRID_HEIGHT)
    const chunk = chunks.at(1, 1)

    chunks.touch(40, 40)

    expect(chunk.active.isEmpty).toBe(true)
    expect(chunk.working).toMatchObject({
      minX: 40 - CHUNK_MARGIN,
      minY: 40 - CHUNK_MARGIN,
      maxX: 40 + CHUNK_MARGIN,
      maxY: 40 + CHUNK_MARGIN,
    })
  })

  it('spreads the margin into the neighbouring chunk it crosses into', () => {
    const chunks = new ChunkMap(GRID_WIDTH, GRID_HEIGHT)

    // One cell short of the boundary, so the margin reaches over it.
    chunks.touch(CHUNK_SIZE - 1, 10)

    expect(chunks.at(0, 0).working.isEmpty).toBe(false)
    expect(chunks.at(1, 0).working).toMatchObject({ minX: CHUNK_SIZE, maxX: CHUNK_SIZE + 1 })
  })

  it('stays asleep while it holds nothing, however dirty it is', () => {
    const chunks = new ChunkMap(GRID_WIDTH, GRID_HEIGHT)
    const chunk = chunks.at(0, 0)
    chunks.touch(5, 5)
    chunks.endFrame()
    expect(chunk.active.isEmpty).toBe(false)

    // Dirty but empty — the filled count alone is enough to skip it.
    expect(chunk.awake).toBe(false)

    chunks.addFilled(5, 5, 1)
    expect(chunk.awake).toBe(true)
  })

  it('honours a chunk size other than the default', () => {
    const chunks = new ChunkMap(64, 64, 16)

    expect(chunks.cols).toBe(4)
    expect(chunks.rows).toBe(4)
    // Tiling and lookup have to agree, or a cross-chunk move is misclassified.
    chunks.all.forEach((chunk, index) => {
      expect(chunks.indexAt(chunk.minX, chunk.minY)).toBe(index)
      expect(chunks.indexAt(chunk.maxX, chunk.maxY)).toBe(index)
    })
  })

  // The power-of-two sizes take the shift path; this one is the only thing
  // exercising the division fallback beside it.
  it('honours a chunk size that is not a power of two', () => {
    const chunks = new ChunkMap(50, 30, 12)

    expect(chunks.cols).toBe(5)
    expect(chunks.rows).toBe(3)
    chunks.all.forEach((chunk, index) => {
      expect(chunks.indexAt(chunk.minX, chunk.minY)).toBe(index)
      expect(chunks.indexAt(chunk.maxX, chunk.maxY)).toBe(index)
    })

    // A write on a chunk edge still spreads across it.
    chunks.touch(12, 0)
    chunks.endFrame()
    expect(chunks.at(0, 0).active.isEmpty).toBe(false)
    expect(chunks.at(1, 0).active.isEmpty).toBe(false)
  })

  it('swaps working into active at frame end and empties working', () => {
    const chunks = new ChunkMap(GRID_WIDTH, GRID_HEIGHT)
    const chunk = chunks.at(0, 0)
    chunks.touch(5, 5)

    chunks.endFrame()

    expect(chunk.active).toMatchObject({ minX: 3, minY: 3, maxX: 7, maxY: 7 })
    expect(chunk.working.isEmpty).toBe(true)

    chunks.endFrame()

    expect(chunk.active.isEmpty).toBe(true)
  })
})

describe('idle chunks', () => {
  it('stop being scanned once the world settles', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, FLOOR - 3, SAND)

    for (let i = 0; i < 30; i++) sim.tick()

    expect(sim.speciesAt(10, FLOOR)).toBe(SAND)
    expect(sim.scannedLastTick).toBe(0)
  })

  it('skips a chunk holding nothing at all', () => {
    const sim = new Sim({ seed: 1 })
    // A whole row of dirt is static and never moves, so after the paint tick
    // the only cells still visited are the ones we keep disturbing.
    for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, DIRT)
    for (let i = 0; i < 5; i++) sim.tick()
    expect(sim.scannedLastTick).toBe(0)

    sim.paint(10, 10, SAND)
    sim.tick()

    // One grain, one chunk, a handful of cells — not the 60 000 in the world.
    expect(sim.scannedLastTick).toBeGreaterThan(0)
    expect(sim.scannedLastTick).toBeLessThan(CHUNK_SIZE * CHUNK_SIZE)
  })

  it('wakes a sleeping chunk when its support is erased', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, FLOOR, DIRT)
    sim.paint(10, FLOOR - 1, SAND)
    // Walls either side so the grain cannot slide off and must sit still.
    sim.paint(9, FLOOR, DIRT)
    sim.paint(11, FLOOR, DIRT)
    for (let i = 0; i < 10; i++) sim.tick()
    expect(sim.scannedLastTick).toBe(0)

    sim.paint(10, FLOOR, EMPTY)
    sim.tick()

    expect(sim.speciesAt(10, FLOOR)).toBe(SAND)
  })

  it('keeps the clock guard honest when the byte wraps under a sleeping cell', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, FLOOR, DIRT)
    sim.paint(10, FLOOR - 1, SAND)
    sim.paint(9, FLOOR, DIRT)
    sim.paint(11, FLOOR, DIRT)
    for (let i = 0; i < 5; i++) sim.tick()

    // A sleeping cell keeps whatever clock it was last stamped with. Sleep on
    // until the one-byte clock wraps round to exactly that value — the tick
    // where a naive guard would mistake a settled grain for one it has already
    // moved, and skip it for a whole tick.
    const stale = sim.cells[((FLOOR - 1) * GRID_WIDTH + 10) * 4 + 3]!
    while (((sim.generation + 1) & 0xff) !== stale) sim.tick()

    sim.paint(10, FLOOR, EMPTY)
    sim.tick()

    expect(sim.speciesAt(10, FLOOR)).toBe(SAND)
    expect(sim.speciesAt(10, FLOOR - 1)).toBe(EMPTY)
  })
})

describe('cross-chunk moves', () => {
  it('still falls exactly one cell per tick over a chunk boundary', () => {
    const sim = new Sim({ seed: 1 })
    sim.paint(10, CHUNK_SIZE - 1, SAND)

    sim.tick()
    expect(sim.speciesAt(10, CHUNK_SIZE - 1)).toBe(EMPTY)
    expect(sim.speciesAt(10, CHUNK_SIZE)).toBe(SAND)

    sim.tick()
    expect(sim.speciesAt(10, CHUNK_SIZE + 1)).toBe(SAND)
  })
})

/**
 * Two grains in *different* chunks queue the same destination in the chunk
 * below: one falling straight down from (CHUNK_SIZE, CHUNK_SIZE - 1), one
 * boxed in so its only diagonal is the same cell.
 */
function contendForOneCell(seed: number): 'straight' | 'diagonal' {
  const sim = new Sim({ seed })
  const b = CHUNK_SIZE

  sim.paint(b - 1, b, DIRT) // blocks the diagonal grain's way down
  sim.paint(b - 2, b, DIRT) // …and its other diagonal
  sim.paint(b, b - 1, SAND) // chunk (1, 0) — wants (b, b) straight down
  sim.paint(b - 1, b - 1, SAND) // chunk (0, 0) — wants (b, b) diagonally

  sim.tick()

  expect(sim.speciesAt(b, b)).toBe(SAND)
  const straightMoved = sim.speciesAt(b, b - 1) === EMPTY
  const diagonalMoved = sim.speciesAt(b - 1, b - 1) === EMPTY
  // Exactly one of them got the cell; the loser stayed put.
  expect(straightMoved).not.toBe(diagonalMoved)

  return straightMoved ? 'straight' : 'diagonal'
}

describe('cross-chunk destination contention', () => {
  it('gives the cell to exactly one contender', () => {
    contendForOneCell(1)
  })

  it('resolves the same way every time for a given seed', () => {
    for (const seed of [1, 2, 3, 0xc0ffee]) {
      expect(contendForOneCell(seed)).toBe(contendForOneCell(seed))
    }
  })

  it('draws the tie-break from the seeded PRNG', () => {
    const winners = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) winners.add(contendForOneCell(seed))

    // A fixed rule (first-queued, or chunk order) would only ever produce one.
    expect(winners).toEqual(new Set(['straight', 'diagonal']))
  })
})

describe('determinism under chunking', () => {
  const paintCrossBoundaryPile = (sim: Sim) => {
    for (let x = 0; x < GRID_WIDTH; x++) sim.paint(x, FLOOR, DIRT)
    // Straddles three chunk columns and two chunk rows, so most of the traffic
    // crosses a boundary and goes through the deferred list.
    for (let y = CHUNK_SIZE - 6; y < CHUNK_SIZE + 6; y++) {
      for (let x = CHUNK_SIZE - 10; x < CHUNK_SIZE * 2 + 10; x++) sim.paint(x, y, SAND)
    }
  }

  it('same seed gives an identical grid across cross-chunk contention', () => {
    const a = new Sim({ seed: 0xbeef })
    const b = new Sim({ seed: 0xbeef })
    paintCrossBoundaryPile(a)
    paintCrossBoundaryPile(b)

    for (let i = 0; i < 120; i++) {
      a.tick()
      b.tick()
    }

    expect(a.cells).toEqual(b.cells)
  })

  it('conserves every grain it started with', () => {
    const sim = new Sim({ seed: 5 })
    paintCrossBoundaryPile(sim)
    const before = sim.cells.filter((_, i) => i % 4 === 0 && sim.cells[i] === SAND).length

    for (let i = 0; i < 200; i++) sim.tick()

    const after = sim.cells.filter((_, i) => i % 4 === 0 && sim.cells[i] === SAND).length
    expect(after).toBe(before)
  })
})
