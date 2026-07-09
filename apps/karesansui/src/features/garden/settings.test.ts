import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG, type GardenConfig } from './engine/state.ts'
import { deletePreset, loadPresets, presetName, savePreset, type Preset } from './settings.ts'

const STORAGE_KEY = 'karesansui:presets:v1'

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
        rake: DEFAULT_CONFIG.rake,
        turns: DEFAULT_CONFIG.turns,
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
    const good: Preset = {
      name: '96·52 W',
      ring: 96,
      wheels: [52],
      offset: 0.66,
      rake: 'wide',
      turns: 13,
      speed: 58,
    }
    storage.setItem(STORAGE_KEY, JSON.stringify([{ ring: 'x' }, good]))
    expect(loadPresets(storage)).toEqual([good])
  })

  it('caps at the newest 8 presets', () => {
    const storage = new FakeStorage()
    let presets: Preset[] = []
    for (let i = 0; i < 9; i++) {
      const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 96, turns: i }
      presets = savePreset(config, presets, storage)
    }
    const loaded = loadPresets(storage)
    expect(loaded).toHaveLength(8)
    expect(loaded.map((p) => p.turns)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('deletes a preset by index and persists the change', () => {
    const storage = new FakeStorage()
    let presets: Preset[] = []
    presets = savePreset({ ...DEFAULT_CONFIG, turns: 1 }, presets, storage)
    presets = savePreset({ ...DEFAULT_CONFIG, turns: 2 }, presets, storage)
    presets = savePreset({ ...DEFAULT_CONFIG, turns: 3 }, presets, storage)

    const next = deletePreset(1, presets, storage)
    expect(next.map((p) => p.turns)).toEqual([1, 3])
    expect(loadPresets(storage).map((p) => p.turns)).toEqual([1, 3])
  })
})

describe('presetName', () => {
  it('formats a single-wheel wide-rake config', () => {
    const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 96, wheels: [52], rake: 'wide' }
    expect(presetName(config)).toBe('96·52 W')
  })

  it('formats a multi-wheel deep-rake config', () => {
    const config: GardenConfig = { ...DEFAULT_CONFIG, ring: 120, wheels: [45, 30], rake: 'deep' }
    expect(presetName(config)).toBe('120·45·30 D')
  })
})
