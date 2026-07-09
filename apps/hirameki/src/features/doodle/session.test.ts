import { describe, expect, it } from 'vitest'

import type { Op } from './engine/types.ts'
import { loadSession, saveSession } from './session.ts'

const STORAGE_KEY = 'hirameki:doodle:v1'

class FakeStorage {
  private readonly store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

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
})
