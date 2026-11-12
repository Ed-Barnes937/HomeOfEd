import { normalise, type ItemSchema } from '../engine/schema.ts'
import type { StoredItem } from '../items/item.ts'

/** Bumped only for a breaking shape change; an unknown version reads as empty. */
export const SAVE_FORMAT_VERSION = 1

/** One kind's saves: `working` is the item on the counter; `shelf` is oldest first. */
export interface SaveDocument {
  version: number
  working: StoredItem | null
  shelf: readonly StoredItem[]
}

export const EMPTY_DOCUMENT: SaveDocument = {
  version: SAVE_FORMAT_VERSION,
  working: null,
  shelf: [],
}

export function serializeSaveDocument(doc: SaveDocument): string {
  return JSON.stringify(doc)
}

/** Total: never throws. A broken shelf entry is dropped on its own (ADR 0074). */
export function parseSaveDocument(schema: ItemSchema, raw: string | null): SaveDocument {
  if (raw === null || raw === '') return EMPTY_DOCUMENT
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return EMPTY_DOCUMENT
  }
  if (!isRecord(parsed) || parsed.version !== SAVE_FORMAT_VERSION) return EMPTY_DOCUMENT
  if (!Array.isArray(parsed.shelf)) return EMPTY_DOCUMENT

  const shelf = parsed.shelf
    .map((entry) => decodeStored(schema, entry))
    .filter((item): item is StoredItem => item !== null)
  return { version: SAVE_FORMAT_VERSION, working: decodeStored(schema, parsed.working), shelf }
}

/** Shared with the share-link codec, so a link and a save obey the same rules. */
export function decodeStored(schema: ItemSchema, value: unknown): StoredItem | null {
  if (!isRecord(value) || !isRecord(value.params)) return null
  if (value.name !== undefined && typeof value.name !== 'string') return null
  const item: StoredItem = { params: normalise(schema, value.params) }
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (name !== '') item.name = name
  return item
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
