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
  writeDocument(storage, { ...loadSaveDocument(storage), working })
}

/** Append `creation` to "My grooves", keeping the autosaved working grid intact. */
export function saveCreation(storage: SaveStorage, creation: StoredCreation): void {
  const doc = loadSaveDocument(storage)
  writeDocument(storage, { ...doc, creations: [...doc.creations, creation] })
}

/**
 * Rename the creation at `index`. A blank (once trimmed) name is a no-op —
 * rename is optional, never a way to blank out a groove's name (design
 * handoff §5: "the field is a rename, not a gate").
 */
export function renameCreation(storage: SaveStorage, index: number, name: string): void {
  const trimmed = name.trim()
  if (trimmed === '') return
  const doc = loadSaveDocument(storage)
  const creation = doc.creations[index]
  if (!creation) return
  const creations = doc.creations.map((c, i) => (i === index ? { ...creation, name: trimmed } : c))
  writeDocument(storage, { ...doc, creations })
}

/** Throw away the creation at `index`. No cap, no confirmation here — that's the caller's job. */
export function deleteCreation(storage: SaveStorage, index: number): void {
  const doc = loadSaveDocument(storage)
  writeDocument(storage, { ...doc, creations: doc.creations.filter((_, i) => i !== index) })
}

function writeDocument(storage: SaveStorage, doc: SaveDocument): void {
  try {
    storage.setItem(SAVE_KEY, serializeSaveDocument(doc))
  } catch {
    // Quota or storage unavailable — drop the write rather than throw.
  }
}
