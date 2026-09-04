import { describe, expect, it } from 'vitest'

import { EMIT_OFFSETS } from './emit.ts'
import { createShed, SHED_P, type ShedIds } from './petals.ts'
import type { Api, SetOptions } from './types.ts'

const EMPTY = 0
const MUD = 14
const STALK = 23
const FLOWER = 24
const PETAL = 25

const ids: ShedIds = { empty: EMPTY, petal: PETAL }

/**
 * The hook against a stub, as `stalk.test.ts` and `seedBank.test.ts` do it: what
 * is pinned here is the draw and the scatter, not what a world full of falling
 * petals does with them (`life.test.ts` covers that).
 *
 * `raWrites` is recorded for the same reason it is there: the flower must never
 * touch `ra`, because its own `lifetime` owns the byte (ADR 0043).
 */
class StubApi implements Api {
  rb = 0
  readonly writes: { dx: number; dy: number; species: number; options?: SetOptions }[] = []
  readonly raWrites: number[] = []
  readonly becomes: number[] = []

  #cells: Map<string, number>
  #draws: number[]
  #ints: number[]

  constructor(cells: Record<string, number>, draws: number[] = [], ints: number[] = []) {
    this.#cells = new Map(Object.entries(cells))
    this.#draws = draws
    this.#ints = ints
  }

  get(dx: number, dy: number): number {
    return this.#cells.get(`${dx},${dy}`) ?? EMPTY
  }

  set(dx: number, dy: number, species: number, options?: SetOptions): void {
    this.writes.push({ dx, dy, species, options })
    this.#cells.set(`${dx},${dy}`, species)
  }

  swap(): void {
    throw new Error('a flower must never move a cell')
  }

  become(species: number): void {
    this.becomes.push(species)
    this.#cells.set('0,0', species)
  }

  has(): boolean {
    throw new Error('the flower reads species, not tags')
  }

  get ra(): number {
    return 0
  }

  set ra(value: number) {
    this.raWrites.push(value)
  }

  rand(): number {
    // Default 0: every draw comes up, so a test only supplies draws when the
    // declined path is what it cares about.
    return this.#draws.shift() ?? 0
  }

  keepAwake(): void {
    // The one hook that needs nothing: the flower's own countdown writes (or
    // calls `keepAwake` itself) on every tick of its life.
    throw new Error('a blooming flower is already kept awake by its countdown')
  }

  randInt(): number {
    return this.#ints.shift() ?? 0
  }
  witnessGrowth(): void {
    // The witness recorder is off to the side of the simulation (ADR 0048);
    // this hook's behaviour under test does not depend on it.
  }
}

const shed = createShed(ids)

describe('the flower shedding hook', () => {
  it('drops one petal into a free cell beside it when the draw comes up', () => {
    const api = new StubApi({ '0,0': FLOWER, '0,1': STALK })

    shed(api)

    expect(api.writes).toEqual([{ dx: -1, dy: -1, species: PETAL, options: undefined }])
    // It is still a flower afterwards: shedding is not the death drop.
    expect(api.becomes).toEqual([])
  })

  it('declines the draw far more often than it takes it', () => {
    const api = new StubApi({ '0,0': FLOWER }, [SHED_P])

    shed(api)

    expect(api.writes).toEqual([])
  })

  it('sheds nothing when every cell around it is taken', () => {
    const boxed: Record<string, number> = { '0,0': FLOWER }
    for (const [dx, dy] of EMIT_OFFSETS) boxed[`${dx},${dy}`] = MUD
    const api = new StubApi(boxed)

    shed(api)

    expect(api.writes).toEqual([])
  })

  /**
   * **The flower never writes `ra`.** Unlike the growers it declares a
   * `lifetime`, so the byte is the engine's countdown (ADR 0043) - and it needs
   * no keep-awake write either, because that countdown already writes or calls
   * `keepAwake` on every tick of the flower's life.
   */
  it('touches its own countdown byte nowhere, on either branch of the draw', () => {
    for (const draw of [0, SHED_P]) {
      const api = new StubApi({ '0,0': FLOWER }, [draw])

      shed(api)

      expect(api.raWrites).toEqual([])
    }
  })
})
