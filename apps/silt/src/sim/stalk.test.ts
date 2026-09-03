import { describe, expect, it } from 'vitest'

import { createSprout, STALK_HEIGHT_JITTER, STALK_HEIGHT_MIN, type SproutIds } from './stalk.ts'
import type { Api, SetOptions } from './types.ts'

const EMPTY = 0
const WATER = 3
const MUD = 14
const SPROUT = 21
const TIP = 22
const STALK = 23
const FLOWER = 24
const WALL = 255

const ids: SproutIds = { empty: EMPTY, tip: TIP, stalk: STALK }

/**
 * The hooks against a stub rather than a `Sim`, as `growth.test.ts` and
 * `seedBank.test.ts` do it: the budget arithmetic and the termination branches
 * are pinned exactly instead of being inferred from a world that is also falling
 * and reacting. `life.test.ts` covers the same rules in a real world.
 *
 * As the bank's stub, this one records **which writes happened at all**
 * (`raWrites`), because keep-awake is half the tip's design: chunk sleeping is
 * driven by writes, so a tip that wrote nothing between climbs would freeze
 * mid-air the first time its draw missed.
 */
class StubApi implements Api {
  rb = 0
  readonly writes: { dx: number; dy: number; species: number; options?: SetOptions }[] = []
  readonly raWrites: number[] = []
  readonly becomes: number[] = []

  #cells: Map<string, number>
  #ra: number
  #draws: number[]
  #jitters: number[]

  constructor(cells: Record<string, number>, ra = 0, draws: number[] = [], jitters: number[] = []) {
    this.#cells = new Map(Object.entries(cells))
    this.#ra = ra
    this.#draws = draws
    this.#jitters = jitters
  }

  get(dx: number, dy: number): number {
    return this.#cells.get(`${dx},${dy}`) ?? EMPTY
  }

  set(dx: number, dy: number, species: number, options?: SetOptions): void {
    this.writes.push({ dx, dy, species, options })
    this.#cells.set(`${dx},${dy}`, species)
  }

  swap(): void {
    throw new Error('a land plant must never move a cell')
  }

  become(species: number): void {
    this.becomes.push(species)
    this.#cells.set('0,0', species)
  }

  has(): boolean {
    throw new Error('the land plant reads species, not tags')
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
    // Default 0: the shortest jittered budget, so a test that does not care
    // about height gets the same one every time.
    return this.#jitters.shift() ?? 0
  }
}

const sprout = createSprout(ids)

describe('the sprout hook', () => {
  it('raises a tip into the air above it and is spent becoming the stem', () => {
    const api = new StubApi({ '0,0': SPROUT })

    sprout(api)

    // The budget is prepaid into the cell being born, which is the whole point
    // of `set` carrying a byte (life ticket 01).
    expect(api.writes).toEqual([
      { dx: 0, dy: -1, species: TIP, options: { ra: STALK_HEIGHT_MIN + 1 } },
    ])
    expect(api.becomes).toEqual([STALK])
  })

  it('jitters the budget it plants, so neighbouring plants differ in height', () => {
    const budgets = [0, 1, 2, 3, 4].map((jitter) => {
      const api = new StubApi({ '0,0': SPROUT }, 0, [], [jitter])
      sprout(api)
      return api.writes[0]?.options?.ra
    })

    // `ra` is height + 1, so these are stalks of 6 to 10 cells (spec §4.3).
    expect(budgets).toEqual([7, 8, 9, 10, 11])
    expect(STALK_HEIGHT_MIN + STALK_HEIGHT_JITTER).toBe(10)
  })

  /**
   * **A land plant never grows into water** (spec §4.2): the biome was committed
   * once, at germination, so a droplet resting on a sprout is just a droplet.
   * Nothing here consumes it and nothing here flips.
   */
  it('grows into nothing but empty air, and writes nothing when it cannot', () => {
    for (const above of [WATER, MUD, STALK, FLOWER, WALL]) {
      const api = new StubApi({ '0,0': SPROUT, '0,-1': above })

      sprout(api)

      expect(api.writes).toEqual([])
      expect(api.becomes).toEqual([])
      // Roofed and silent, exactly as a dormant buried seed is: no write, so
      // nothing holds the chunk awake, and the sprout is offered a draw again on
      // the tick its roof moves.
      expect(api.raWrites).toEqual([])
    }
  })

  /**
   * **No draw, deliberately** - the prototype's p 0.2 is the one tuning value
   * this ticket declines. A sprout that failed a draw would have to write a byte
   * it does not otherwise use to keep its own chunk awake, which is the third
   * disguised `ra` write spec §8 says to stop and promote `keepAwake` for. The
   * beat it would buy is already paid for by germination's own slow draw.
   */
  it('rises on the first tick it has air, with no draw to fail', () => {
    const api = new StubApi({ '0,0': SPROUT }, 0, [0.99])

    sprout(api)

    expect(api.writes).toHaveLength(1)
  })

  it('never touches its own ra: the sprout borrows no byte at all', () => {
    const api = new StubApi({ '0,0': SPROUT })

    sprout(api)

    expect(api.raWrites).toEqual([])
  })
})
