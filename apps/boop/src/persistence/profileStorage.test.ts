import { describe, expect, it } from 'vitest'

import { FAVOURITES_KEY } from './favourites.ts'
import { memoryStorage, profileStorage } from './profileStorage.ts'
import { SAVE_KEY } from './storage.ts'
import { FakeStorage } from './testing/fakeStorage.ts'

const DEVICE_PREFERENCE_KEY = 'boop:preference'

describe('profileStorage', () => {
  it('reads and writes the unscoped keys when nobody is playing', () => {
    const device = new FakeStorage()
    const storage = profileStorage(device, null)

    storage.setItem(SAVE_KEY, 'doc')
    storage.setItem(FAVOURITES_KEY, '["kick"]')

    expect([...device.store.keys()].sort()).toEqual([FAVOURITES_KEY, SAVE_KEY])
    expect(storage.getItem(SAVE_KEY)).toBe('doc')
  })

  it('keeps the save document and favourites under the profile, and the device preferences unscoped', () => {
    const device = new FakeStorage()
    const storage = profileStorage(device, 'child-ada')

    storage.setItem(SAVE_KEY, 'ada doc')
    storage.setItem(FAVOURITES_KEY, '["kick"]')
    storage.setItem(DEVICE_PREFERENCE_KEY, 'true')

    expect(Object.fromEntries(device.store)).toEqual({
      [`${SAVE_KEY}@child-ada`]: 'ada doc',
      [`${FAVOURITES_KEY}@child-ada`]: '["kick"]',
      [DEVICE_PREFERENCE_KEY]: 'true',
    })
    expect(storage.getItem(SAVE_KEY)).toBe('ada doc')
    expect(storage.getItem(DEVICE_PREFERENCE_KEY)).toBe('true')
  })

  it('one profile never reads another profile’s boops', () => {
    const device = new FakeStorage()
    profileStorage(device, 'child-ada').setItem(SAVE_KEY, 'ada doc')

    expect(profileStorage(device, 'child-bo').getItem(SAVE_KEY)).toBeNull()
  })

  it('copies the device’s legacy document into each profile on first open, leaving the legacy key alone', () => {
    const device = new FakeStorage()
    device.setItem(SAVE_KEY, 'legacy doc')
    device.setItem(FAVOURITES_KEY, '["snare"]')

    const ada = profileStorage(device, 'child-ada')
    ada.setItem(SAVE_KEY, 'ada doc')
    const bo = profileStorage(device, 'child-bo')

    expect(ada.getItem(SAVE_KEY)).toBe('ada doc')
    expect(ada.getItem(FAVOURITES_KEY)).toBe('["snare"]')
    expect(bo.getItem(SAVE_KEY)).toBe('legacy doc')
    expect(device.getItem(SAVE_KEY)).toBe('legacy doc')
    expect(device.getItem(FAVOURITES_KEY)).toBe('["snare"]')
  })

  it('does not adopt over a document the profile already has', () => {
    const device = new FakeStorage()
    device.setItem(SAVE_KEY, 'legacy doc')
    device.setItem(`${SAVE_KEY}@child-ada`, 'ada doc')

    expect(profileStorage(device, 'child-ada').getItem(SAVE_KEY)).toBe('ada doc')
  })

  it('never throws when the device storage is unavailable', () => {
    const device = new FakeStorage()
    device.unavailable = true

    expect(() => profileStorage(device, 'child-ada')).not.toThrow()
  })
})

describe('memoryStorage', () => {
  it('holds what is written for the life of the page and nothing longer', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY, 'doc')

    expect(storage.getItem(SAVE_KEY)).toBe('doc')
    expect(memoryStorage().getItem(SAVE_KEY)).toBeNull()
  })
})
