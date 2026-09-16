import { useCallback, useState } from 'react'

import { loadFavourites, toggleFavourite } from './favourites.ts'
import type { SaveStorage } from './storage.ts'

export interface UseFavouritesResult {
  /** The starred instrument ids, as stored — freshest after every `toggle`. */
  favourites: readonly string[]
  toggle: (instrumentId: string) => void
}

/**
 * Reads and writes the favourite sounds (ticket 01) — `useBoops`'s idiom over
 * the `boop:favourites` key: re-read from `storage` after every write rather
 * than mutating local state by hand, so it can never drift from what's on disk.
 */
export function useFavourites(storage: SaveStorage = window.localStorage): UseFavouritesResult {
  const [favourites, setFavourites] = useState<readonly string[]>(() => loadFavourites(storage))

  const toggle = useCallback(
    (instrumentId: string) => {
      toggleFavourite(storage, instrumentId)
      setFavourites(loadFavourites(storage))
    },
    [storage],
  )

  return { favourites, toggle }
}
