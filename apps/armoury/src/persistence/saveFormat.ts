import { normalise, type Params } from '../engine/schema.ts'
import { wandSchema } from '../wand/wandSchema.ts'

/** Bumped only for a breaking shape change; an unknown version reads as empty. */
export const SAVE_FORMAT_VERSION = 1

/** A wand as stored and shared. `name` is absent until a child renames it. */
export interface StoredWand {
  params: Params
  name?: string
}

/** `working` is the wand on the counter; `shelf` is "Your shelf", oldest first. */
export interface SaveDocument {
  version: number
  working: StoredWand | null
  shelf: readonly StoredWand[]
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
export function parseSaveDocument(raw: string | null): SaveDocument {
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
    .map(decodeStoredWand)
    .filter((wand): wand is StoredWand => wand !== null)
  return { version: SAVE_FORMAT_VERSION, working: decodeStoredWand(parsed.working), shelf }
}

/** Shared with the share-link codec, so a link and a save obey the same rules. */
export function decodeStoredWand(value: unknown): StoredWand | null {
  if (!isRecord(value) || !isRecord(value.params)) return null
  if (value.name !== undefined && typeof value.name !== 'string') return null
  const wand: StoredWand = { params: normalise(wandSchema, value.params) }
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (name !== '') wand.name = name
  return wand
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
