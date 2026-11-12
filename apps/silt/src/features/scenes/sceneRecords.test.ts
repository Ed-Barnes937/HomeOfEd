import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { openIndexedDbSceneRecords } from './indexedDbSceneRecords.ts'
import {
  DEVICE_NAMESPACE,
  MemorySceneRecords,
  quotaExceeded,
  sceneBytes,
  type SceneRecords,
  type StoredScene,
} from './sceneRecords.ts'

function scene(id: string, overrides: Partial<StoredScene> = {}): StoredScene {
  return {
    id,
    name: id,
    updatedAt: 1,
    order: 1,
    body: {
      kind: 'planes',
      envelope: { version: 1, width: 2, height: 1 },
      planes: {
        species: new Uint8Array([1, 0]),
        ra: new Uint8Array([0, 0]),
        rb: new Uint8Array([0, 0]),
      },
    },
    thumbnail: new Uint8Array([0x89, 0x50]),
    ...overrides,
  }
}

const names = async (records: SceneRecords, namespace: string) =>
  (await records.list(namespace)).map((row) => row.name)

interface Opened {
  records: SceneRecords
  /** From now on, room for `count` more scenes; anything past that fails as a full quota would. */
  limitNewScenes: (count: number) => void
}

// eslint-disable-next-line @typescript-eslint/unbound-method -- always called with `.apply(this)`
const realPut = IDBObjectStore.prototype.put

afterEach(() => {
  vi.restoreAllMocks()
})

function openMemory(): Promise<Opened> {
  const records = new MemorySceneRecords()
  // A longer name than any test scene's, so `count` scenes always fit and one more never does.
  const perScene = sceneBytes(scene('xxxxx'))
  return Promise.resolve({
    records,
    limitNewScenes: (count) => {
      records.quotaBytes = records.usedBytes() + count * perScene
    },
  })
}

async function openIndexedDb(): Promise<Opened> {
  const records = await openIndexedDbSceneRecords({ factory: new IDBFactory() })
  return {
    records,
    limitNewScenes: (count) => {
      // fake-indexeddb has no quota, so a full disk is stood in for at the row write.
      let left = count
      vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore['put']>
      ) {
        if (this.name === 'rows' && left-- <= 0) throw quotaExceeded()
        return realPut.apply(this, args)
      })
    },
  }
}

