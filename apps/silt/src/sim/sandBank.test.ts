import { describe, expect, it } from 'vitest'

import { createSandBank, GERMINATE_P, type SandBankIds } from './sandBank.ts'
import { CHUNK_MARGIN } from './constants.ts'
import type { Api, SetOptions } from './types.ts'

const EMPTY = 0
const SAND = 2
const WATER = 3
const STONE = 12
/** The seedling this bank raises - cactus spec §2 pins it at 27. */
const NUB = 27
const DUNED = 26
const WALL = 255

const ids: SandBankIds = { empty: EMPTY, nub: NUB, sand: SAND }

/**
 * The hook against a stub, as `seedBank.test.ts` and `evaporation.test.ts` do it:
 * the dormancy branch, the keep-awake and the germination triple are pinned
 * exactly instead of being inferred from a world that is also falling, burying
 * and burning.
 *
 * Two things are recorded that a plainer stub would not bother with, because
 * between them they are half the design:
 *
 * - `raWrites`, because this bank **owns no byte**. Unlike `seedBank.ts` it has
 *   no soak counter to disguise a keep-awake in, which is exactly why it is a
 *   customer of the public `keepAwake` (ADR 0044) - and a stray `ra` write here
 *   would be scribbling on a byte it does not own.
 * - `wakes`, because chunk sleeping is driven by writes. A roofed bank that
 *   called it would hold every buried dune in the world awake for ever; an
 *   unroofed one that did not would get a draw or two and then sleep for good
 *   under an open sky.
 */
class StubApi implements Api {
  rb = 0
  wakes = 0
  readonly writes: { dx: number; dy: number; species: number; options?: SetOptions }[] = []
  readonly reads: { dx: number; dy: number }[] = []
  readonly raWrites: number[] = []
  readonly becomes: number[] = []
  readonly germinations: number[] = []

  #cells: Map<string, number>
  #draws: number[]

