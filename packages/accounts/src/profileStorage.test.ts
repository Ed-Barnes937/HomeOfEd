import { describe, expect, it } from 'vitest'

import { memoryStorage, profileStorage, type StorageLike } from './profileStorage.ts'

const SAVE = 'app:save'
const SCENE = 'app:scene:'
const SAVES = { keys: [SAVE, 'app:favourites'], prefixes: [SCENE] }
const PREFERENCE = 'app:theme'

/** `localStorage` as far as these tests need it, with a quota that can run out. */
class DeviceStorage implements StorageLike {
  readonly items = new Map<string, string>()
  unavailable = false
  /** Writes left before the next one fails as a full quota does; null for no limit. */
  writesLeft: number | null = null

  get length(): number {
    return this.items.size
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    if (this.unavailable) throw new Error('storage unavailable')
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.unavailable) throw new Error('storage unavailable')
    if (this.writesLeft !== null) {
      if (this.writesLeft === 0) throw new Error('QuotaExceededError')
      this.writesLeft--
    }
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }

  clear(): void {
    this.items.clear()
  }
}

function listed(storage: StorageLike): string[] {
  return Array.from({ length: storage.length }, (_, i) => storage.key(i)!).sort()
}

describe('profileStorage', () => {
  it('is the device itself when nobody is playing', () => {
    const device = new DeviceStorage()
    const storage = profileStorage(device, null, SAVES)

    storage.setItem(SAVE, 'doc')
    storage.setItem(`${SCENE}1`, 'scene')

    expect(Object.fromEntries(device.items)).toEqual({ [SAVE]: 'doc', [`${SCENE}1`]: 'scene' })
  })

  it('keeps exact and prefixed keys under the profile and passes every other key through', () => {
    const device = new DeviceStorage()
    const storage = profileStorage(device, 'child-ada', SAVES)

    storage.setItem(SAVE, 'ada doc')
    storage.setItem(`${SCENE}1`, 'ada scene')
    storage.setItem(PREFERENCE, 'dark')

    expect(Object.fromEntries(device.items)).toEqual({
      [`${SAVE}@child-ada`]: 'ada doc',
      [`${SCENE}1@child-ada`]: 'ada scene',
      [PREFERENCE]: 'dark',
    })
    expect(storage.getItem(`${SCENE}1`)).toBe('ada scene')
    expect(storage.getItem(PREFERENCE)).toBe('dark')
  })

  it('lists only this profile’s keys, by their unscoped names', () => {
    const device = new DeviceStorage()
    device.setItem(`${SCENE}legacy`, 'legacy')
    device.setItem(PREFERENCE, 'dark')
    const ada = profileStorage(device, 'child-ada', SAVES)
    ada.setItem(SAVE, 'ada doc')
    ada.setItem(`${SCENE}2`, 'ada scene')
    profileStorage(device, 'child-bo', SAVES).setItem(`${SCENE}3`, 'bo scene')

    expect(listed(ada)).toEqual([SAVE, `${SCENE}2`, `${SCENE}legacy`].sort())
    expect(listed(profileStorage(device, null, SAVES))).toEqual([`${SCENE}legacy`])
  })

  it('removes and clears this profile’s keys only', () => {
    const device = new DeviceStorage()
    const ada = profileStorage(device, 'child-ada', SAVES)
    const bo = profileStorage(device, 'child-bo', SAVES)
    ada.setItem(`${SCENE}1`, 'ada')
    ada.setItem(SAVE, 'ada doc')
    bo.setItem(`${SCENE}1`, 'bo')
    device.setItem(PREFERENCE, 'dark')

    ada.removeItem(`${SCENE}1`)
    expect(ada.getItem(`${SCENE}1`)).toBeNull()
    expect(bo.getItem(`${SCENE}1`)).toBe('bo')

    ada.clear()
    expect(listed(ada)).toEqual([])
    expect(listed(bo)).toEqual([`${SCENE}1`])
    expect(device.getItem(PREFERENCE)).toBe('dark')
  })

  it('never shows one profile another profile’s document', () => {
    const device = new DeviceStorage()
    profileStorage(device, 'child-ada', SAVES).setItem(SAVE, 'ada doc')

    expect(profileStorage(device, 'child-bo', SAVES).getItem(SAVE)).toBeNull()
  })

  it('copies the legacy documents into each profile on first open, and never touches them', () => {
    const device = new DeviceStorage()
    device.setItem(SAVE, 'legacy doc')
    device.setItem(`${SCENE}1`, 'legacy one')
    device.setItem(`${SCENE}2`, 'legacy two')

    const ada = profileStorage(device, 'child-ada', SAVES)
    ada.setItem(SAVE, 'ada doc')
    ada.removeItem(`${SCENE}1`)
    const bo = profileStorage(device, 'child-bo', SAVES)

    expect(bo.getItem(SAVE)).toBe('legacy doc')
    expect(listed(bo)).toEqual([SAVE, `${SCENE}1`, `${SCENE}2`].sort())
    expect(device.getItem(SAVE)).toBe('legacy doc')
    expect(device.getItem(`${SCENE}1`)).toBe('legacy one')
    // A second open adopts nothing over what the profile has made its own.
    expect(listed(profileStorage(device, 'child-ada', SAVES))).toEqual([SAVE, `${SCENE}2`].sort())
    expect(profileStorage(device, 'child-ada', SAVES).getItem(SAVE)).toBe('ada doc')
  })

  it('adopts a prefix all or nothing, and tries again on the next open after a full quota', () => {
    const device = new DeviceStorage()
    device.setItem(`${SCENE}1`, 'one')
    device.setItem(`${SCENE}2`, 'two')
    device.writesLeft = 1

    const first = profileStorage(device, 'child-ada', { prefixes: [SCENE] })
    expect(listed(first)).toEqual([])

    device.writesLeft = null
    const second = profileStorage(device, 'child-ada', { prefixes: [SCENE] })
    expect(listed(second)).toEqual([`${SCENE}1`, `${SCENE}2`])
  })

  it('opens without throwing when the device storage is unavailable', () => {
    const device = new DeviceStorage()
    device.unavailable = true

    expect(() => profileStorage(device, 'child-ada', SAVES)).not.toThrow()
  })
})

describe('memoryStorage', () => {
  it('holds what is written for its own lifetime and nothing longer', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE, 'doc')
    storage.setItem(`${SCENE}1`, 'scene')
    storage.removeItem(`${SCENE}1`)

    expect(storage.getItem(SAVE)).toBe('doc')
    expect(listed(storage)).toEqual([SAVE])
    expect(memoryStorage().getItem(SAVE)).toBeNull()
  })
})
