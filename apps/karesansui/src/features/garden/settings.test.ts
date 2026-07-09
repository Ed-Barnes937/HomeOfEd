import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG, type GardenConfig } from './engine/state.ts'
import {
  deletePreset,
  loadPresets,
  presetName,
  renamePreset,
  savePreset,
  type Preset,
} from './settings.ts'

const STORAGE_KEY = 'karesansui:presets:v2'
const LEGACY_KEY = 'karesansui:presets:v1'

class FakeStorage {
  private readonly store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe('loadPresets', () => {
  it('returns [] when nothing is stored', () => {
    expect(loadPresets(new FakeStorage())).toEqual([])
  })

  it('round-trips a saved preset with the derived name', () => {
    const storage = new FakeStorage()
    const next = savePreset(DEFAULT_CONFIG, [], storage)
    expect(loadPresets(storage)).toEqual(next)
    expect(next).toEqual([
      {
        name: presetName(DEFAULT_CONFIG),
        ring: DEFAULT_CONFIG.ring,
        wheels: DEFAULT_CONFIG.wheels,
        offset: DEFAULT_CONFIG.offset,
        speed: DEFAULT_CONFIG.speed,
      },
    ])
  })

  it('falls back to [] on garbage JSON', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, 'not json{{{')
    expect(loadPresets(storage)).toEqual([])
  })

  it('falls back to [] when the stored value is not an array', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({}))
    expect(loadPresets(storage)).toEqual([])
  })

  it('drops entries with an invalid field and keeps the valid ones', () => {
    const storage = new FakeStorage()
    const good: Preset = { name: '96 · 52', ring: 96, wheels: [52], offset: 0.66, speed: 58 }
    storage.setItem(STORAGE_KEY, JSON.stringify([{ ring: 'x' }, good]))
    expect(loadPresets(storage)).toEqual([good])
  })

  it('caps at the newest 8 presets', () => {
    const storage = new FakeStorage()
    let presets: Preset[] = []
    for (let i = 0; i < 9; i++) {
      const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 96, speed: i }
      presets = savePreset(config, presets, storage)
    }
    const loaded = loadPresets(storage)
    expect(loaded).toHaveLength(8)
    expect(loaded.map((p) => p.speed)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('deletes a preset by index and persists the change', () => {
    const storage = new FakeStorage()
    let presets: Preset[] = []
    presets = savePreset({ ...DEFAULT_CONFIG, speed: 1 }, presets, storage)
    presets = savePreset({ ...DEFAULT_CONFIG, speed: 2 }, presets, storage)
    presets = savePreset({ ...DEFAULT_CONFIG, speed: 3 }, presets, storage)

    const next = deletePreset(1, presets, storage)
    expect(next.map((p) => p.speed)).toEqual([1, 3])
    expect(loadPresets(storage).map((p) => p.speed)).toEqual([1, 3])
  })
})

describe('v1 → v2 migration', () => {
  it('migrates legacy presets, dropping rake/turns, and writes v2', () => {
    const storage = new FakeStorage()
    const v1 = [
      { name: '96·52 W', ring: 96, wheels: [52], offset: 0.66, rake: 'wide', turns: 13, speed: 58 },
    ]
    storage.setItem(LEGACY_KEY, JSON.stringify(v1))

    const loaded = loadPresets(storage)
    expect(loaded).toEqual([{ name: '96·52 W', ring: 96, wheels: [52], offset: 0.66, speed: 58 }])
    const first = loaded[0] as unknown as Record<string, unknown>
    expect(first.rake).toBeUndefined()
    expect(first.turns).toBeUndefined()

    // The migrated set is now under the v2 key, so a second load reads it back.
    const v2Raw = storage.getItem(STORAGE_KEY)
    expect(v2Raw).not.toBeNull()
    expect(loadPresets(storage)).toEqual(loaded)
  })
})

describe('renamePreset', () => {
  it('renames by index and persists; blank names are ignored', () => {
    const storage = new FakeStorage()
    let presets = savePreset(DEFAULT_CONFIG, [], storage)

    presets = renamePreset(0, 'Dawn', presets, storage)
    expect(presets[0]?.name).toBe('Dawn')
    expect(loadPresets(storage)[0]?.name).toBe('Dawn')

    const same = renamePreset(0, '   ', presets, storage)
    expect(same[0]?.name).toBe('Dawn')
  })
})

describe('presetName', () => {
  it('formats a single-cog config', () => {
    const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 96, wheels: [52] }
    expect(presetName(config)).toBe('96 · 52')
  })

  it('formats a multi-cog config', () => {
    const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 120, wheels: [45, 30] }
    expect(presetName(config)).toBe('120 · 45·30')
  })
})
