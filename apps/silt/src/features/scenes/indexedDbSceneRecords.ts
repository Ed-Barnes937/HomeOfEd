/** `SceneRecords` over IndexedDB, one transaction per operation (ADR 0102 has the stores). */
import {
  byListOrder,
  nextOrder,
  SceneRecordsClosedError,
  type ListedScene,
  type SceneRecords,
  type SceneRow,
  type StoredScene,
} from './sceneRecords.ts'
import type { SceneBody } from './storedScene.ts'

export const SCENE_DB_NAME = 'silt'
export const SCENE_DB_VERSION = 1

const ROWS = 'rows'
const BODIES = 'bodies'
const THUMBS = 'thumbs'
const IMPORTED = 'imported'
const ALL = [ROWS, BODIES, THUMBS, IMPORTED]
const BY_NAMESPACE = 'byNamespace'

interface RowRecord extends SceneRow {
  ns: string
}
interface BodyRecord {
  ns: string
  id: string
  body: SceneBody
}
interface ThumbRecord {
  ns: string
  id: string
  png: Uint8Array
}

export interface OpenSceneRecordsOptions {
  factory: IDBFactory
  name?: string
  /** Only tests ask for a later version, to stand in for a future upgrade. */
  version?: number
  /** Another tab holds an older version open; opening waits until it closes. */
  onBlocked?: () => void
  /** The connection was closed under the page (an upgrade elsewhere, or the browser). */
  onClosed?: () => void
}

export function openIndexedDbSceneRecords(options: OpenSceneRecordsOptions): Promise<SceneRecords> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    try {
      request = options.factory.open(
        options.name ?? SCENE_DB_NAME,
        options.version ?? SCENE_DB_VERSION,
      )
    } catch (error) {
      reject(asError(error))
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of ALL) {
        if (db.objectStoreNames.contains(name)) continue
        db.createObjectStore(name, { keyPath: ['ns', 'id'] }).createIndex(BY_NAMESPACE, 'ns')
      }
    }
    request.onblocked = () => options.onBlocked?.()
    request.onerror = () => reject(asError(request.error))
    request.onsuccess = () => resolve(new IndexedDbSceneRecords(request.result, options.onClosed))
  })
}

type Stores = Record<string, IDBObjectStore>

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(asError(request.error))
  })
}

class IndexedDbSceneRecords implements SceneRecords {
  readonly #db: IDBDatabase
  #closed = false

