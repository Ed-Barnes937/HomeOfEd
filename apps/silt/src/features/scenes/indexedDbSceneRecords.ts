/**
 * `SceneRecords` over IndexedDB (ADR 0102). Four stores, every key
 * `[namespace, id]` except `namespaces`: rows (what the list shows), bodies
 * (the planes), thumbs (PNG bytes), and namespaces (which profiles have opened,
 * so adoption runs once). Each operation is one transaction, so a scene's row,
 * body and thumbnail land together or not at all.
 */
import {
  byListOrder,
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
const NAMESPACES = 'namespaces'
const ALL = [ROWS, BODIES, THUMBS, NAMESPACES]
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
      for (const name of [ROWS, BODIES, THUMBS]) {
        if (db.objectStoreNames.contains(name)) continue
        db.createObjectStore(name, { keyPath: ['ns', 'id'] }).createIndex(BY_NAMESPACE, 'ns')
      }
      if (!db.objectStoreNames.contains(NAMESPACES)) {
        db.createObjectStore(NAMESPACES, { keyPath: 'ns' })
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

  addMissing(namespace: string, scenes: readonly StoredScene[]): Promise<number> {
    // Strict durability: the caller deletes the only other copy once this resolves.
    return this.#transact(
      'readwrite',
      async (stores) => {
        const have = new Set(
          ((await settle(stores[ROWS]!.index(BY_NAMESPACE).getAll(namespace))) as RowRecord[]).map(
            (row) => row.id,
          ),
        )
        const missing = scenes.filter((scene) => !have.has(scene.id))
        for (const scene of missing) writeScene(stores, namespace, scene)
        return missing.length
      },
      'strict',
    )
  }

  adopt(from: string, to: string): Promise<void> {
    return this.#transact('readwrite', async (stores) => {
      if ((await settle(stores[NAMESPACES]!.get(to))) !== undefined) return
      const own = await settle(stores[ROWS]!.index(BY_NAMESPACE).count(to))
      if (own === 0) {
        const rows = (await settle(stores[ROWS]!.index(BY_NAMESPACE).getAll(from))) as RowRecord[]
        const scenes = await Promise.all(rows.map((row) => readScene(stores, from, row.id)))
        for (const scene of scenes) if (scene) writeScene(stores, to, scene)
      }
      stores[NAMESPACES]!.put({ ns: to })
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
      work(stores).then(
        (value) => {
          result = value
        },
        (error: unknown) => {
          reject(asError(error))
          try {
            transaction.abort()
          } catch {
            // Already finished: nothing to undo.
          }
        },
      )
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
