/**
 * The one merge hook between a device's save document and the account's
 * (ADR 0080 decision 3). Pure, and an idempotent union: neither side can take
 * a boop away from the other, at the price of a delete that can resurrect.
 */

import {
  SAVE_FORMAT_VERSION,
  type SaveDocument,
  type StoredBoop,
} from '../persistence/saveFormat.ts'

export function mergeSaveDocuments(local: SaveDocument, remote: SaveDocument): SaveDocument {
  const held = new Set(remote.creations.map(identity))
  const localOnly = local.creations.filter((boop) => !held.has(identity(boop)))
  return {
    version: SAVE_FORMAT_VERSION,
    working: local.working ?? remote.working,
    creations: [...remote.creations, ...localOnly],
  }
}

/**
 * Deep equality by canonical JSON: every boop here came out of
 * `decodeStoredBoop`, which rebuilds each object field by field in one order.
 */
function identity(boop: StoredBoop): string {
  return JSON.stringify(boop)
}
