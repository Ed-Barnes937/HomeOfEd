// Node side: the save documents a device already holds, and what is on disk afterwards, per profile.
import { profileScopedKey } from '@hoe/accounts'
import type { Page } from '@playwright/test'

import type { ItemDef } from '../items/item.ts'
import { ITEMS } from '../items/registry.ts'
import {
  parseSaveDocument,
  SAVE_FORMAT_VERSION,
  serializeSaveDocument,
  type SaveDocument,
} from '../persistence/saveFormat.ts'

/** A save document whose shelf holds first-visit items of `def`'s kind with these names. */
export function shelfDocument(names: readonly string[], def: ItemDef = ITEMS.wand): string {
  return serializeSaveDocument({
    version: SAVE_FORMAT_VERSION,
    working: null,
    shelf: names.map((name) => ({ params: def.firstVisit(), name })),
  })
}

export function readSaveDocument(blob: string | null, def: ItemDef = ITEMS.wand): SaveDocument {
  return parseSaveDocument(def.schema, blob)
}

export function shelfNames(blob: string | null, def: ItemDef = ITEMS.wand): readonly string[] {
  return readSaveDocument(blob, def).shelf.map((item) => item.name ?? '')
}

/** The save document a device held before profiles existed, under the kind's unscoped key. */
export async function seedLegacySave(
  page: Page,
  blob: string,
  def: ItemDef = ITEMS.wand,
): Promise<void> {
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
    key: def.storageKey,
    value: blob,
  })
}

/** The kind's save document on disk for `accountId`, or the unscoped one for `null`. */
export async function readLocalSave(
  page: Page,
  accountId: string | null,
  def: ItemDef = ITEMS.wand,
): Promise<string | null> {
  return page.evaluate(
    (key) => window.localStorage.getItem(key),
    profileScopedKey(def.storageKey, accountId),
  )
}

/** Every key and value in this origin's localStorage and sessionStorage. */
export async function readAllStorage(
  page: Page,
): Promise<{ local: Record<string, string>; session: Record<string, string> }> {
  return page.evaluate(() => {
    const entries = (storage: Storage) => {
      const all: Record<string, string> = {}
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)!
        all[key] = storage.getItem(key)!
      }
      return all
    }
    return { local: entries(window.localStorage), session: entries(window.sessionStorage) }
  })
}
