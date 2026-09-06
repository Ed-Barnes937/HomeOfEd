/**
 * Favourite sounds (boop-favourites ticket 01) — instrument ids under their own
 * `localStorage` key, in `storage.ts`'s seam idiom: every function takes the
 * storage it works on and never throws. Deliberately **not** in the `boop:save`
 * document: a favourite is a preference, not part of a boop, and ADR 0025's v1
 * shape stays frozen.
 */

import type { SaveStorage } from './storage.ts'

export const FAVOURITES_KEY = 'boop:favourites'

/**
 * The stored ids, verbatim. A missing, corrupt, or unreadable blob reads as no
 * favourites, never an error. Ids the loaded kit no longer contains are kept —
 * filtering against the kit is the picker's job (`instrumentSections`), so a
 * favourite from a bigger future kit survives a visit under a smaller one.
 */
export function loadFavourites(storage: SaveStorage): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(FAVOURITES_KEY) ?? 'null')
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      return parsed
    }
    return []
  } catch {
    return []
  }
}

/** Star or unstar one sound, leaving every other stored id — known or not — alone. */
export function toggleFavourite(storage: SaveStorage, instrumentId: string): void {
  const favourites = loadFavourites(storage)
  const toggled = favourites.includes(instrumentId)
    ? favourites.filter((id) => id !== instrumentId)
    : [...favourites, instrumentId]
  try {
    storage.setItem(FAVOURITES_KEY, JSON.stringify(toggled))
  } catch {
    // Quota or storage unavailable — drop the write rather than throw.
  }
}
