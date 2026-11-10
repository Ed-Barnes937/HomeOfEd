/**
 * Whose boops these are (ADR 0094): the save document and the favourites live
 * under the playing profile's own keys, and every other key (device
 * preferences) passes straight through. Everything that persists takes one of
 * these instead of `window.localStorage`, so `persistence/` and `sync/` keep
 * naming the unscoped keys and never learn about profiles.
 */

import { adoptLegacyDocument, profileScopedKey } from '@hoe/accounts'

import { FAVOURITES_KEY } from './favourites.ts'
import { SAVE_KEY, type SaveStorage } from './storage.ts'

/** The keys that belong to a player rather than to the device. */
export const PROFILE_KEYS: readonly string[] = [SAVE_KEY, FAVOURITES_KEY]

/**
 * `device` seen as `accountId` sees it. On first open the device's legacy
 * documents are copied in, never moved (spec decision 8). A null account is
 * the device itself, unchanged.
 */
export function profileStorage(device: SaveStorage, accountId: string | null): SaveStorage {
  for (const key of PROFILE_KEYS) {
    try {
      adoptLegacyDocument(device, key, accountId)
    } catch {
      // Quota or storage unavailable: the profile starts empty, the legacy key is untouched.
    }
  }
  const scoped = (key: string) =>
    PROFILE_KEYS.includes(key) ? profileScopedKey(key, accountId) : key
  return {
    getItem: (key) => device.getItem(scoped(key)),
    setItem: (key, value) => device.setItem(scoped(key), value),
  }
}

/** Storage that lasts as long as the page: the shared view writes nothing (spec decision 6). */
export function memoryStorage(): SaveStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}
