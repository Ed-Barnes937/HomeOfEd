import { describe, expect, it } from 'vitest'

import {
  createSeedBank,
  GERMINATE_P,
  MAX_SOAK,
  SOAK_DEPTH,
  SOAK_TO_DROWN,
  type SeedBankIds,
} from './seedBank.ts'
import { CHUNK_MARGIN } from './constants.ts'
import type { Api, SetOptions } from './types.ts'

const EMPTY = 0
const DIRT = 1
const WATER = 3
const MUD = 14
const MOSS = 16
const BURIED = 20
/** Stands in for sprout 21 until ticket 03 pins it - see the land seam below. */
const SPROUT = 21

const ids: SeedBankIds = { empty: EMPTY, water: WATER, moss: MOSS, dirt: DIRT, sprout: null }

/**
 * The hook against a stub rather than a `Sim`, as `growth.test.ts` does it: the
 * soak counter, the depth test and the dormancy branch are pinned exactly
 * instead of being inferred from a world that is also falling and reacting.
 * `life.test.ts` covers the same rules in a real world.
 *
 * The one thing this stub models that `growth.test.ts`'s does not is **which
 * writes happened at all** (`raWrites`), because "a dormant seed writes nothing"
 * is half the design: chunk sleeping is driven by writes, so a hook that wrote
 * an unchanged byte every tick would keep every bed in the world awake for good.
 */
class StubApi implements Api {
  rb = 0
  readonly writes: { dx: number; dy: number; species: number; options?: SetOptions }[] = []
  readonly reads: { dx: number; dy: number }[] = []
  readonly raWrites: number[] = []
  readonly becomes: number[] = []

  #cells: Map<string, number>
  #ra = 0
  #draws: number[]

