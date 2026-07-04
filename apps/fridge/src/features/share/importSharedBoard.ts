import { loadState, saveState, type StoredBoard } from '../board/serialize.ts'

/** storedBoardSchema caps a board name at 60 chars — the tagged name must fit. */
const MAX_NAME = 60

type BoardStorage = Pick<Storage, 'getItem' | 'setItem'>

/** The imported board's name: the shared name tagged "(shared)", capped to 60. */
export function importedName(name: string): string {
  const full = `${name} (shared)`
  return full.length <= MAX_NAME ? full : full.slice(0, MAX_NAME)
}

/**
 * A fetched shared payload turned into a local board — a new "(shared)" fridge
 * the visitor can edit (ADR 0010: import-on-open, no server-side edit).
 * `w`/`h`/`z`/`id` are recomputed by `fromStoredBoard` on load, so the payload
 * only needs its stored fields.
 */
export function buildImportedBoard(payload: StoredBoard): StoredBoard {
  return { ...payload, name: importedName(payload.name) }
}

/** Upsert a board into a saved list by name — the same semantics as Save. */
function upsertByName(list: StoredBoard[], board: StoredBoard): StoredBoard[] {
  const idx = list.findIndex((b) => b.name === board.name)
  if (idx < 0) return [...list, board]
  const next = list.slice()
  next[idx] = board
  return next
}

/**
 * Import a fetched shared payload as a new local fridge: it becomes both the
 * current board and a saved chip (upserted by name, matching Save), tagged
 * "(shared)". `useFridgeBoard` reads current + saved on its next mount (the
 * /b/$id route redirects to '/' right after), so the imported board shows with
 * its chip active. Preserves the visitor's other saved fridges. Returns the
 * imported board.
 */
export function importSharedBoard(storage: BoardStorage, payload: StoredBoard): StoredBoard {
  const board = buildImportedBoard(payload)
  const { saved } = loadState(storage)
  saveState(storage, board, upsertByName(saved, board))
  return board
}
