import { storedBoardSchema, type StoredBoard } from '../../server/boardSchema.ts'

/** sessionStorage: per tab and origin, so it survives the trip through the gate and hub. */
export const KEEP_STASH_KEY = 'fridge:keep'

type StashStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** On Keep: the edited board for `/keep/<id>`, or no stash at all when nothing was edited. */
export function stashKeep(storage: StashStorage, id: string, edited: StoredBoard | null): void {
  if (edited === null) storage.removeItem(KEEP_STASH_KEY)
  else storage.setItem(KEEP_STASH_KEY, JSON.stringify({ id, board: edited }))
}

/**
 * The stashed board for `id`, removed as it is taken. A stash for another id is
 * left alone; one that cannot be read as a board is dropped.
 */
export function takeKeep(storage: StashStorage, id: string): StoredBoard | null {
  const raw = storage.getItem(KEEP_STASH_KEY)
  if (raw === null) return null
  let stash: unknown
  try {
    stash = JSON.parse(raw)
  } catch {
    storage.removeItem(KEEP_STASH_KEY)
    return null
  }
  const stashedId = (stash as { id?: unknown } | null)?.id
  if (typeof stashedId === 'string' && stashedId !== id) return null
  storage.removeItem(KEEP_STASH_KEY)
  const board = storedBoardSchema.safeParse((stash as { board?: unknown } | null)?.board)
  return typeof stashedId === 'string' && board.success ? board.data : null
}