  constructor(db: IDBDatabase, onClosed?: () => void) {
    this.#db = db
    const close = (): void => {
      if (this.#closed) return
      this.#closed = true
      db.close()
      onClosed?.()
    }
    // Closing lets an upgrade in another tab go ahead instead of waiting on this one.
    db.onversionchange = close
    db.onclose = close
  }

  list(namespace: string): Promise<ListedScene[]> {
    return this.#transact('readonly', async (stores) => {
      const [rows, thumbs] = await Promise.all([
        settle(stores[ROWS]!.index(BY_NAMESPACE).getAll(namespace)) as Promise<RowRecord[]>,
        settle(stores[THUMBS]!.index(BY_NAMESPACE).getAll(namespace)) as Promise<ThumbRecord[]>,
      ])
      const pngs = new Map(thumbs.map((thumb) => [thumb.id, thumb.png]))
      return rows
        .map((row) => ({ ...rowOf(row), thumbnail: pngs.get(row.id) ?? null }))
        .sort(byListOrder)
    })
  }

  read(namespace: string, id: string): Promise<StoredScene | null> {
    return this.#transact('readonly', (stores) => readScene(stores, namespace, id))
  }

  create(namespace: string, scene: StoredScene): Promise<void> {
    return this.#transact('readwrite', (stores) => {
      writeScene(stores, namespace, scene)
      return Promise.resolve()
    })
  }

  update(namespace: string, scene: StoredScene): Promise<boolean> {
    return this.#transact('readwrite', async (stores) => {
      const row = (await settle(stores[ROWS]!.get([namespace, scene.id]))) as RowRecord | undefined
      if (row === undefined) return false
      writeScene(stores, namespace, scene)
      return true
    })
  }

  rename(namespace: string, id: string, name: string, updatedAt: number): Promise<void> {
    return this.#transact('readwrite', async (stores) => {
      const row = (await settle(stores[ROWS]!.get([namespace, id]))) as RowRecord | undefined
      if (row) stores[ROWS]!.put({ ...row, name, updatedAt })
    })
  }

  remove(namespace: string, id: string): Promise<void> {
    return this.#transact('readwrite', (stores) => {
      for (const name of [ROWS, BODIES, THUMBS]) stores[name]!.delete([namespace, id])
      return Promise.resolve()
    })
  }

  importOnce(namespace: string, scenes: readonly StoredScene[]): Promise<number> {
    // Strict durability: the caller deletes the only other copy once this resolves.
    return this.#transact(
      'readwrite',
      async (stores) => {
        const [rows, imported] = await Promise.all([
          rowsIn(stores, namespace),
          takenIn(stores, namespace),
        ])
        const skip = new Set([...rows.map((row) => row.id), ...imported])
        const base = nextOrder(rows)
        const fresh = scenes.filter((scene) => !skip.has(scene.id))
        for (const scene of fresh) {
          writeScene(stores, namespace, { ...scene, order: base + scene.order })
        }
        for (const scene of scenes) stores[IMPORTED]!.put({ ns: namespace, id: scene.id })
        return fresh.length
      },
      'strict',
    )
  }

  adopt(from: string, to: string): Promise<void> {
    return this.#transact('readwrite', async (stores) => {
      const [held, taken, rows] = await Promise.all([
        rowsIn(stores, to),
        takenIn(stores, to),
        rowsIn(stores, from),
      ])
      const skipped = new Set(taken)
      const heldIds = new Set(held.map((row) => row.id))
      const offered = rows.filter((row) => !skipped.has(row.id))
      const fresh = offered.filter((row) => !heldIds.has(row.id))
      const scenes = await Promise.all(fresh.map((row) => readScene(stores, from, row.id)))
      for (const scene of scenes) if (scene) writeScene(stores, to, scene)
      for (const row of offered) stores[IMPORTED]!.put({ ns: to, id: row.id })
    })
  }

  #transact<T>(
    mode: IDBTransactionMode,
    work: (stores: Stores) => Promise<T>,
    durability: IDBTransactionDurability = 'default',
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.#closed) {
        reject(new SceneRecordsClosedError())
        return
      }
      let transaction: IDBTransaction
      try {
        transaction = this.#db.transaction(ALL, mode, { durability })
      } catch (error) {
        reject(this.#closed ? new SceneRecordsClosedError() : asError(error))
        return
      }
      const stores = Object.fromEntries(ALL.map((name) => [name, transaction.objectStore(name)]))
      let result: T
      transaction.oncomplete = () => resolve(result)
      transaction.onabort = () =>
        reject(transaction.error ?? new DOMException('the transaction was aborted', 'AbortError'))
      const fail = (error: unknown): void => {
        reject(asError(error))
        try {
          transaction.abort()
        } catch {
          // Already finished: nothing to undo.
        }
      }
      // A throw before `work` returns would otherwise leave its earlier writes to commit.
      let pending: Promise<T>
      try {
        pending = work(stores)
      } catch (error) {
        fail(error)
        return
      }
      pending.then((value) => {
        result = value
      }, fail)
    })
  }
}

async function readScene(
  stores: Stores,
  namespace: string,
  id: string,
): Promise<StoredScene | null> {
  const key = [namespace, id]
  const [row, body, thumb] = await Promise.all([
    settle(stores[ROWS]!.get(key)) as Promise<RowRecord | undefined>,
    settle(stores[BODIES]!.get(key)) as Promise<BodyRecord | undefined>,
    settle(stores[THUMBS]!.get(key)) as Promise<ThumbRecord | undefined>,
  ])
  if (!row || !body) return null
  return { ...rowOf(row), body: body.body, thumbnail: thumb?.png ?? null }
}

function rowsIn(stores: Stores, namespace: string): Promise<RowRecord[]> {
  return settle(stores[ROWS]!.index(BY_NAMESPACE).getAll(namespace)) as Promise<RowRecord[]>
}

/** Ids a namespace has taken in, by a move or from the device. */
async function takenIn(stores: Stores, namespace: string): Promise<string[]> {
  const records = (await settle(stores[IMPORTED]!.index(BY_NAMESPACE).getAll(namespace))) as {
    id: string
  }[]
  return records.map((record) => record.id)
}

function writeScene(stores: Stores, namespace: string, scene: StoredScene): void {
  const { body, thumbnail, ...row } = scene
  stores[ROWS]!.put({ ns: namespace, ...row })
  stores[BODIES]!.put({ ns: namespace, id: scene.id, body })
  if (thumbnail) stores[THUMBS]!.put({ ns: namespace, id: scene.id, png: thumbnail })
  else stores[THUMBS]!.delete([namespace, scene.id])
}

function rowOf(record: RowRecord): SceneRow {
  return { id: record.id, name: record.name, updatedAt: record.updatedAt, order: record.order }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
