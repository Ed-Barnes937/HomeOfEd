/**
 * The `boop:syncedAccount` marker: which accounts this device has already been
 * offered the import for (ADR 0080). A new, additive key - the frozen
 * `boop:save` document (ADR 0025) is not touched by any of this.
 *
 * A list rather than one id, because a family tablet is shared: a second child
 * signing in on it is a first link of its own, and the first child's answer is
 * not theirs. Same never-throws seam as `persistence/storage.ts`, and the same
 * total decode - anything unreadable counts as "not offered yet", which only
 * ever costs a second offer and can never cost a boop.
 */

import type { SaveStorage } from '../persistence/storage.ts'

export const SYNCED_ACCOUNT_KEY = 'boop:syncedAccount'

export function hasSyncedAccount(storage: SaveStorage, accountId: string): boolean {
  return readSyncedAccounts(storage).includes(accountId)
}

export function stampSyncedAccount(storage: SaveStorage, accountId: string): void {
  const stamped = readSyncedAccounts(storage)
  if (stamped.includes(accountId)) return
  try {
    storage.setItem(SYNCED_ACCOUNT_KEY, JSON.stringify([...stamped, accountId]))
  } catch {
    // Quota or storage unavailable - the offer comes back next time, no worse.
  }
}

function readSyncedAccounts(storage: SaveStorage): readonly string[] {
  let raw: string | null = null
  try {
    raw = storage.getItem(SYNCED_ACCOUNT_KEY)
  } catch {
    return []
  }
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}
