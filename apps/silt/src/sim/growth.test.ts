import { describe, expect, it } from 'vitest'

import { BRANCH_BUDGET, createGrowth, GROWTH_P, MAX_PLANT_NEIGHBOURS } from './growth.ts'
import { CHUNK_MARGIN } from './constants.ts'
import type { Api } from './types.ts'

const WATER = 3
const MOSS = 16
const VINE = 17
const EMPTY = 0

const grow = createGrowth(WATER, MOSS, VINE)

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
  readonly reads: { dx: number; dy: number }[] = []

  #cells: Map<string, number>
  #draws: number[]

  constructor(cells: Record<string, number>, draws: number[] = []) {
    this.#cells = new Map(Object.entries(cells))
    this.#draws = draws
    // The hook only ever runs on a plant, so the centre cell is one — and it
    // counts towards its own candidates' crowding, which is what makes
    // `MAX_PLANT_NEIGHBOURS` of one mean "nothing adjacent but the parent".
    // Defaulted rather than repeated in every case, and overridable so a test
    // can make the parent moss.
    if (!this.#cells.has('0,0')) this.#cells.set('0,0', VINE)
  }

  get(dx: number, dy: number): number {
    this.reads.push({ dx, dy })
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

  it('never writes further than one cell, nor reads past the chunk margin', () => {
    const api = new StubApi({ '0,-1': WATER, '-1,0': WATER, '1,0': WATER })

    for (let i = 0; i < BRANCH_BUDGET; i++) grow(api)

    // Writes stay at ±1 — the plant grows into a neighbour, never across a gap.
    for (const write of api.writes) {
      expect(Math.abs(write.dx)).toBeLessThanOrEqual(1)
      expect(Math.abs(write.dy)).toBeLessThanOrEqual(1)
    }

    // Reads go one further, because the crowding check looks past the candidate
    // at the candidate's own neighbours. Two is the whole of `CHUNK_MARGIN`, so
    // this is the assertion that fails if a later change reads wider than the
    // margin can wake — see the note on `crowding`.
    expect(api.reads.length).toBeGreaterThan(0)
    for (const read of api.reads) {
      expect(Math.abs(read.dx)).toBeLessThanOrEqual(CHUNK_MARGIN)
      expect(Math.abs(read.dy)).toBeLessThanOrEqual(CHUNK_MARGIN)
    }
  })

  it('refuses a cell that already touches two plants, and spends nothing doing it', () => {
    // The candidate above touches the parent and one more plant. Moss counts
    // alongside vine: they are one organism.
    const api = new StubApi({ '0,-1': WATER, '1,-1': MOSS })

    grow(api)

    expect(api.writes).toEqual([])
    // No water taken and no branch spent — a blocked candidate is not a
    // failed draw, so it costs the plant nothing.
    expect(api.ra).toBe(0)
  })

  it('skips a crowded candidate for the next offset, unlike a failed draw', () => {
    // Above is water but crowded; the left is water and free. Crowding is an
    // eligibility test, so the plant branches sideways rather than stalling —
    // which is the whole reason a blocked vine still has somewhere to go.
    const api = new StubApi({ '0,-1': WATER, '1,-1': MOSS, '-1,0': WATER })

    grow(api)

    expect(api.writes).toEqual([{ dx: -1, dy: 0, species: VINE }])
  })

  it('counts the parent towards crowding, so one free side is all it needs', () => {
    // Nothing around the candidate but the parent: exactly at the limit, and
    // therefore allowed. One more plant touching it would not be.
    const api = new StubApi({ '0,-1': WATER })

    grow(api)

    expect(MAX_PLANT_NEIGHBOURS).toBe(1)
    expect(api.writes).toEqual([{ dx: 0, dy: -1, species: VINE }])
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
