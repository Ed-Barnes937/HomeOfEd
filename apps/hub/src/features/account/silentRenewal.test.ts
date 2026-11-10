import { describe, expect, it } from 'vitest'

import {
  forgetProfile,
  recordSilentRenewal,
  rememberedProfile,
  rememberProfile,
  SILENT_RENEWAL_KEY,
  SILENT_RENEWAL_WINDOW_MS,
  silentRenewalAllowed,
  type KeyValueStorage,
} from './silentRenewal.ts'

function memoryStorage(): KeyValueStorage {
  const entries = new Map<string, string>()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  }
}

const unavailable: KeyValueStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('SecurityError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

describe('the remembered profile', () => {
  it('is the last profile picked on this device', () => {
    const storage = memoryStorage()
    expect(rememberedProfile(storage)).toBeNull()

    rememberProfile('robin', storage)
    rememberProfile('ada', storage)

    expect(rememberedProfile(storage)).toBe('ada')
  })

  it('is forgotten outright, as on sign-out', () => {
    const storage = memoryStorage()
    rememberProfile('robin', storage)

    forgetProfile(undefined, storage)

    expect(rememberedProfile(storage)).toBeNull()
  })

  it('is forgotten for one profile only when that is the one remembered', () => {
    const storage = memoryStorage()
    rememberProfile('robin', storage)

    forgetProfile('ada', storage)
    expect(rememberedProfile(storage)).toBe('robin')

    forgetProfile('robin', storage)
    expect(rememberedProfile(storage)).toBeNull()
  })

  it('reads as nothing when storage is unavailable, and writing never throws', () => {
    expect(rememberedProfile(unavailable)).toBeNull()
    expect(() => rememberProfile('robin', unavailable)).not.toThrow()
    expect(() => forgetProfile(undefined, unavailable)).not.toThrow()
  })
})

describe('the silent renewal loop guard', () => {
  const BOOP = 'https://boop.homeofed.com/'
  const SILT = 'https://silt.homeofed.com/'
  const t0 = 1_800_000_000_000

  it('allows a first renewal', () => {
    expect(silentRenewalAllowed(BOOP, t0, memoryStorage())).toBe(true)
  })

  it('refuses a second renewal for the same returnTo inside the window', () => {
    const storage = memoryStorage()
    recordSilentRenewal(BOOP, t0, storage)

    expect(silentRenewalAllowed(BOOP, t0 + 1, storage)).toBe(false)
    expect(silentRenewalAllowed(BOOP, t0 + SILENT_RENEWAL_WINDOW_MS - 1, storage)).toBe(false)
  })

  it('allows it again once the window has passed', () => {
    const storage = memoryStorage()
    recordSilentRenewal(BOOP, t0, storage)

    expect(silentRenewalAllowed(BOOP, t0 + SILENT_RENEWAL_WINDOW_MS, storage)).toBe(true)
  })

  it('is per returnTo', () => {
    const storage = memoryStorage()
    recordSilentRenewal(BOOP, t0, storage)
    recordSilentRenewal(SILT, t0 + 1, storage)

    expect(silentRenewalAllowed(BOOP, t0 + 2, storage)).toBe(false)
    expect(silentRenewalAllowed(SILT, t0 + 2, storage)).toBe(false)
    expect(silentRenewalAllowed('https://fridge.homeofed.com/', t0 + 2, storage)).toBe(true)
  })

  it('refuses while the device clock reads earlier than the recorded renewal', () => {
    const storage = memoryStorage()
    recordSilentRenewal(BOOP, t0, storage)

    expect(silentRenewalAllowed(BOOP, t0 - 5_000, storage)).toBe(false)
  })

  it('refuses when storage is unavailable, since a loop could not be seen', () => {
    expect(silentRenewalAllowed(BOOP, t0, unavailable)).toBe(false)
    expect(recordSilentRenewal(BOOP, t0, unavailable)).toBe(false)
  })

  it('says whether the record was written, so an unrecorded renewal is not attempted', () => {
    expect(recordSilentRenewal(BOOP, t0, memoryStorage())).toBe(true)

    const full = { ...memoryStorage(), setItem: unavailable.setItem }
    expect(silentRenewalAllowed(BOOP, t0, full)).toBe(true)
    expect(recordSilentRenewal(BOOP, t0, full)).toBe(false)
  })

  it('treats an unreadable record as no record', () => {
    const storage = memoryStorage()
    storage.setItem(SILENT_RENEWAL_KEY, 'not json')

    expect(silentRenewalAllowed(BOOP, t0, storage)).toBe(true)
  })
})
