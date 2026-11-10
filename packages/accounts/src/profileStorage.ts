import { adoptLegacyDocument, type KeyValueStorage, profileScopedKey } from './profileScopedKey.ts'

/** The `localStorage` surface `profileStorage` reads and offers; `window.localStorage` satisfies it. */
export interface StorageLike extends KeyValueStorage {
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
  clear(): void
}

/** Which keys are a player's: exact names, and name prefixes such as `silt:scene:`. */
export interface ProfileKeys {
  keys?: readonly string[]
  prefixes?: readonly string[]
}

/** `device` as `accountId` sees it: profile keys stored as `key@<accountId>` and listed unscoped, the rest
 *  passed through unlisted; opening it adopts legacy documents. README "In a gated app's browser code". */
export function profileStorage(
  device: StorageLike,
  accountId: string | null,
  profileKeys: ProfileKeys,
): StorageLike {
  const exact = profileKeys.keys ?? []
  const prefixes = profileKeys.prefixes ?? []
  const isProfileKey = (key: string) =>
    exact.includes(key) ||
    prefixes.some((prefix) => key.startsWith(prefix) && !key.slice(prefix.length).includes('@'))
  const scoped = (key: string) => (isProfileKey(key) ? profileScopedKey(key, accountId) : key)
  const suffix = accountId === null ? '' : `@${accountId}`

  /** This profile's keys on the device, by unscoped name. */
  function own(): string[] {
    const names: string[] = []
    for (const key of deviceKeys(device)) {
      if (!key.endsWith(suffix)) continue
      const name = key.slice(0, key.length - suffix.length)
      if (isProfileKey(name)) names.push(name)
    }
    return names
  }

  if (accountId !== null) adoptLegacy(device, accountId, exact, prefixes, isProfileKey)

  return {
    getItem: (key) => device.getItem(scoped(key)),
    setItem: (key, value) => device.setItem(scoped(key), value),
    removeItem: (key) => device.removeItem(scoped(key)),
    key: (index) => own()[index] ?? null,
    get length() {
      return own().length
    },
    clear: () => {
      for (const name of own()) device.removeItem(scoped(name))
    },
  }
}

/** Storage that lasts as long as the object: an app's `/shared` view writes nothing. */
export function memoryStorage(): StorageLike {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size
    },
    clear: () => values.clear(),
  }
}

// A full quota leaves nothing half-written, so the next open simply tries again.
function adoptLegacy(
  device: StorageLike,
  accountId: string,
  exact: readonly string[],
  prefixes: readonly string[],
  isProfileKey: (key: string) => boolean,
): void {
  for (const key of exact) {
    try {
      adoptLegacyDocument(device, key, accountId)
    } catch {
      // Quota or storage unavailable: retried on the next open.
    }
  }
  for (const prefix of prefixes) {
    const written: string[] = []
    try {
      const keys = deviceKeys(device)
      const inPrefix = (key: string) => key.startsWith(prefix)
      if (keys.some((key) => inPrefix(key) && key.endsWith(`@${accountId}`))) continue
      for (const key of keys.filter((key) => inPrefix(key) && isProfileKey(key))) {
        const target = profileScopedKey(key, accountId)
        device.setItem(target, device.getItem(key) ?? '')
        written.push(target)
      }
    } catch {
      for (const target of written) device.removeItem(target)
    }
  }
}

function deviceKeys(device: StorageLike): string[] {
  return Array.from({ length: device.length }, (_, i) => device.key(i)).filter(
    (key): key is string => key !== null,
  )
}
