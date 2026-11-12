/** The slice of `localStorage` adoption needs; `window.localStorage` satisfies it. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** `key` for a signed-out device, `key@<accountId>` for a profile. */
export function profileScopedKey(key: string, accountId: string | null): string {
  return accountId === null ? key : `${key}@${accountId}`
}

/**
 * Copies the device's unscoped document into the profile's key the first time
 * the profile opens the app. Copy, never move: the unscoped key is not written
 * or removed, so every profile on the device can adopt it. True when it copied.
 */
export function adoptLegacyDocument(
  storage: KeyValueStorage,
  key: string,
  accountId: string | null,
): boolean {
  if (accountId === null) return false
  const scoped = profileScopedKey(key, accountId)
  if (storage.getItem(scoped) !== null) return false
  const legacy = storage.getItem(key)
  if (legacy === null) return false
  storage.setItem(scoped, legacy)
  return true
}
