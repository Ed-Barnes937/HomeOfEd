import { useCallback, useState } from 'react'

import type { Kit, Pattern } from '../engine/sequencerEngine.ts'
import { boopFrom, type StoredBoop } from './saveFormat.ts'
import { deleteBoop, loadSaveDocument, renameBoop, saveBoop, type SaveStorage } from './storage.ts'

export interface UseBoopsResult {
  /** The "My boops" list, freshest after every `save`/`rename`/`remove`. */
  boops: readonly StoredBoop[]
  /**
   * Snapshots `pattern` and `tempo` under `name` — the name the save form was
   * showing at the moment of the press (ticket 32), generated or overtyped.
   * Returns the row it landed on, read off what is on disk rather than off
   * local state, so two saves inside one task still get distinct rows.
   */
  save: (kit: Kit, pattern: Pattern, tempo: number, name: string) => { index: number }
  rename: (index: number, name: string) => void
  remove: (index: number) => void
}

/**
 * Reads and writes the "My boops" list — the save document's `creations`
 * field (kept under that name, ADR 0025), separate from the autosaved
 * working grid `useWorkingGrid` owns. Re-reads the whole list from `storage`
 * after every write rather than mutating local state by hand, so it can
 * never drift from what's on disk.
 */
export function useBoops(storage: SaveStorage = window.localStorage): UseBoopsResult {
  const [boops, setBoops] = useState<readonly StoredBoop[]>(() => loadSaveDocument(storage).creations)

  const refresh = useCallback(() => {
    setBoops(loadSaveDocument(storage).creations)
  }, [storage])

  const save = useCallback(
    (kit: Kit, pattern: Pattern, tempo: number, name: string) => {
      const existing = loadSaveDocument(storage).creations
      saveBoop(storage, boopFrom(kit, pattern, tempo, name))
      refresh()
      return { index: existing.length }
    },
    [storage, refresh],
  )

  const rename = useCallback(
    (index: number, name: string) => {
      renameBoop(storage, index, name)
      refresh()
    },
    [storage, refresh],
  )

  const remove = useCallback(
    (index: number) => {
      deleteBoop(storage, index)
      refresh()
    },
    [storage, refresh],
  )

  return { boops, save, rename, remove }
}
