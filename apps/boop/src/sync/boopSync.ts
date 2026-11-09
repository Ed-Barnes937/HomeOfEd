/**
 * Copying the save document to and from the family SaveStore (ADR 0080,
 * first-slice spec §7.1). localStorage is the source of truth: every write has
 * already landed there before anything here runs, this module only ever copies,
 * and neither call below ever rejects - the service being gone has to look
 * exactly like today's boop.
 */

import type { FamilySaveContract } from '@hoe/accounts'

import {
  parseSaveDocument,
  serializeSaveDocument,
  type SaveDocument,
} from '../persistence/saveFormat.ts'
import { SAVE_KEY, type SaveStorage } from '../persistence/storage.ts'
import { mergeSaveDocuments } from './mergeSaveDocuments.ts'

/** The SaveStore's app id for boop; `slotKey` is the localStorage key verbatim (spec §4.6). */
export const BOOP_APP_ID = 'boop'

export interface BoopSyncOpts {
  client: FamilySaveContract
  storage: SaveStorage
}

export interface BoopSync {
  /**
   * Pull the account's slot, merge it into localStorage, and push the union
   * back when the account is missing something. Arms `pushIfChanged`.
   */
  reconcile(): Promise<void>
  /** Copy the document up if its bytes have changed since the last attempt. */
  pushIfChanged(): Promise<void>
}

export function createBoopSync({ client, storage }: BoopSyncOpts): BoopSync {
  /**
   * The bytes of the last `put` *attempt*, successful or not. A rejected push
   * is not retried until the document changes again, which is what keeps a
   * permanent refusal (a slot over the 256 KiB cap) from becoming a loop.
   */
  let lastAttempted: string | null = null
  /**
   * A device may only overwrite the account with a document it has already
   * merged the account's own into. Until the pull has succeeded, this session
   * pushes nothing: a save is LWW per slot, so a device that never saw the
   * other device's boops must not be allowed to replace them.
   */
  let merged = false

  async function put(blob: string): Promise<void> {
    lastAttempted = blob
    await client.put({ appId: BOOP_APP_ID, slotKey: SAVE_KEY, blob })
  }

  return {
    async reconcile(): Promise<void> {
      try {
        const remote = await client.get({ appId: BOOP_APP_ID, slotKey: SAVE_KEY })
        const remoteDocument = parseSaveDocument(remote?.blob ?? null)
        // Read local only now the request has answered: a lull may have ended
        // mid-flight, and that autosave is fresher than anything read before it.
        const localDocument = readLocalDocument(storage)
        const union = canonical(mergeSaveDocuments(localDocument, remoteDocument))

        if (union !== canonical(localDocument)) writeLocal(storage, union)
        if (union !== canonical(remoteDocument)) await put(union)
        else lastAttempted = union
        merged = true
      } catch {
        // The account is an extra, never a dependency: localStorage already
        // holds everything the child made.
      }
    },

    async pushIfChanged(): Promise<void> {
      if (!merged) return
      try {
        const blob = canonical(readLocalDocument(storage))
        if (blob === lastAttempted) return
        await put(blob)
      } catch {
        // Retried by the next change, per the push contract.
      }
    },
  }
}

/**
 * Both sides are compared and pushed as re-serialized documents rather than as
 * raw bytes, so a corrupted or foreign value under the key can never travel to
 * the family's other devices.
 */
function canonical(document_: SaveDocument): string {
  return serializeSaveDocument(document_)
}

function readLocalDocument(storage: SaveStorage): SaveDocument {
  return parseSaveDocument(storage.getItem(SAVE_KEY))
}

function writeLocal(storage: SaveStorage, blob: string): void {
  storage.setItem(SAVE_KEY, blob)
}
