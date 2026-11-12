import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { openIndexedDbSceneRecords, SCENE_DB_NAME } from './indexedDbSceneRecords.ts'
import { DEVICE_NAMESPACE, SceneRecordsClosedError, type StoredScene } from './sceneRecords.ts'

// eslint-disable-next-line @typescript-eslint/unbound-method -- always called with `.apply(this)`
const realPut = IDBObjectStore.prototype.put

afterEach(() => {
  vi.restoreAllMocks()
})

const SAVED: StoredScene = {
  id: 'a',
  name: 'dunes',
  updatedAt: 1,
  order: 1,
  body: { kind: 'json', json: '{"version":1}' },
  thumbnail: new Uint8Array([1]),
}

/** The ids a namespace has recorded as taken in, read over a connection of its own. */
async function takenIn(factory: IDBFactory, namespace: string): Promise<string[]> {
  const db = await openRaw(factory, 1)
  const ids = await new Promise<string[]>((resolve) => {
    const read = db
      .transaction('imported')
      .objectStore('imported')
      .index('byNamespace')
      .getAll(namespace)
    read.onsuccess = () => resolve((read.result as { id: string }[]).map((record) => record.id))
  })
  db.close()
  return ids
}

function openRaw(factory: IDBFactory, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(SCENE_DB_NAME, version)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('open failed'))
  })
}

describe('scene records in IndexedDB', () => {
  it('a save whose transaction aborts part way leaves the previous scene as it was', async () => {
    const records = await openIndexedDbSceneRecords({ factory: new IDBFactory() })
    await records.create('ada', SAVED)
    // A thumbnail that cannot be stored fails the last write of the transaction.
    const unstorable = (() => undefined) as unknown as Uint8Array

    await expect(
      records.update('ada', {
        ...SAVED,
        name: 'half',
        body: { kind: 'json', json: '{}' },
        thumbnail: unstorable,
      }),
    ).rejects.toThrow()

    expect(await records.read('ada', 'a')).toEqual(SAVED)
  })

  it('an adoption whose transaction aborts at commit records nothing, and the retry copies everything', async () => {
    const factory = new IDBFactory()
    const records = await openIndexedDbSceneRecords({ factory })
    await records.create(DEVICE_NAMESPACE, { ...SAVED, id: 'one' })
    await records.create(DEVICE_NAMESPACE, { ...SAVED, id: 'two' })
    // Every write is queued; then the transaction is aborted, as a commit-time failure would.
    let importedPuts = 0
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      const request = realPut.apply(this, args)
      if (this.name === 'imported' && ++importedPuts === 2) this.transaction.abort()
      return request
    })

    await expect(records.adopt(DEVICE_NAMESPACE, 'ada')).rejects.toThrow()
    expect(await records.list('ada')).toEqual([])
    expect(await takenIn(factory, 'ada')).toEqual([])

    vi.restoreAllMocks()
    await records.adopt(DEVICE_NAMESPACE, 'ada')
    expect((await records.list('ada')).map((row) => row.id)).toEqual(['one', 'two'])
  })

  it('steps aside for an upgrade in another tab, and says so', async () => {
    const factory = new IDBFactory()
    const onClosed = vi.fn()
    const records = await openIndexedDbSceneRecords({ factory, onClosed })

    const upgraded = await openRaw(factory, 2)

    expect(onClosed).toHaveBeenCalledOnce()
    await expect(records.list('ada')).rejects.toBeInstanceOf(SceneRecordsClosedError)
    upgraded.close()
  })

  it('reports an upgrade held up by an older tab, and opens once that tab lets go', async () => {
    const factory = new IDBFactory()
    const older = await openRaw(factory, 1)
    older.onversionchange = () => undefined
    const onBlocked = vi.fn()

    const opening = openIndexedDbSceneRecords({ factory, version: 2, onBlocked })
    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalled())
    older.close()

    const records = await opening
    expect(await records.list('ada')).toEqual([])
  })

  it('refuses to open where the browser will not give it IndexedDB', async () => {
    const factory = {
      open: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    } as unknown as IDBFactory

    await expect(openIndexedDbSceneRecords({ factory })).rejects.toThrow('denied')
  })
})
