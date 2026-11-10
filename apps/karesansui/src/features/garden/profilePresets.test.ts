import { memoryStorage, profileStorage, profileScopedKey, type StorageLike } from '@hoe/accounts'
import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG } from './engine/state.ts'
import { loadPresets, PRESET_PROFILE_KEYS, savePreset, type Preset } from './settings.ts'

/** Which presets a profile opens with, given what the device held before profiles (ADR 0094). */

const V2 = 'karesansui:presets:v2'
const V1 = 'karesansui:presets:v1'
const ADA = 'child-ada'

const fromV2: Preset = { name: 'from v2', ring: 120, wheels: [30], offset: 0.5, speed: 50 }
const fromV1 = { name: 'from v1', ring: 96, wheels: [24], offset: 0.4, speed: 40, rake: 1, turns: 3 }
const fromV1Migrated: Preset = { name: 'from v1', ring: 96, wheels: [24], offset: 0.4, speed: 40 }

function device(seed: Record<string, unknown[]>): StorageLike {
  const storage = memoryStorage()
  for (const [key, presets] of Object.entries(seed)) storage.setItem(key, JSON.stringify(presets))
  return storage
}

function snapshot(storage: StorageLike, keys: readonly string[]): Record<string, string | null> {
  return Object.fromEntries(keys.map((key) => [key, storage.getItem(key)]))
}

describe('a profile opening karesansui', () => {
  it('migrates a v1-only device into its own v2 key and leaves the device keys alone', () => {
    const shared = device({ [V1]: [fromV1] })
    const before = snapshot(shared, [V1, V2])

    const presets = loadPresets(profileStorage(shared, ADA, PRESET_PROFILE_KEYS))

    expect(presets).toEqual([fromV1Migrated])
    expect(snapshot(shared, [V1, V2])).toEqual(before)
    expect(shared.getItem(profileScopedKey(V2, ADA))).toBe(JSON.stringify([fromV1Migrated]))
  })

  it('opens a v2 device with its presets', () => {
    const shared = device({ [V2]: [fromV2] })

    expect(loadPresets(profileStorage(shared, ADA, PRESET_PROFILE_KEYS))).toEqual([fromV2])
    expect(shared.getItem(V2)).toBe(JSON.stringify([fromV2]))
  })

  it('opens a device holding both with the v2 presets, as a signed-out visitor sees', () => {
    const shared = device({ [V1]: [fromV1], [V2]: [fromV2] })
    const before = snapshot(shared, [V1, V2])

    expect(loadPresets(profileStorage(shared, ADA, PRESET_PROFILE_KEYS))).toEqual([fromV2])
    expect(snapshot(shared, [V1, V2])).toEqual(before)
  })

  it('saves to its own key only', () => {
    const shared = device({ [V2]: [fromV2] })
    const storage = profileStorage(shared, ADA, PRESET_PROFILE_KEYS)

    savePreset(DEFAULT_CONFIG, loadPresets(storage), storage)

    expect(shared.getItem(V2)).toBe(JSON.stringify([fromV2]))
    expect(loadPresets(profileStorage(shared, ADA, PRESET_PROFILE_KEYS))).toHaveLength(2)
    expect(loadPresets(profileStorage(shared, 'child-bo', PRESET_PROFILE_KEYS))).toEqual([fromV2])
  })

  it('keeps today’s behaviour signed out: a v1-only device migrates in place', () => {
    const shared = device({ [V1]: [fromV1] })

    expect(loadPresets(profileStorage(shared, null, PRESET_PROFILE_KEYS))).toEqual([fromV1Migrated])
    expect(shared.getItem(V2)).toBe(JSON.stringify([fromV1Migrated]))
    expect(shared.getItem(V1)).toBe(JSON.stringify([fromV1]))
  })
})
