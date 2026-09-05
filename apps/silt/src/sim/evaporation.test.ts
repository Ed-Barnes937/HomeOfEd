import { describe, expect, it } from 'vitest'

import { createEvaporation, EVAPORATE_P, type EvaporationIds } from './evaporation.ts'
import type { Api } from './types.ts'

const EMPTY = 0
const DIRT = 1
const WATER = 3
const STEAM = 10
const MUD = 14
const WALL = 255

// `STEAM` is still a constant here but no longer one of the hook's ids: since
// the deletion ruling it is only ever a *roof* in these cases, never a product.
const ids: EvaporationIds = { empty: EMPTY, water: WATER }

/**
 * The hook against a stub, as `stalk.test.ts` and `seedBank.test.ts` do it: the
 * two structural gates and the keep-awake are pinned exactly rather than being
 * inferred from a world that is also flowing and raining. `life.test.ts` covers
 * the same rule in a real world.
 *
 * `wakes` is recorded because keep-awake is the risky half of this hook: settled
 * water writes nothing at all, so a film that declined its draw and then went
 * quiet would sleep under its own chunk and never evaporate. The mirror matters
 * as much - a pond surface that called it would hold its chunk awake for good.
 */
class StubApi implements Api {
  rb = 0
  wakes = 0
  readonly raWrites: number[] = []
  readonly becomes: number[] = []

  #cells: Map<string, number>
  #draws: number[]

  constructor(cells: Record<string, number>, draws: number[] = []) {
    this.#cells = new Map(Object.entries(cells))
    this.#draws = draws
  }

  get(dx: number, dy: number): number {
    return this.#cells.get(`${dx},${dy}`) ?? EMPTY
  }

  set(): void {
    throw new Error('evaporation rewrites its own cell and nothing else')
  }

  swap(): void {
    throw new Error('a hook must never move a cell')
  }

  become(species: number): void {
    this.becomes.push(species)
    this.#cells.set('0,0', species)
  }

  has(): boolean {
    throw new Error('evaporation reads species, not tags')
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
    throw new Error('evaporation draws a rate, never an integer')
  }
  witnessGrowth(): void {
    // The witness recorder is off to the side of the simulation (ADR 0048);
    // this hook's behaviour under test does not depend on it - and it reports
    // no hook edge of its own, so the three below refuse the call.
  }
  witnessGermination(): void {
    throw new Error('this hook reports no hook edge')
  }
  witnessRaise(): void {
    throw new Error('this hook reports no hook edge')
  }
  witnessBloom(): void {
    throw new Error('this hook reports no hook edge')
  }
}

const evaporate = createEvaporation(ids)

describe('the evaporation hook', () => {
  /**
   * **It dries to nothing, and that is the ruling** (ADR 0044 §6): the film
   * becomes `empty`, not `steam`. The transmuting version shipped first and was
   * ruled out on feel with the app running - a cell of cloud over every drying
   * film put a permanent haze on every wet bed, and the haze read as noise. The
   * cost is that this cell of water has left the world for good, which is why
   * the ledger has a named exception now (ADR 0045 §4) rather than an invariant.
   */
  it('dries a film with open air over it and something other than water under it', () => {
    const api = new StubApi({ '0,0': WATER, '0,-1': EMPTY, '0,1': MUD })

    evaporate(api)

    expect(api.becomes).toEqual([EMPTY])
    // Never steam: the ambient plume is exactly what the ruling took out.
    expect(api.becomes).not.toContain(STEAM)
    // Drained and done: nothing was left awake and no byte was touched.
    expect(api.wakes).toBe(0)
    expect(api.raWrites).toEqual([])
  })

  it('counts the world edge below it as ground, so a film on the floor still dries', () => {
    const api = new StubApi({ '0,0': WATER, '0,-1': EMPTY, '0,1': WALL })

    evaporate(api)

    expect(api.becomes).toEqual([EMPTY])
  })

  /**
   * **The humidity brake** (life spec §4.5), and it is deliberate: steam counts
   * as "not open air", so a wide sheet under its own plume evaporates far slower
   * than a lone droplet instead of at the same rate. There is no humidity field
   * anywhere - the plume is the field.
   */
  it('is braked by its own plume: steam directly above blocks the draw', () => {
    const api = new StubApi({ '0,0': WATER, '0,-1': STEAM, '0,1': MUD })

    evaporate(api)

    expect(api.becomes).toEqual([])
    // And it sleeps under the plume rather than spinning: the steam above is a
    // gas, so it writes every tick it moves and wakes this cell back up itself.
    expect(api.wakes).toBe(0)
  })

  it('never dries water from inside a body of water, whichever side is closed', () => {
    for (const cells of [
      // Roofed by more water: this cell is the middle of a pool.
      { '0,0': WATER, '0,-1': WATER, '0,1': MUD },
      // **Water below is a pool surface, not a film** (ruling 1): a level pool
      // two deep or deeper is permanent by design.
      { '0,0': WATER, '0,-1': EMPTY, '0,1': WATER },
    ]) {
      const api = new StubApi(cells)

      evaporate(api)

      expect(api.becomes).toEqual([])
      // **The half that lets a pond sleep.** A surface cell that held its chunk
      // awake would keep every pond in the world ticking for ever.
      expect(api.wakes).toBe(0)
    }
  })

  /**
   * **A fall is not a film**, and it is the one measured deviation from the
   * prototype (ADR 0044 §5): a droplet with air under it is on its way down, and
   * giving it a draw every tick of a hundred-cell fall loses half the rain to
   * cloud that rises and falls again. The rule that dries standing water would
   * be manufacturing permanent weather.
   */
  it('leaves falling water alone: air below is a fall, not a film', () => {
    const api = new StubApi({ '0,0': WATER, '0,-1': EMPTY, '0,1': EMPTY })

    evaporate(api)

    expect(api.becomes).toEqual([])
    // And nothing held awake either - the liquid kernel is already doing that
    // for a cell that is moving.
    expect(api.wakes).toBe(0)
  })

  it('stays put under a roof of anything at all', () => {
    const api = new StubApi({ '0,0': WATER, '0,-1': DIRT, '0,1': MUD })

    evaporate(api)

    expect(api.becomes).toEqual([])
    expect(api.wakes).toBe(0)
  })

  /**
   * **The keep-awake, on the missed draw only**, and the reason `Api` grew a
   * real `keepAwake` (ADR 0044 §3): settled water writes nothing, and water's
   * `ra` is the liquid opinion field (ADR 0038), so the disguised write the
   * growers use is not available here at any price.
   */
  it('holds its chunk awake when the draw misses, and lets it go once it dries', () => {
    const missed = new StubApi({ '0,0': WATER, '0,-1': EMPTY, '0,1': MUD }, [EVAPORATE_P])

    evaporate(missed)

    expect(missed.becomes).toEqual([])
    expect(missed.wakes).toBe(1)
    // And never by writing a byte: `ra` belongs to the liquid kernel.
    expect(missed.raWrites).toEqual([])
  })

  it('draws a rate slow enough that a film reads as drying rather than as popping', () => {
    // The prototype's coarse pair - p 0.03 drawn one tick in four - collapsed
    // into the one draw a tick a hook can spell, at the same effective rate.
    expect(EVAPORATE_P).toBeCloseTo(0.03 / 4)
  })
})
