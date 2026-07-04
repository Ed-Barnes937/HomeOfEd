import { describe, expect, it } from 'vitest'

import type { StoredBoard } from '../board/serialize.ts'
import { buildImportedBoard, importedName, importSharedBoard } from './importSharedBoard.ts'

const payload: StoredBoard = {
  name: 'Beach Day',
  finish: 'red',
  wall: 'cool',
  magnets: [{ type: 'letter', label: 'A', deg: 0, color: 'red', x: 100, y: 40, rot: 0 }],
}

/** A minimal in-memory Storage stand-in (same DI seam serialize.ts expects). */
function fakeStorage(seed: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map(Object.entries(seed))
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  }
}

function readState(storage: Pick<Storage, 'getItem'>): {
  current: StoredBoard
  saved: StoredBoard[]
} {
  return JSON.parse(storage.getItem('fridge:v1')!) as { current: StoredBoard; saved: StoredBoard[] }
}

describe('importedName', () => {
  it('tags the shared name', () => {
    expect(importedName('Beach Day')).toBe('Beach Day (shared)')
  })

  it('caps the tagged name at 60 chars', () => {
    expect(importedName('x'.repeat(60)).length).toBe(60)
  })
})

describe('buildImportedBoard', () => {
  it('keeps the payload but tags the name', () => {
    expect(buildImportedBoard(payload)).toEqual({ ...payload, name: 'Beach Day (shared)' })
  })
})

describe('importSharedBoard', () => {
  it('makes the imported board current AND a saved chip, preserving other saves', () => {
    const mine: StoredBoard = { ...payload, name: 'Mine' }
    const storage = fakeStorage({
      'fridge:v1': JSON.stringify({ v: 1, current: { ...payload, name: 'Old' }, saved: [mine] }),
    })

    const imported = importSharedBoard(storage, payload)

    expect(imported.name).toBe('Beach Day (shared)')
    const state = readState(storage)
    expect(state.current.name).toBe('Beach Day (shared)')
    expect(state.saved).toEqual([mine, { ...payload, name: 'Beach Day (shared)' }])
  })

  it('upserts by name — re-importing the same board replaces its chip, no duplicate', () => {
    const storage = fakeStorage()
    importSharedBoard(storage, payload)
    importSharedBoard(storage, { ...payload, finish: 'steel' })

    const state = readState(storage)
    expect(state.saved).toHaveLength(1)
    expect(state.saved[0]).toEqual({ ...payload, finish: 'steel', name: 'Beach Day (shared)' })
  })
})
