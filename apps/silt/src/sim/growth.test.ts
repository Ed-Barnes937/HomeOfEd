import { describe, expect, it } from 'vitest'

import { BRANCH_BUDGET, createGrowth, GROWTH_P } from './growth.ts'
import type { Api } from './types.ts'

const WATER = 3
const VINE = 17
const EMPTY = 0

const grow = createGrowth(WATER, VINE)

/**
 * The hook is tested against a stub rather than a `Sim`, so direction, budget
 * and reach are pinned exactly instead of being inferred from a world that is
 * also falling, reacting and sleeping. `life.test.ts` covers it in a real world.
 *
 * `set` is recorded rather than applied: what matters is *which offset* the
 * hook writes, and offsets are the thing the chunk margin constrains.
 */
class StubApi implements Api {
  ra = 0
  rb = 0
  readonly writes: { dx: number; dy: number; species: number }[] = []

  #cells: Map<string, number>
  #draws: number[]

  constructor(cells: Record<string, number>, draws: number[] = []) {
    this.#cells = new Map(Object.entries(cells))
    this.#draws = draws
  }

  get(dx: number, dy: number): number {
    return this.#cells.get(`${dx},${dy}`) ?? EMPTY
  }

  set(dx: number, dy: number, species: number): void {
    this.writes.push({ dx, dy, species })
    this.#cells.set(`${dx},${dy}`, species)
  }

  swap(): void {
    throw new Error('the growth hook must never move a cell')
  }

  become(): void {
    throw new Error('the growth hook must never transmute its own cell')
  }

  has(): boolean {
    return false
  }

  rand(): number {
    // Default 0: every draw succeeds, so a test only supplies draws when it is
    // the failing path it cares about.
    return this.#draws.shift() ?? 0
  }

  randInt(): number {
    throw new Error('the growth hook draws rand(), not randInt()')
  }
}

describe('the growth hook', () => {
  it('grows into the water above before the water beside it', () => {
    const api = new StubApi({ '0,-1': WATER, '-1,0': WATER, '1,0': WATER })

    grow(api)

    expect(api.writes).toEqual([{ dx: 0, dy: -1, species: VINE }])
  })

  it('reaches the sides only once the cell above is not water', () => {
    const api = new StubApi({ '0,-1': EMPTY, '-1,0': WATER, '1,0': WATER })

    grow(api)

    expect(api.writes).toEqual([{ dx: -1, dy: 0, species: VINE }])
  })

  it('grows into water and nothing else, so growth is paid for in water', () => {
    const api = new StubApi({ '0,-1': EMPTY, '-1,0': EMPTY, '1,0': EMPTY, '0,1': WATER })

    grow(api)

    // Nothing above or beside it is water, and there is no downward step — a
    // plant standing on a pool climbs out of it rather than boring into it.
    expect(api.writes).toEqual([])
  })

  it('never reaches further than one cell, in either axis', () => {
    const api = new StubApi({ '0,-1': WATER, '-1,0': WATER, '1,0': WATER })

    for (let i = 0; i < BRANCH_BUDGET; i++) grow(api)

    // ±1 offsets only: the chunk margin is two cells, so anything wider would
    // read a stale neighbour under chunked iteration.
    for (const write of api.writes) {
      expect(Math.abs(write.dx)).toBeLessThanOrEqual(1)
      expect(Math.abs(write.dy)).toBeLessThanOrEqual(1)
    }
  })

  it('spends one branch of the budget per cell it grows', () => {
    const api = new StubApi({ '0,-1': WATER })

    grow(api)

    expect(api.ra).toBe(1)
  })

  it('stops at BRANCH_BUDGET however much water surrounds it', () => {
    const api = new StubApi({ '0,-1': WATER, '-1,0': WATER, '1,0': WATER })

    for (let i = 0; i < 50; i++) {
      // Water flows back in around a submerged plant, so the cap has to be the
      // brake — not running out of neighbours.
      api.set(0, -1, WATER)
      api.set(-1, 0, WATER)
      api.set(1, 0, WATER)
      api.writes.length = 0
      grow(api)
    }

    expect(api.ra).toBe(BRANCH_BUDGET)
  })

  it('ignores the sides entirely while there is water above it', () => {
    // One failed draw, then a guaranteed one. If a failed draw fell through to
    // the sides, the second growth would land beside the plant, not above it.
    const api = new StubApi({ '0,-1': WATER, '-1,0': WATER, '1,0': WATER }, [1])

    grow(api)
    expect(api.writes).toEqual([])

    grow(api)
    expect(api.writes).toEqual([{ dx: 0, dy: -1, species: VINE }])
  })

  it('leaves the water alone on a failed draw, and tries again next tick', () => {
    const api = new StubApi({ '0,-1': WATER }, [GROWTH_P])

    grow(api)
    expect(api.writes).toEqual([])
    expect(api.ra).toBe(0)

    grow(api)
    expect(api.writes).toEqual([{ dx: 0, dy: -1, species: VINE }])
  })
})
