import { describe, expect, it } from 'vitest'

import {
  CLIMB_P,
  createSprout,
  createTip,
  STALK_HEIGHT_JITTER,
  STALK_HEIGHT_MIN,
  type SproutIds,
  type TipIds,
} from './stalk.ts'
import type { Api, SetOptions } from './types.ts'

const EMPTY = 0
const WATER = 3
const MUD = 14
const SPROUT = 21
const TIP = 22
const STALK = 23
const FLOWER = 24
const WALL = 255

const sproutIds: SproutIds = { empty: EMPTY, tip: TIP, stalk: STALK }
const tipIds: TipIds = { empty: EMPTY, tip: TIP, stalk: STALK, flower: FLOWER }

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
  raises = 0
  blooms = 0

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

  keepAwake(): void {
    // As `growth.test.ts`: the tip re-states the budget it owns on a missed
    // climb, and the sprout draws no probability at all so it never needs to.
    throw new Error('the land plant holds its chunk awake by writing its budget')
  }

  randInt(): number {
    // Default 0: the shortest jittered budget, so a test that does not care
    // about height gets the same one every time.
    return this.#jitters.shift() ?? 0
  }
  witnessGrowth(): void {
    throw new Error('the land plant reports raises and blooms, not growth')
  }
  witnessGermination(): void {
    throw new Error('the land plant never germinates - the seed bank does')
  }
  witnessRaise(): void {
    // The witness recorder is off to the side of the simulation (ADR 0048);
    // recorded so the cases below can pin *when* each hook reports.
    this.raises += 1
  }
  witnessBloom(): void {
    this.blooms += 1
  }
}

const sprout = createSprout(sproutIds)
const tip = createTip(tipIds)

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

describe('the stalk tip hook', () => {
  it('hands its budget on to the cell above and leaves inert stem behind', () => {
    const api = new StubApi({ '0,0': TIP }, 9)

    tip(api)

    expect(api.writes).toEqual([{ dx: 0, dy: -1, species: TIP, options: { ra: 8 } }])
    expect(api.becomes).toEqual([STALK])
  })

  it('blooms when the budget is spent', () => {
    const api = new StubApi({ '0,0': TIP }, 1)

    tip(api)

    expect(api.writes).toEqual([])
    expect(api.becomes).toEqual([FLOWER])
  })

  /**
   * `ra` is 0 on a cell nothing has seeded - the engine's own "not seeded yet"
   * convention, which the budget stays clear of by counting from 1. A tip
   * painted into a scene therefore blooms at once rather than climbing forever.
   */
  it('blooms at once when it was planted with no budget at all', () => {
    const api = new StubApi({ '0,0': TIP })

    tip(api)

    expect(api.becomes).toEqual([FLOWER])
  })

  /**
   * **A boxed-in tip terminates rather than spinning.** It has nowhere to spend
   * the rest of its budget, and the alternative - waiting for the roof to move -
   * is a cell that must write every tick for as long as it is trapped. Blooming
   * early costs the plant its height and nothing else.
   */
  it('blooms early when it is boxed in, whatever budget is left', () => {
    for (const above of [STALK, FLOWER, WATER, MUD, WALL]) {
      const api = new StubApi({ '0,0': TIP, '0,-1': above }, 11)

      tip(api)

      expect(api.writes).toEqual([])
      expect(api.becomes).toEqual([FLOWER])
      // And it stops writing the moment it blooms: the flower's lifetime owns
      // the byte from here on.
      expect(api.raWrites).toEqual([])
    }
  })

  /**
   * The keep-awake write, and the reason it is in the *failed* branch only. A
   * climb rewrites this cell as stalk, whose `lifetime` owns `ra` - writing the
   * budget after that would pre-spend the stem's countdown (ADR 0043).
   */
  it('rewrites its own budget on a missed draw, so the chunk stays awake', () => {
    const api = new StubApi({ '0,0': TIP }, 9, [CLIMB_P, CLIMB_P])

    tip(api)
    tip(api)

    expect(api.writes).toEqual([])
    expect(api.becomes).toEqual([])
    // The same value twice: this is a keep-awake write, not a countdown.
    expect(api.raWrites).toEqual([9, 9])
  })

  it('writes nothing but the new tip on a climb, so the stem keeps a clean byte', () => {
    const api = new StubApi({ '0,0': TIP }, 9, [CLIMB_P, 0])

    tip(api)
    expect(api.raWrites).toEqual([9])

    tip(api)
    // One write for the climb, and no second write onto the cell that is now
    // stem: `set`'s `{ ra }` is how the budget travels, not `api.ra`.
    expect(api.raWrites).toEqual([9])
    expect(api.writes).toHaveLength(1)
  })
})

/**
 * The raise and bloom witnesses (discovery ticket 07). Each fires on the tick
 * its transmutation happens and at no other time: a waiting sprout, a climbing
 * tip and a missed draw all report nothing, so the recorder only ever hears
 * about what the player could actually see change.
 */
describe('the raise and bloom witnesses', () => {
  it('the sprout reports its raise on the tick it raises', () => {
    const api = new StubApi({ '0,0': SPROUT })

    sprout(api)

    expect(api.raises).toBe(1)
    expect(api.blooms).toBe(0)
  })

  it('a sprout that cannot rise reports nothing', () => {
    const api = new StubApi({ '0,0': SPROUT, '0,-1': WATER })

    sprout(api)

    expect(api.raises).toBe(0)
  })

  it('the tip reports its bloom at both endings: budget spent, and boxed in', () => {
    const spent = new StubApi({ '0,0': TIP }, 1)
    tip(spent)
    expect(spent.blooms).toBe(1)

    const boxed = new StubApi({ '0,0': TIP, '0,-1': MUD }, 9)
    tip(boxed)
    expect(boxed.blooms).toBe(1)
  })

  it('a climb reports nothing - the raise made the stalk an entry product already', () => {
    const climbing = new StubApi({ '0,0': TIP }, 9)
    tip(climbing)
    expect(climbing.blooms).toBe(0)
    expect(climbing.raises).toBe(0)

    const missed = new StubApi({ '0,0': TIP }, 9, [0.99])
    tip(missed)
    expect(missed.blooms).toBe(0)
  })
})