// The fake and the real store are held to the same contract.
describe.each([
  ['the in-memory fake', openMemory],
  ['IndexedDB', openIndexedDb],
])('%s', (_, open) => {
  it('lists a namespace’s scenes in list order, with their thumbnails and not their bodies', async () => {
    const { records } = await open()
    await records.create('ada', scene('b', { order: 2 }))
    await records.create('ada', scene('a', { order: 1, thumbnail: null }))

    const listed = await records.list('ada')

    expect(listed).toEqual([
      { id: 'a', name: 'a', updatedAt: 1, order: 1, thumbnail: null },
      { id: 'b', name: 'b', updatedAt: 1, order: 2, thumbnail: new Uint8Array([0x89, 0x50]) },
    ])
  })

  it('keeps each namespace’s scenes apart', async () => {
    const { records } = await open()
    await records.create('ada', scene('x', { name: 'ada’s' }))
    await records.create(DEVICE_NAMESPACE, scene('x', { name: 'the device’s' }))

    await records.remove('ada', 'x')

    expect(await names(records, 'ada')).toEqual([])
    expect(await names(records, DEVICE_NAMESPACE)).toEqual(['the device’s'])
    expect(await records.read('ada', 'x')).toBeNull()
  })

  it('reads back the body and thumbnail it stored, bytes as bytes', async () => {
    const { records } = await open()
    await records.create('ada', scene('a'))

    expect(await records.read('ada', 'a')).toEqual(scene('a'))
  })

  it('a write that cannot be stored part way through leaves nothing behind', async () => {
    const { records } = await open()
    const unstorable = (() => undefined) as unknown as Uint8Array

    await expect(records.create('ada', scene('a', { thumbnail: unstorable }))).rejects.toThrow()

    expect(await records.list('ada')).toEqual([])
    expect(await records.read('ada', 'a')).toBeNull()
  })

  it('updates only a scene that exists, and a missing thumbnail takes the old one away', async () => {
    const { records } = await open()
    await records.create('ada', scene('a'))

    expect(await records.update('ada', scene('a', { updatedAt: 2, thumbnail: null }))).toBe(true)
    expect(await records.update('ada', scene('gone'))).toBe(false)

    expect(await records.read('ada', 'a')).toEqual(scene('a', { updatedAt: 2, thumbnail: null }))
    expect(await records.read('ada', 'gone')).toBeNull()
  })

  it('renames a row, and renaming a missing one creates nothing', async () => {
    const { records } = await open()
    await records.create('ada', scene('a'))

    await records.rename('ada', 'a', 'dunes', 5)
    await records.rename('ada', 'gone', 'ghost', 5)

    expect(await records.list('ada')).toMatchObject([{ id: 'a', name: 'dunes', updatedAt: 5 }])
  })

  it('imports each id once: one already there is kept, one imported and deleted stays deleted', async () => {
    const { records } = await open()
    await records.create(DEVICE_NAMESPACE, scene('a', { name: 'renamed since' }))

    expect(await records.importOnce(DEVICE_NAMESPACE, [scene('a'), scene('b'), scene('c')])).toBe(2)
    await records.remove(DEVICE_NAMESPACE, 'b')
    expect(await records.importOnce(DEVICE_NAMESPACE, [scene('a'), scene('b'), scene('c')])).toBe(0)

    expect(await names(records, DEVICE_NAMESPACE)).toEqual(['renamed since', 'c'])
  })

  it('remembers every id it was given, including one it already held and did not add', async () => {
    const { records } = await open()
    await records.create(DEVICE_NAMESPACE, scene('held'))
    await records.importOnce(DEVICE_NAMESPACE, [scene('held')])

    await records.remove(DEVICE_NAMESPACE, 'held')

    expect(await records.importOnce(DEVICE_NAMESPACE, [scene('held')])).toBe(0)
    expect(await names(records, DEVICE_NAMESPACE)).toEqual([])
  })

  it('puts an imported batch after the scenes already listed, in its own order', async () => {
    const { records } = await open()
    await records.create(DEVICE_NAMESPACE, scene('earlier', { order: 7 }))

    await records.importOnce(DEVICE_NAMESPACE, [
      scene('second', { order: 1 }),
      scene('first', { order: 0 }),
    ])

    expect(await names(records, DEVICE_NAMESPACE)).toEqual(['earlier', 'first', 'second'])
  })

  it('copies the device’s scenes into a profile, and one it deleted stays deleted', async () => {
    const { records } = await open()
    await records.create(DEVICE_NAMESPACE, scene('old'))

    await records.adopt(DEVICE_NAMESPACE, 'ada')
    await records.remove('ada', 'old')
    await records.adopt(DEVICE_NAMESPACE, 'ada')

    expect(await names(records, 'ada')).toEqual([])
    expect(await names(records, DEVICE_NAMESPACE)).toEqual(['old'])
    await records.adopt(DEVICE_NAMESPACE, 'bo')
    expect(await records.read('bo', 'old')).toEqual(scene('old'))
  })

  it('a device scene that arrives after a profile adopted reaches it, and a deleted one stays deleted', async () => {
    const { records } = await open()
    await records.create(DEVICE_NAMESPACE, scene('first', { order: 1 }))
    await records.adopt(DEVICE_NAMESPACE, 'ada')
    await records.remove('ada', 'first')

    await records.importOnce(DEVICE_NAMESPACE, [scene('later', { order: 0 })])
    await records.adopt(DEVICE_NAMESPACE, 'ada')

    expect(await names(records, 'ada')).toEqual(['later'])
    expect(await names(records, DEVICE_NAMESPACE)).toEqual(['first', 'later'])
  })

  it('never overwrites a profile’s own scene that shares an id with a device scene', async () => {
    const { records } = await open()
    await records.create(DEVICE_NAMESPACE, scene('same', { name: 'the device’s' }))
    await records.create('ada', scene('same', { name: 'ada’s own' }))

    await records.adopt(DEVICE_NAMESPACE, 'ada')

    expect(await names(records, 'ada')).toEqual(['ada’s own'])
  })

  it('adopts all or nothing, and a failed adoption is tried again in full', async () => {
    const { records, limitNewScenes } = await open()
    await records.create(DEVICE_NAMESPACE, scene('one'))
    await records.create(DEVICE_NAMESPACE, scene('two'))

    limitNewScenes(1)
    await expect(records.adopt(DEVICE_NAMESPACE, 'ada')).rejects.toThrow()
    expect(await names(records, 'ada')).toEqual([])

    limitNewScenes(Number.POSITIVE_INFINITY)
    await records.adopt(DEVICE_NAMESPACE, 'ada')
    expect(await names(records, 'ada')).toEqual(['one', 'two'])
  })

  it('a profile that saved before its adoption succeeded still gets the device’s scenes', async () => {
    const { records } = await open()
    await records.create(DEVICE_NAMESPACE, scene('old', { order: 1 }))
    await records.create('ada', scene('mine', { order: 2 }))

    await records.adopt(DEVICE_NAMESPACE, 'ada')

    expect(await names(records, 'ada')).toEqual(['old', 'mine'])
  })
})
