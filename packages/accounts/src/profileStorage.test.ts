import { describe, expect, it } from 'vitest'

import type { KeyValueStorage } from './profileScopedKey.ts'
import { memoryStorage, profileStorage } from './profileStorage.ts'

const SAVE = 'app:save'
const FAVOURITES = 'app:favourites'
const KEYS = [SAVE, FAVOURITES]
const PREFERENCE = 'app:theme'

class MapStorage implements KeyValueStorage {
  readonly items = new Map<string, string>()
  unavailable = false

  getItem(key: string): string | null {
    if (this.unavailable) throw new Error('storage unavailable')
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.unavailable) throw new Error('storage unavailable')
    this.items.set(key, value)
  }
}

describe('profileStorage', () => {
  it('is the device itself when nobody is playing', () => {
    const device = new MapStorage()
    const storage = profileStorage(device, null, KEYS)

    storage.setItem(SAVE, 'doc')

    expect(Object.fromEntries(device.items)).toEqual({ [SAVE]: 'doc' })
    expect(storage.getItem(SAVE)).toBe('doc')
  })

  it('keeps the profile keys under the profile and passes every other key through', () => {
    const device = new MapStorage()
    const storage = profileStorage(device, 'child-ada', KEYS)

    storage.setItem(SAVE, 'ada doc')
    storage.setItem(FAVOURITES, '["kick"]')
    storage.setItem(PREFERENCE, 'dark')

    expect(Object.fromEntries(device.items)).toEqual({
      [`${SAVE}@child-ada`]: 'ada doc',
      [`${FAVOURITES}@child-ada`]: '["kick"]',
      [PREFERENCE]: 'dark',
    })
    expect(storage.getItem(SAVE)).toBe('ada doc')
    expect(storage.getItem(PREFERENCE)).toBe('dark')
  })

  it('never shows one profile another profile’s document', () => {
    const device = new MapStorage()
    profileStorage(device, 'child-ada', KEYS).setItem(SAVE, 'ada doc')

    expect(profileStorage(device, 'child-bo', KEYS).getItem(SAVE)).toBeNull()
  })

  it('copies the legacy documents into each profile on first open, and never touches them', () => {
    const device = new MapStorage()
    device.setItem(SAVE, 'legacy doc')
    device.setItem(FAVOURITES, '["snare"]')

    const ada = profileStorage(device, 'child-ada', KEYS)
    ada.setItem(SAVE, 'ada doc')
    const bo = profileStorage(device, 'child-bo', KEYS)

    expect(ada.getItem(SAVE)).toBe('ada doc')
    expect(ada.getItem(FAVOURITES)).toBe('["snare"]')
    expect(bo.getItem(SAVE)).toBe('legacy doc')
    expect(device.getItem(SAVE)).toBe('legacy doc')
    expect(device.getItem(FAVOURITES)).toBe('["snare"]')
  })

  it('does not adopt over a document the profile already has', () => {
    const device = new MapStorage()
    device.setItem(SAVE, 'legacy doc')
    device.setItem(`${SAVE}@child-ada`, 'ada doc')

    expect(profileStorage(device, 'child-ada', KEYS).getItem(SAVE)).toBe('ada doc')
  })

  it('opens without throwing when the device storage is unavailable', () => {
    const device = new MapStorage()
    device.unavailable = true

    expect(() => profileStorage(device, 'child-ada', KEYS)).not.toThrow()
  })
})

describe('memoryStorage', () => {
  it('holds what is written for its own lifetime and nothing longer', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE, 'doc')

    expect(storage.getItem(SAVE)).toBe('doc')
    expect(memoryStorage().getItem(SAVE)).toBeNull()
  })
})
