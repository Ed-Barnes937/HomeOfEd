/**
 * Copying the save document to and from the family SaveStore (ADR 0080).
 * localStorage is the source of truth: this module only ever copies, and
 * neither call below ever rejects.
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
  /** The bytes of the last `put` attempt, successful or not (ADR 0080 decision 6). */
  let lastAttempted: string | null = null
  /** The raw value this module last looked at, so a quiet tick costs one read. */
  let lastSeenRaw: string | null = null
  /** Whether a pull has merged the account in (ADR 0080 decision 2). */
  let merged = false
  /** One request at a time, in call order: two puts racing can land older bytes last. */
  let queue: Promise<void> = Promise.resolve()

  function sequence(work: () => Promise<void>): Promise<void> {
    // The catch is the chain's own, not the work's: a rejection reaching the
    // queue would make every later call short-circuit, and sync would die
    // silently for the life of the page.
    queue = queue.then(work).catch(() => undefined)
    return queue
  }

  async function put(blob: string): Promise<void> {
    lastAttempted = blob
    await client.put({ appId: BOOP_APP_ID, slotKey: SAVE_KEY, blob })
  }

  async function reconcileNow(): Promise<void> {
    try {
      const remote = await client.get({ appId: BOOP_APP_ID, slotKey: SAVE_KEY })
      const remoteDocument = parseSaveDocument(remote?.blob ?? null)
      // A slot that is there but reads as empty is a document this build cannot
      // decode, and a merge cannot preserve what it could not read.
      if (remote !== null && isEmpty(remoteDocument)) return

      // Read local only now the request has answered: a lull may have ended
      // mid-flight, and that autosave is fresher than anything read before it.
      const local = readLocal(storage)
      if (!local.readable) return
      const localDocument = local.document
      const union = canonical(mergeSaveDocuments(localDocument, remoteDocument))
      if (union !== canonical(localDocument)) writeLocal(storage, union)

      // Armed by the merge, not by the push that follows it: the device is safe
      // to push from here, and a transient refusal must not cost it the session.
      merged = true
      if (union === canonical(remoteDocument)) {
        lastAttempted = union
        return
      }
      await put(union)
    } catch {
      // The account is an extra, never a dependency.
    }
  }

  async function pushNow(): Promise<void> {
    if (!merged) return
    try {
      const raw = storage.getItem(SAVE_KEY)
      if (raw === lastSeenRaw) return
      lastSeenRaw = raw
      const document_ = parseSaveDocument(raw)
      // "I cannot decode this" and "there is nothing here" are the same parse,
      // and a stale bundle makes the first one ordinary, so neither is pushed.
      if (isEmpty(document_)) return
      const blob = canonical(document_)
      if (blob === lastAttempted) return
      await put(blob)
    } catch {
      // Retried by the next change, per the push contract.
    }
  }

  return {
    reconcile: () => sequence(reconcileNow),
    pushIfChanged: () => sequence(pushNow),
  }
}

/** What an undecodable document parses to, which is why it is never pushed. */
function isEmpty(document_: SaveDocument): boolean {
  return document_.working === null && document_.creations.length === 0
}

/**
 * The document on disk, and whether this build could read what was there. A
 * value that is present but reads as empty is one it cannot decode - a stale
 * bundle against a newer document - which neither side may act on.
 */
function readLocal(storage: SaveStorage): { document: SaveDocument; readable: boolean } {
  const raw = storage.getItem(SAVE_KEY)
  const document_ = parseSaveDocument(raw)
  return {
    document: document_,
    readable: raw === null || raw === '' || !isEmpty(document_),
  }
}

/**
 * Compared and pushed as a re-serialized document rather than as raw bytes, so
 * a value this build cannot read never travels to the family's other devices.
 */
function canonical(document_: SaveDocument): string {
  return serializeSaveDocument(document_)
}

function writeLocal(storage: SaveStorage, blob: string): void {
  storage.setItem(SAVE_KEY, blob)
}
