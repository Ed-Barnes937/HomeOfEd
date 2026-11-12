// Node side: the save documents a device already holds, and a read of what is
// on disk afterwards, per profile (ADR 0094).
import { profileScopedKey } from '@hoe/accounts'
import type { Page } from '@playwright/test'

import { parseSaveDocument, type StoredBoop } from '../persistence/saveFormat.ts'
import { SAVE_KEY } from '../persistence/storage.ts'

export function boop(name: string): StoredBoop {
  return {
    name,
    kitId: 'launch',
    tempo: 100,
    patterns: [{ rows: [{ instrumentId: 'kick', steps: '1000000000000000' }] }],
  }
}

export function saveDocument(creations: readonly StoredBoop[]): string {
  return JSON.stringify({ version: 1, working: null, creations })
}

export function savedNames(blob: string | null): readonly string[] {
  return parseSaveDocument(blob).creations.map((creation) => creation.name)
}

/** The save document a device held before profiles existed, under the unscoped key. */
export async function seedLegacySave(page: Page, blob: string): Promise<void> {
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
    key: SAVE_KEY,
    value: blob,
  })
}

/** The save document on disk for `accountId`, or the unscoped one for `null`. */
export async function readLocalSave(page: Page, accountId: string | null): Promise<string | null> {
  return page.evaluate(
    (key) => window.localStorage.getItem(key),
    profileScopedKey(SAVE_KEY, accountId),
  )
}

/** Every key and value in this origin's localStorage. */
export async function readAllLocalStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const entries: Record<string, string> = {}
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)!
      entries[key] = window.localStorage.getItem(key)!
    }
    return entries
  })
}
