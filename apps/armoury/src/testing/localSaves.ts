// Node side: the save documents a device already holds, and what is on disk afterwards, per profile.
import { profileScopedKey } from '@hoe/accounts'
import type { Page } from '@playwright/test'

import { normalise } from '../engine/schema.ts'
import {
  parseSaveDocument,
  SAVE_FORMAT_VERSION,
  serializeSaveDocument,
} from '../persistence/saveFormat.ts'
import { SAVE_KEY } from '../persistence/storage.ts'
import { wandSchema } from '../wand/wandSchema.ts'

/** A save document whose shelf holds oak wands with these names. */
export function shelfDocument(names: readonly string[]): string {
  return serializeSaveDocument({
    version: SAVE_FORMAT_VERSION,
    working: null,
    shelf: names.map((name) => ({ params: normalise(wandSchema, { wood: 'oak' }), name })),
  })
}

export function shelfNames(blob: string | null): readonly string[] {
  return parseSaveDocument(blob).shelf.map((wand) => wand.name ?? '')
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
