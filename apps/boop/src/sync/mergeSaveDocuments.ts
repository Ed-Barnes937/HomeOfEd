/**
 * The one merge hook between a device's save document and the account's
 * (ADR 0080, first-slice spec §7.2). Pure: no storage, no client, no clock.
 *
 * Creations are a union - the account's list, then the creations only this
 * device holds - so neither side can take a boop away from the other. Working
 * is last-writer-wins, which is the limit [ADR 0080](../../../../docs/adr/0080-boop-is-the-first-savestore-client.md)
 * accepts, along with its twin: a boop deleted on one device reappears from the
 * other, because a union has nothing to tell a delete from a never-seen.
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
 * Deep equality by canonical JSON, which holds because every boop reaching
 * this function came out of `decodeStoredBoop`, and that rebuilds each object
 * field by field in one fixed order.
 *
 * Duplicates *within* the local list survive on purpose: two identical rows in
 * "My boops" are two rows a child saved, and collapsing them would be a loss.
 */
function identity(boop: StoredBoop): string {
  return JSON.stringify(boop)
}
