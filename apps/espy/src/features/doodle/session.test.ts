import { describe, expect, it } from 'vitest'

import type { Op } from './engine/types.ts'
import { loadSession, saveSession } from './session.ts'

const STORAGE_KEY = 'espy:doodle:v1'

class FakeStorage {
  private readonly store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

/** Rejects any write whose serialised value exceeds `limit` chars, mimicking a
 * localStorage quota (0 = every write fails). */
class QuotaStorage {
  readonly store = new Map<string, string>()
  constructor(private readonly limit: number) {}
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    if (value.length > this.limit) {
      const err = new Error('quota exceeded')
      err.name = 'QuotaExceededError'
      throw err
    }
    this.store.set(key, value)
  }
}

const field = (baked?: string): Op => ({
  type: 'field',
  viewBox: { width: 10, height: 10 },
  blots: [{ cx: 1, cy: 1, r: 1, points: [{ x: 0, y: 0 }], satellites: [] }],
  ...(baked === undefined ? {} : { baked }),
})

const SAMPLE_OPS: Op[] = [
  {
    type: 'field',
    viewBox: { width: 800, height: 600 },
    blots: [
      {
        cx: 100,
        cy: 100,
        r: 40,
        points: [{ x: 90, y: 90 }, { x: 110, y: 110 }],
        satellites: [{ x: 120, y: 120, r: 5 }],
      },
    ],
  },
  {
    type: 'stroke',
    stroke: { color: '#171717', width: 3.4, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
  },
  {
    type: 'eye',
    eye: { x: 50, y: 60, size: 12, pupilAngle: 1.23 },
  },
]

describe('saveSession / loadSession', () => {
  it('round-trips a saved Op[] exactly', () => {
    const storage = new FakeStorage()
    saveSession(SAMPLE_OPS, storage)
    expect(loadSession(storage)).toEqual(SAMPLE_OPS)
  })

  it('returns null when the key is missing', () => {
    const storage = new FakeStorage()
    expect(loadSession(storage)).toBeNull()
  })

  it('returns null on non-JSON garbage (never throws)', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, 'not json{{{')
    expect(() => loadSession(storage)).not.toThrow()
    expect(loadSession(storage)).toBeNull()
  })

  it('returns null for an unknown op type', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify([{ type: 'bogus' }]))
    expect(loadSession(storage)).toBeNull()
  })

  it('returns null for a stroke op missing points', () => {
    const storage = new FakeStorage()
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ type: 'stroke', stroke: { color: '#171717', width: 3 } }]),
    )
    expect(loadSession(storage)).toBeNull()
  })

  it('returns null when the stored value is not an array', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ type: 'field' }))
    expect(loadSession(storage)).toBeNull()
  })

  it('returns null for a field op missing blots', () => {
    const storage = new FakeStorage()
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ type: 'field', viewBox: { width: 10, height: 10 } }]),
    )
    expect(loadSession(storage)).toBeNull()
  })

  it('returns null for an eye op with a non-numeric field', () => {
    const storage = new FakeStorage()
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ type: 'eye', eye: { x: 1, y: 2, size: 'big', pupilAngle: 0 } }]),
    )
    expect(loadSession(storage)).toBeNull()
  })

  it('never throws when the storage is over quota', () => {
    const storage = new QuotaStorage(0) // every write fails
    expect(() => saveSession(SAMPLE_OPS, storage)).not.toThrow()
    expect(storage.store.size).toBe(0) // nothing persisted, but no crash
  })

  it('on quota, retries keeping only the current field’s baked raster', () => {
    const big = 'x'.repeat(2000)
    const ops: Op[] = [field(big), SAMPLE_OPS[1]!, field(big)]
    // Full payload (two bakeds) is rejected; the stripped one (one baked) fits.
    const storage = new QuotaStorage(3000)

    expect(() => saveSession(ops, storage)).not.toThrow()

    const loaded = loadSession(storage)
    expect(loaded).not.toBeNull()
    expect(loaded![0]).toMatchObject({ type: 'field' })
    expect((loaded![0] as { baked?: string }).baked).toBeUndefined() // older field trimmed
    expect((loaded![2] as { baked?: string }).baked).toBe(big) // current field kept
  })

  it('loadSession returns null (never throws) when getItem throws', () => {
    const storage = {
      getItem(): string {
        throw new Error('storage disabled')
      },
    }
    expect(() => loadSession(storage)).not.toThrow()
    expect(loadSession(storage)).toBeNull()
  })
})