  constructor(cells: Record<string, number>, draws: number[] = []) {
    this.#cells = new Map(Object.entries(cells))
    this.#draws = draws
    if (!this.#cells.has('0,0')) this.#cells.set('0,0', DUNED)
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
    throw new Error('a hook must never move a cell')
  }

  become(species: number): void {
    this.becomes.push(species)
    this.#cells.set('0,0', species)
  }

  has(): boolean {
    throw new Error('the sand bank reads species, not tags')
  }

  get ra(): number {
    return 0
  }

  set ra(value: number) {
    this.raWrites.push(value)
  }

  keepAwake(): void {
    this.wakes++
  }

  rand(): number {
    // Default 0: every draw comes up, so a test only supplies draws when the
    // declined path is what it cares about.
    return this.#draws.shift() ?? 0
  }

  randInt(): number {
    throw new Error('the sand bank draws a rate, never an integer')
  }
  witnessGrowth(): void {
    throw new Error('the sand bank reports germination, not growth')
  }
  witnessGermination(product: number): void {
    // The witness recorder is off to the side of the simulation (ADR 0048);
    // recorded so the cases below can pin *when* the bank reports, and what.
    this.germinations.push(product)
  }
  witnessRaise(): void {
    throw new Error('the sand bank never raises a tip')
  }
  witnessBloom(): void {
    throw new Error('the sand bank never blooms')
  }
}

const bank = createSandBank(ids)

describe('the sand bank hook', () => {
  /**
   * **Dormant and silent** (cactus spec §4). Anything at all overhead roofs the
   * bank - water included, unlike the mud bank, where standing water is the
   * aquatic branch. A dune under a pool is simply a dune that has not germinated
   * yet, because the biome was already committed at burial.
   */
  it('is dormant under a roof of anything, and writes nothing at all so the chunk sleeps', () => {
    for (const roof of [WATER, SAND, STONE, NUB, WALL]) {
      const api = new StubApi({ '0,-1': roof })

      bank(api)

      expect(api.writes).toEqual([])
      expect(api.becomes).toEqual([])
      expect(api.germinations).toEqual([])
      // The whole point: no write and no keep-awake, so nothing holds the chunk
      // up. A bank under a dune or a pond costs nothing until the roof moves,
      // and a write within `CHUNK_MARGIN` is what wakes it when it does.
      expect(api.raWrites).toEqual([])
      expect(api.wakes).toBe(0)
    }
  })

  it('stays silent under a roof however long it is left there', () => {
    const api = new StubApi({ '0,-1': SAND })

    for (let i = 0; i < 20; i++) bank(api)

    // Not merely quiet on the first tick: there is no stale state to clear here
    // (the bank owns no byte), so dormancy is silent from the outset rather than
    // self-terminating after one write, as `seedBank.ts`'s soak clear is.
    expect(api.raWrites).toEqual([])
    expect(api.wakes).toBe(0)
    expect(api.writes).toEqual([])
  })

  /**
   * **The keep-awake, and the reason this hook is the second customer of the
   * public one** (ADR 0044). Settled sand writes nothing, and this bank has no
   * byte of its own to rewrite - so without this it would be offered a draw or
   * two under an open sky and then sleep through the rest of the desert.
   */
  it('holds its chunk awake under open sky when the draw misses', () => {
    const api = new StubApi({ '0,-1': EMPTY }, [GERMINATE_P, GERMINATE_P])

    bank(api)
    bank(api)

    expect(api.writes).toEqual([])
    expect(api.becomes).toEqual([])
    expect(api.wakes).toBe(2)
    // And never by disguising the wake as a write: the bank owns no byte.
    expect(api.raWrites).toEqual([])
  })

  /**
   * The germination triple (cactus spec §4): the seedling goes above, the site
   * reports itself, and the bed cell is handed back as sand.
   */
  it('raises a nub into the open air, reports it, and refunds the bed as sand', () => {
    const api = new StubApi({ '0,-1': EMPTY })

    bank(api)

    expect(api.writes).toEqual([{ dx: 0, dy: -1, species: NUB, options: undefined }])
    expect(api.germinations).toEqual([NUB])
    // **Refunded, not drunk** - the desert's cap is seed scarcity, not a
    // moisture ledger, so unlike the mud bank (which spends a cell of soil per
    // plant) a dune loses nothing by germinating.
    expect(api.becomes).toEqual([SAND])
  })

  it('leaves the bank in place on a failed draw, and tries again next tick', () => {
    const api = new StubApi({ '0,-1': EMPTY }, [GERMINATE_P])

    bank(api)
    expect(api.writes).toEqual([])
    expect(api.becomes).toEqual([])
    expect(api.germinations).toEqual([])

    bank(api)
    expect(api.becomes).toEqual([SAND])
  })

  it('germinates once and once only', () => {
    const api = new StubApi({ '0,-1': EMPTY })

    bank(api)
    bank(api)

    // The second run is not something the sim can even offer - the cell is sand
    // now - but nothing in the hook raises a second seedling either way: the nub
    // it just set is itself a roof.
    expect(api.writes).toHaveLength(1)
    expect(api.becomes).toEqual([SAND])
    expect(api.germinations).toEqual([NUB])
  })

  it('reads one cell and no further, well inside the chunk margin', () => {
    const api = new StubApi({ '0,-1': EMPTY })

    bank(api)

    // No depth test and no crowding check: unlike the mud bank this one spends
    // none of `CHUNK_MARGIN`, so the margin is untouched by this epic.
    expect(api.reads).toEqual([{ dx: 0, dy: -1 }])
    for (const read of api.reads) {
      expect(Math.abs(read.dx)).toBeLessThanOrEqual(CHUNK_MARGIN)
      expect(Math.abs(read.dy)).toBeLessThanOrEqual(CHUNK_MARGIN)
    }
  })

  it('draws its rate through the sim rng, never an integer and never Math.random', () => {
    // `randInt` throws on the stub, so reaching for it fails here rather than in
    // the determinism suite; the sim-wide ban on `Math.random()` is guarded
    // there. A desert establishes at half the mud bank's pace, spelled in the
    // same coarse form `lifetime.every` uses.
    const api = new StubApi({ '0,-1': EMPTY }, [GERMINATE_P])

    bank(api)

    expect(GERMINATE_P).toBeCloseTo(0.004 / 4)
    expect(api.wakes).toBe(1)
  })
})
