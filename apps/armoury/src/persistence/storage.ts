import {
  EMPTY_DOCUMENT,
  parseSaveDocument,
  serializeSaveDocument,
  type SaveDocument,
  type StoredWand,
} from './saveFormat.ts'

/** The one localStorage key; the version lives inside the document (ADR 0074). */
export const SAVE_KEY = 'armoury:save'

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadSaveDocument(storage: SaveStorage): SaveDocument {
  try {
    return parseSaveDocument(storage.getItem(SAVE_KEY))
  } catch {
    return EMPTY_DOCUMENT
  }
}

export function writeWorkingWand(storage: SaveStorage, working: StoredWand): void {
  writeDocument(storage, { ...loadSaveDocument(storage), working })
}

export function keepWand(storage: SaveStorage, wand: StoredWand): void {
  const doc = loadSaveDocument(storage)
  writeDocument(storage, { ...doc, shelf: [...doc.shelf, wand] })
}

export function renameWand(storage: SaveStorage, index: number, name: string): void {
  const trimmed = name.trim()
  const doc = loadSaveDocument(storage)
  const wand = doc.shelf[index]
  if (trimmed === '' || !wand) return
  const shelf = doc.shelf.map((w, i) => (i === index ? { ...wand, name: trimmed } : w))
  writeDocument(storage, { ...doc, shelf })
}

export function removeWand(storage: SaveStorage, index: number): void {
  const doc = loadSaveDocument(storage)
  writeDocument(storage, { ...doc, shelf: doc.shelf.filter((_, i) => i !== index) })
}

function writeDocument(storage: SaveStorage, doc: SaveDocument): void {
  try {
    storage.setItem(SAVE_KEY, serializeSaveDocument(doc))
  } catch {
    // Quota or storage unavailable: drop the write rather than throw.
  }
}