  constructor(cells: Record<string, number>, soak = 0, draws: number[] = []) {
    this.#cells = new Map(Object.entries(cells))
    this.#ra = soak
    this.#draws = draws
    if (!this.#cells.has('0,0')) this.#cells.set('0,0', BURIED)
  }

  get(dx: number, dy: number): number {
    this.reads.push({ dx, dy })
    return this.#cells.get(`${dx},${dy}`) ?? EMPTY
  }

  set(dx: number, dy: number, species: number, options?: SetOptions): void {
    this.writes.push({ dx, dy, species, options })
    this.#cells.set(`${dx},${dy}`, species)
  }

  swap(): void {
    throw new Error('the seed bank must never move a cell')
  }

  become(species: number): void {
    this.becomes.push(species)
    this.#cells.set('0,0', species)
  }

  has(): boolean {
    throw new Error('the seed bank reads species, not tags')
  }

  get ra(): number {
    return this.#ra
  }

  set ra(value: number) {
    this.raWrites.push(value)
    this.#ra = value
  }

  rand(): number {
    // Default 0: every draw succeeds, so a test only supplies draws when the
    // failing path is what it cares about.
    return this.#draws.shift() ?? 0
  }

  randInt(): number {
    throw new Error('the seed bank draws rand(), not randInt()')
  }
}

const bank = createSeedBank(ids)
/** The same hook with the land seam closed, as ticket 03 will wire it. */
const bankWithSprout = createSeedBank({ ...ids, sprout: SPROUT })

describe('the seed bank hook', () => {
  it('is dormant under a roof, and writes nothing at all so the chunk sleeps', () => {
    for (const roof of [MUD, MOSS, DIRT, 255]) {
      const api = new StubApi({ '0,-1': roof })

      bank(api)

      expect(api.writes).toEqual([])
      expect(api.becomes).toEqual([])
      // The whole point: no write, so nothing holds the chunk awake. A bed
      // under a crowded meadow costs nothing until something opens the sky.
      expect(api.raWrites).toEqual([])
    }
  })

  it('clears a stale soak once when it is roofed, then goes quiet', () => {
    const api = new StubApi({ '0,-1': MUD }, 50)

    bank(api)
    // One write, so the chunk gets one more tick - self-terminating, since the
    // next tick has nothing left to clear.
    expect(api.raWrites).toEqual([0])

    bank(api)
    expect(api.raWrites).toEqual([0])
  })

  it('counts a soak while it is submerged, and resets it the tick the water leaves', () => {
    const api = new StubApi({ '0,-1': WATER, '0,-2': WATER })

    bank(api)
    bank(api)
    bank(api)
    expect(api.ra).toBe(3)

    api.set(0, -1, EMPTY)
    bank(api)

    // Broken submersion is not a soak: what makes rain and a flood differ in
    // kind is *continuous* wetness, so the counter starts over.
    expect(api.ra).toBe(0)
  })

  it('saturates the soak counter rather than wrapping the byte', () => {
    const api = new StubApi({ '0,-1': WATER, '0,-2': WATER }, MAX_SOAK)

    bank(api)

    // A wrap would un-drown a seed that has been under a lake all along.
    expect(api.ra).toBe(MAX_SOAK)
  })

  it('writes its soak every tick it has business, so the chunk stays awake', () => {
    // Open sky and dry: nothing changes, and the write is the only lever a hook
    // has to be offered another draw (`growth.ts` does the same).
    const api = new StubApi({ '0,-1': EMPTY })

    bank(api)
    bank(api)

    expect(api.raWrites).toEqual([0, 0])
  })

  it('commits aquatic only once the water is both deep and soaked', () => {
    const shallow = new StubApi({ '0,-1': WATER, '0,-2': EMPTY }, MAX_SOAK)
    bank(shallow)
    // One droplet resting on the bed, soaked as long as you like: depth alone
    // was faked by two droplets in one column, soak alone by a droplet standing
    // on already-saturated soil. Both are required.
    expect(shallow.writes).toEqual([])

    const dry = new StubApi({ '0,-1': WATER, '0,-2': WATER }, SOAK_TO_DROWN - 2)
    bank(dry)
    expect(dry.writes).toEqual([])

    const drowned = new StubApi({ '0,-1': WATER, '0,-2': WATER }, SOAK_TO_DROWN - 1)
    bank(drowned)
    // The tick the counter reaches the window, and not before.
    expect(drowned.writes).toEqual([{ dx: 0, dy: -1, species: MOSS, options: undefined }])
  })

  it('refunds the soil cell as dirt, not mud: the plant drank the moisture', () => {
    const api = new StubApi({ '0,-1': WATER, '0,-2': WATER }, SOAK_TO_DROWN)

    bank(api)

    expect(api.becomes).toEqual([DIRT])
  })

  it('leaves the seed banked on a failed germination draw, and tries again', () => {
    const api = new StubApi({ '0,-1': WATER, '0,-2': WATER }, SOAK_TO_DROWN, [GERMINATE_P])

    bank(api)
    expect(api.writes).toEqual([])
    expect(api.becomes).toEqual([])

    bank(api)
    expect(api.becomes).toEqual([DIRT])
  })

  it('germinates once and once only: the biome is never revisited', () => {
    const api = new StubApi({ '0,-1': WATER, '0,-2': WATER }, SOAK_TO_DROWN)

    bank(api)
    bank(api)

    // The cell is dirt after the first germination, so a second run of the hook
    // on the same cell is not something the sim can even offer - but nothing in
    // the hook writes a second plant either way.
    expect(api.writes).toHaveLength(1)
    expect(api.becomes).toEqual([DIRT])
  })

  it('reads no further than the chunk margin, depth test included', () => {
    const api = new StubApi({ '0,-1': WATER, '0,-2': WATER }, SOAK_TO_DROWN)

    bank(api)

    expect(SOAK_DEPTH).toBe(CHUNK_MARGIN)
    expect(api.reads.length).toBeGreaterThan(0)
    for (const read of api.reads) {
      // Two cells up is the whole of `CHUNK_MARGIN`, so this is the assertion
      // that fails if the depth test ever reaches a third cell.
      expect(Math.abs(read.dx)).toBeLessThanOrEqual(CHUNK_MARGIN)
      expect(Math.abs(read.dy)).toBeLessThanOrEqual(CHUNK_MARGIN)
    }
  })

  /**
   * The land seam ticket 03 closes. Until sprout 21 exists there is nothing for
   * an unroofed seed on dry ground to germinate *into*, so it stays banked -
   * and keeps writing, so the tick sprout is passed in the bed picks up where it
   * left off. Both halves are exercised here rather than waiting for 03, since
   * the seam is one argument wide.
   */
  it('banks an unroofed seed on dry ground while the land seam is open', () => {
    const api = new StubApi({ '0,-1': EMPTY })

    for (let i = 0; i < 20; i++) bank(api)

    expect(api.writes).toEqual([])
    expect(api.becomes).toEqual([])
    expect(api.raWrites).toHaveLength(20)
  })

  it('germinates on land the moment the seam is closed, refunding dirt as before', () => {
    const api = new StubApi({ '0,-1': EMPTY })

    bankWithSprout(api)

    expect(api.writes).toEqual([{ dx: 0, dy: -1, species: SPROUT, options: undefined }])
    expect(api.becomes).toEqual([DIRT])
  })

  it('stays dormant under a roof even with the seam closed', () => {
    const api = new StubApi({ '0,-1': MUD })

    bankWithSprout(api)

    expect(api.writes).toEqual([])
    expect(api.raWrites).toEqual([])
  })
})
