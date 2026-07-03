import { describe, expect, it } from 'vitest'

import { DEFAULT_PARAMS } from './engine/params.ts'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings.ts'

const STORAGE_KEY = 'boids:settings:v1'

class FakeStorage {
  private readonly store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe('loadSettings', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(loadSettings(new FakeStorage())).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips a saved value exactly', () => {
    const storage = new FakeStorage()
    const settings: Settings = {
      theme: 'retro',
      shape: 'dot',
      params: { ...DEFAULT_PARAMS, count: 200, speed: 4 },
    }
    saveSettings(settings, storage)
    expect(loadSettings(storage)).toEqual(settings)
  })

  it('clamps out-of-range stored params', () => {
    const storage = new FakeStorage()
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: 'neon', shape: 'triangle', params: { ...DEFAULT_PARAMS, count: 9999 } }),
    )
    expect(loadSettings(storage).params.count).toBe(400)
  })

  it('falls back to default theme/shape for unknown ids', () => {
    const storage = new FakeStorage()
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: 'not-a-theme', shape: 'square', params: DEFAULT_PARAMS }),
    )
    const result = loadSettings(storage)
    expect(result.theme).toBe('neon')
    expect(result.shape).toBe('triangle')
  })

  it('falls back to defaults entirely on garbage JSON', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, 'not json{{{')
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to defaults when the stored value is not an object', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify('a string, not a settings object'))
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })

  it('ignores unknown top-level keys', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, bogus: 42 }))
    const result = loadSettings(storage)
    expect(Object.keys(result)).not.toContain('bogus')
  })

  it('clamps params even when the params key is missing entirely', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'asteroids', shape: 'line' }))
    expect(loadSettings(storage)).toEqual({
      theme: 'asteroids',
      shape: 'line',
      params: DEFAULT_PARAMS,
    })
  })
})
