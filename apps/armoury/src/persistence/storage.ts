import type { ItemDef, StoredItem } from '../items/item.ts'
import {
  EMPTY_DOCUMENT,
  parseSaveDocument,
  serializeSaveDocument,
  type SaveDocument,
} from './saveFormat.ts'

/** The wand's key, as it has always been; the version lives inside the document (ADR 0074). */
export const SAVE_KEY = 'armoury:save'
/** Each kind has a document of its own, so an older build never rewrites a sword (ADR 0096). */
export const SWORD_SAVE_KEY = 'armoury:save:sword'

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadSaveDocument(storage: SaveStorage, def: ItemDef): SaveDocument {
  try {
    return parseSaveDocument(def.schema, storage.getItem(def.storageKey))
  } catch {
    return EMPTY_DOCUMENT
  }
}

export function writeWorking(storage: SaveStorage, def: ItemDef, working: StoredItem): void {
  writeDocument(storage, def, { ...loadSaveDocument(storage, def), working })
}

export function keepItem(storage: SaveStorage, def: ItemDef, item: StoredItem): void {
  const doc = loadSaveDocument(storage, def)
  writeDocument(storage, def, { ...doc, shelf: [...doc.shelf, item] })
}

export function renameItem(storage: SaveStorage, def: ItemDef, index: number, name: string): void {
  const trimmed = name.trim()
  const doc = loadSaveDocument(storage, def)
  const item = doc.shelf[index]
  if (trimmed === '' || !item) return
  const shelf = doc.shelf.map((kept, i) => (i === index ? { ...item, name: trimmed } : kept))
  writeDocument(storage, def, { ...doc, shelf })
}

export function removeItem(storage: SaveStorage, def: ItemDef, index: number): void {
  const doc = loadSaveDocument(storage, def)
  writeDocument(storage, def, { ...doc, shelf: doc.shelf.filter((_, i) => i !== index) })
}

function writeDocument(storage: SaveStorage, def: ItemDef, doc: SaveDocument): void {
  try {
    storage.setItem(def.storageKey, serializeSaveDocument(doc))
  } catch {
    // Quota or storage unavailable: drop the write rather than throw.
  }
}
