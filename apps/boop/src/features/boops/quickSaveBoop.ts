import type { StoredBoop } from '../../persistence/saveFormat.ts'
import { loadSaveDocument, saveBoop, type SaveStorage } from '../../persistence/storage.ts'
import { generateBoopName } from './boopNames.ts'

/**
 * The one-tap save behind "Save it" on the New boop keep-card (boop-clips
 * ticket 03): the working song lands in "My boops" under the same automatic
 * name the panel's save form would have offered, with no dialog and no typing.
 * Returns the name it used.
 *
 * `BoopsPanel` derives that name from the list it is rendering; this caller
 * renders no list at all, so it reads the names off disk at the moment of the
 * tap - the same discipline `getShareUrl` and `getWorkingBoop` follow, and the
 * only way the two save routes cannot hand two boops the same name. The naming
 * rule itself is `generateBoopName`'s, shared, so there is one definition of
 * "Boop N" however a boop is saved.
 */
export function quickSaveBoop(
  storage: SaveStorage,
  boopNamed: (name: string) => StoredBoop,
): string {
  const existing = loadSaveDocument(storage).creations
  const name = generateBoopName(existing.map((boop) => boop.name))
  saveBoop(storage, boopNamed(name))
  return name
}
