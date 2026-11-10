import { adoptLegacyDocument, type KeyValueStorage, profileScopedKey } from './profileScopedKey.ts'

/**
 * `device` as the profile `accountId` sees it: each of `keys` is scoped with
 * `profileScopedKey`, every other key passes through. Opening it adopts the
 * legacy documents (copy, never move); a null account is the device unchanged.
 */
export function profileStorage(
  device: KeyValueStorage,
  accountId: string | null,
  keys: readonly string[],
): KeyValueStorage {
  for (const key of keys) {
    try {
      adoptLegacyDocument(device, key, accountId)
    } catch {
      // Quota or storage unavailable: the profile starts empty, the legacy key is untouched.
    }
  }
  const scoped = (key: string) => (keys.includes(key) ? profileScopedKey(key, accountId) : key)
  return {
    getItem: (key) => device.getItem(scoped(key)),
    setItem: (key, value) => device.setItem(scoped(key), value),
  }
}

/** Storage that lasts as long as the object: an app's `/shared` view writes nothing. */
export function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}
