import type { StoredBoop } from '../../persistence/saveFormat.ts'
import { loadSaveDocument, saveBoop, type SaveStorage } from '../../persistence/storage.ts'
import { generateBoopName } from './boopNames.ts'

/**
 * The one-tap save behind "Save it" on the New boop keep-card (boop-clips
 * ticket 03): the working song lands in "My boops" under the same automatic
 * name the panel's save form would have offered, with no dialog and no typing.
 * Returns the name it used.
 *
 * The names are read off disk at the moment of the tap rather than from any
 * list held in React, for the reason `useBoops.save` gives: a `BoopsPanel`
 * mounted earlier in the session holds its own copy, and generating from a
 * stale one would hand two boops the same name.
 */
export function quickSaveBoop(
  storage: SaveStorage,
  workingBoop: (name: string) => StoredBoop,
): string {
  const existing = loadSaveDocument(storage).creations
  const name = generateBoopName(existing.map((boop) => boop.name))
  saveBoop(storage, workingBoop(name))
  return name
}
