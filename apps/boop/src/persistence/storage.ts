/**
 * The `localStorage` seam. Every function takes the storage it works on
 * (`window.localStorage` in the app, `FakeStorage` in tests) and never throws:
 * a browser with storage disabled or a full quota costs the child their
 * autosave, not the app.
 */

import {
  EMPTY_DOCUMENT,
  parseSaveDocument,
  serializeSaveDocument,
  type SaveDocument,
  type StoredCreation,
} from './saveFormat.ts'

/** One key holds the whole document; the version lives inside it, not in the key. */
export const SAVE_KEY = 'boop:save'

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadSaveDocument(storage: SaveStorage): SaveDocument {
  try {
    return parseSaveDocument(storage.getItem(SAVE_KEY))
  } catch {
    return EMPTY_DOCUMENT
  }
}

/** Replace the autosaved working grid, keeping the saved-creations list intact. */
export function writeWorkingCreation(storage: SaveStorage, working: StoredCreation): void {
  const next = { ...loadSaveDocument(storage), working }
  try {
    storage.setItem(SAVE_KEY, serializeSaveDocument(next))
  } catch {
    // Quota or storage unavailable — drop the save rather than throw.
  }
}
