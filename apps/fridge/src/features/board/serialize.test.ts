import { describe, expect, it } from 'vitest'

import { storedBoardSchema, type StoredBoard } from '../../server/boardSchema.ts'
import type { Magnet } from './model.ts'
import { fromStoredBoard, loadState, saveState, SEED_BOARD, toStoredBoard } from './serialize.ts'

/** Same DI pattern as boids' settings.test.ts — a fake, not a mock. */
class FakeStorage {
  private readonly store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe('SEED_BOARD', () => {
  it('validates against storedBoardSchema', () => {
    expect(storedBoardSchema.safeParse(SEED_BOARD).success).toBe(true)
  })
})

describe('storedBoardSchema', () => {
  it('rejects more than 200 magnets', () => {
    const board: StoredBoard = {
      ...SEED_BOARD,
      magnets: Array.from({ length: 201 }, () => SEED_BOARD.magnets[0]!),
    }
    expect(storedBoardSchema.safeParse(board).success).toBe(false)
  })

  it('rejects an invalid deg value', () => {
    const board = { ...SEED_BOARD, magnets: [{ ...SEED_BOARD.magnets[0]!, deg: 45 }] }
    expect(storedBoardSchema.safeParse(board).success).toBe(false)
  })

  it('rejects a garbage label', () => {
    const board = { ...SEED_BOARD, magnets: [{ ...SEED_BOARD.magnets[0]!, label: 'AB' }] }
    expect(storedBoardSchema.safeParse(board).success).toBe(false)
  })

  it('rejects an out-of-range coordinate', () => {
    const board = { ...SEED_BOARD, magnets: [{ ...SEED_BOARD.magnets[0]!, x: 9999 }] }
    expect(storedBoardSchema.safeParse(board).success).toBe(false)
  })

  it('rejects an unknown finish', () => {
    const board = { ...SEED_BOARD, finish: 'gold' }
    expect(storedBoardSchema.safeParse(board).success).toBe(false)
  })
})

describe('toStoredBoard / fromStoredBoard', () => {
  it('recomputes w/h/id/z from array order (sorted by z) and drops them on save', () => {
    const magnets: Magnet[] = [
      {
        id: 42,
        type: 'letter',
        label: 'A',
        color: 'red',
        deg: 0,
        x: 10.4,
        y: 20.6,
        w: 999,
        h: 999,
        rot: 5,
        z: 7,
      },
      { id: 1, type: 'number', label: '9', color: 'blue', deg: 0, x: 1, y: 1, w: 1, h: 1, rot: 0, z: 3 },
    ]
    const stored = toStoredBoard('My Fridge', magnets, 'white', 'cool')
    expect(stored).toEqual({
      name: 'My Fridge',
      finish: 'white',
      wall: 'cool',
      magnets: [
        { type: 'number', label: '9', deg: 0, color: 'blue', x: 1, y: 1, rot: 0 },
        { type: 'letter', label: 'A', deg: 0, color: 'red', x: 10, y: 21, rot: 5 },
      ],
    })

    const back = fromStoredBoard(stored)
    expect(back.magnets).toEqual([
      { id: 1, z: 1, type: 'number', label: '9', deg: 0, color: 'blue', x: 1, y: 1, w: 50, h: 60, rot: 0 },
      { id: 2, z: 2, type: 'letter', label: 'A', deg: 0, color: 'red', x: 10, y: 21, w: 52, h: 60, rot: 5 },
    ])
    expect(back.finish).toBe('white')
    expect(back.wall).toBe('cool')
  })

  it('normalises rot to [0,360) on save', () => {
    const magnets: Magnet[] = [
      { id: 1, type: 'letter', label: 'A', color: 'red', deg: 0, x: 0, y: 0, w: 52, h: 60, rot: -10, z: 1 },
    ]
    const stored = toStoredBoard('', magnets, 'mint', 'warm')
    expect(stored.magnets[0]!.rot).toBe(350)
  })
})

describe('loadState / saveState', () => {
  it('falls back to the seed board when nothing is stored', () => {
    expect(loadState(new FakeStorage())).toEqual({ current: SEED_BOARD, saved: [] })
  })

  it('round-trips a saved board exactly', () => {
    const storage = new FakeStorage()
    const board = toStoredBoard('Test', [], 'red', 'dark')
    saveState(storage, board, [SEED_BOARD])
    expect(loadState(storage)).toEqual({ current: board, saved: [SEED_BOARD] })
  })

  it('falls back to the seed on garbage JSON', () => {
    const storage = new FakeStorage()
    storage.setItem('fridge:v1', 'not json{{{')
    expect(loadState(storage)).toEqual({ current: SEED_BOARD, saved: [] })
  })

  it('falls back to the seed when the stored version is missing or wrong', () => {
    const storage = new FakeStorage()
    storage.setItem('fridge:v1', JSON.stringify({ v: 2, current: SEED_BOARD, saved: [] }))
    expect(loadState(storage)).toEqual({ current: SEED_BOARD, saved: [] })
  })

  it('falls back to the seed when current fails validation, but keeps valid saved entries', () => {
    const storage = new FakeStorage()
    storage.setItem(
      'fridge:v1',
      JSON.stringify({ v: 1, current: { bogus: true }, saved: [SEED_BOARD, { bogus: true }] }),
    )
    expect(loadState(storage)).toEqual({ current: SEED_BOARD, saved: [SEED_BOARD] })
  })
})
