/**
 * The `boop:syncedAccount` marker: what this device answered when it was
 * offered the import, per account (ADR 0080). A new, additive key - the frozen
 * `boop:save` document (ADR 0025) is not touched by any of this.
 *
 * The answer is recorded, not merely that one was given, because `declined`
 * means no sync at all for that account - a parent who said no and then found
 * the boops on the account anyway has been misled. It is per account because a
 * family tablet is shared: a second child signing in on it is a first link of
 * their own, and the first child's answer is not theirs.
 *
 * Same never-throws seam as `persistence/storage.ts`, and the same total
 * decode: anything unreadable counts as "not asked yet", which only ever costs
 * a second offer and can never cost a boop.
 */

import type { SaveStorage } from '../persistence/storage.ts'

export const SYNCED_ACCOUNT_KEY = 'boop:syncedAccount'

/** An answer is recorded rather than a boolean, so changing it later is a write, not a migration. */
export type SyncAnswer = 'accepted' | 'declined'

export type SyncAnswers = Readonly<Record<string, SyncAnswer>>

/** `null` when this device has not been offered the import for `accountId` yet. */
export function readSyncAnswer(storage: SaveStorage, accountId: string): SyncAnswer | null {
  return readSyncAnswers(storage)[accountId] ?? null
}

export function recordSyncAnswer(
  storage: SaveStorage,
  accountId: string,
  answer: SyncAnswer,
): void {
  const answers = { ...readSyncAnswers(storage), [accountId]: answer }
  try {
    storage.setItem(SYNCED_ACCOUNT_KEY, JSON.stringify(answers))
  } catch {
    // Quota or storage unavailable - the offer comes back next time, no worse.
  }
}

function readSyncAnswers(storage: SaveStorage): SyncAnswers {
  let raw: string | null = null
  try {
    raw = storage.getItem(SYNCED_ACCOUNT_KEY)
  } catch {
    return {}
  }
  if (raw === null) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }

  // The marker's first shape was a plain list of the accounts that had been
  // asked, which only a device that had already accepted could be carrying.
  if (Array.isArray(parsed)) {
    return Object.fromEntries(
      parsed.filter((id): id is string => typeof id === 'string').map((id) => [id, 'accepted']),
    )
  }

  if (typeof parsed !== 'object' || parsed === null) return {}
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, SyncAnswer] =>
        entry[1] === 'accepted' || entry[1] === 'declined',
    ),
  )
}
