import { useCallback, useState } from 'react'

import type { Kit, Pattern } from '../engine/sequencerEngine.ts'
import { generateGrooveName } from '../features/grooves/grooveNames.ts'
import { creationFrom, type StoredCreation } from './saveFormat.ts'
import { deleteCreation, loadSaveDocument, renameCreation, saveCreation, type SaveStorage } from './storage.ts'

export interface UseGroovesResult {
  /** The "My grooves" list, freshest after every `save`/`rename`/`remove`. */
  creations: readonly StoredCreation[]
  /** Snapshots `pattern` and `tempo` under a generated name; the save has already happened. */
  save: (kit: Kit, pattern: Pattern, tempo: number) => { creation: StoredCreation; index: number }
  rename: (index: number, name: string) => void
  remove: (index: number) => void
}

/**
 * Reads and writes the "My grooves" list — the `creations` half of the save
 * document (ADR 0025), separate from the autosaved working grid `useWorkingGrid`
 * owns. Re-reads the whole list from `storage` after every write rather than
 * mutating local state by hand, so it can never drift from what's on disk.
 */
export function useGrooves(storage: SaveStorage = window.localStorage): UseGroovesResult {
  const [creations, setCreations] = useState<readonly StoredCreation[]>(
    () => loadSaveDocument(storage).creations,
  )

  const refresh = useCallback(() => {
    setCreations(loadSaveDocument(storage).creations)
  }, [storage])

  const save = useCallback(
    (kit: Kit, pattern: Pattern, tempo: number) => {
      const existing = loadSaveDocument(storage).creations
      const name = generateGrooveName(existing.map((c) => c.name))
      const creation = creationFrom(kit, pattern, tempo, name)
      saveCreation(storage, creation)
      refresh()
      return { creation, index: existing.length }
    },
    [storage, refresh],
  )

  const rename = useCallback(
    (index: number, name: string) => {
      renameCreation(storage, index, name)
      refresh()
    },
    [storage, refresh],
  )

  const remove = useCallback(
    (index: number) => {
      deleteCreation(storage, index)
      refresh()
    },
    [storage, refresh],
  )

  return { creations, save, rename, remove }
}
