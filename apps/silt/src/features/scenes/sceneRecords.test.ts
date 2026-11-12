import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import { openIndexedDbSceneRecords } from './indexedDbSceneRecords.ts'
import {
  DEVICE_NAMESPACE,
  MemorySceneRecords,
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

// The fake and the real store are held to the same contract.
describe.each([
  ['the in-memory fake', (): Promise<SceneRecords> => Promise.resolve(new MemorySceneRecords())],
  [
    'IndexedDB',
    (): Promise<SceneRecords> => openIndexedDbSceneRecords({ factory: new IDBFactory() }),
  ],
])('%s', (_, open) => {
  it('lists a namespace’s scenes in list order, with their thumbnails and not their bodies', async () => {
    const records = await open()
    await records.create('ada', scene('b', { order: 2 }))
    await records.create('ada', scene('a', { order: 1, thumbnail: null }))

    const listed = await records.list('ada')

    expect(listed).toEqual([
      { id: 'a', name: 'a', updatedAt: 1, order: 1, thumbnail: null },
      { id: 'b', name: 'b', updatedAt: 1, order: 2, thumbnail: new Uint8Array([0x89, 0x50]) },
    ])
  })

  it('keeps each namespace’s scenes apart', async () => {
    const records = await open()
    await records.create('ada', scene('x', { name: 'ada’s' }))
    await records.create(DEVICE_NAMESPACE, scene('x', { name: 'the device’s' }))

    await records.remove('ada', 'x')

    expect(await names(records, 'ada')).toEqual([])
    expect(await names(records, DEVICE_NAMESPACE)).toEqual(['the device’s'])
    expect(await records.read('ada', 'x')).toBeNull()
  })

  it('reads back the body and thumbnail it stored, bytes as bytes', async () => {
    const records = await open()
    await records.create('ada', scene('a'))

    expect(await records.read('ada', 'a')).toEqual(scene('a'))
  })

  it('updates only a scene that exists, and a missing thumbnail takes the old one away', async () => {
    const records = await open()
    await records.create('ada', scene('a'))

    expect(await records.update('ada', scene('a', { updatedAt: 2, thumbnail: null }))).toBe(true)
    expect(await records.update('ada', scene('gone'))).toBe(false)

    expect(await records.read('ada', 'a')).toEqual(scene('a', { updatedAt: 2, thumbnail: null }))
    expect(await records.read('ada', 'gone')).toBeNull()
  })

  it('renames a row, and renaming a missing one creates nothing', async () => {
    const records = await open()
    await records.create('ada', scene('a'))

    await records.rename('ada', 'a', 'dunes', 5)
    await records.rename('ada', 'gone', 'ghost', 5)

    expect(await records.list('ada')).toMatchObject([{ id: 'a', name: 'dunes', updatedAt: 5 }])
  })

  it('adds only the scenes a namespace does not have yet', async () => {
    const records = await open()
    await records.create(DEVICE_NAMESPACE, scene('a', { name: 'renamed since' }))

    const added = await records.addMissing(DEVICE_NAMESPACE, [scene('a'), scene('b')])

    expect(added).toBe(1)
    expect(await names(records, DEVICE_NAMESPACE)).toEqual(['renamed since', 'b'])
  })

  it('copies the device’s scenes into a profile on its first open, and never again', async () => {
    const records = await open()
    await records.create(DEVICE_NAMESPACE, scene('old'))

    await records.adopt(DEVICE_NAMESPACE, 'ada')
    await records.remove('ada', 'old')
    await records.adopt(DEVICE_NAMESPACE, 'ada')

    expect(await names(records, 'ada')).toEqual([])
    expect(await names(records, DEVICE_NAMESPACE)).toEqual(['old'])
    await records.adopt(DEVICE_NAMESPACE, 'bo')
    expect(await records.read('bo', 'old')).toEqual(scene('old'))
  })

  it('does not adopt into a profile that already saved its own scenes', async () => {
    const records = await open()
    await records.create(DEVICE_NAMESPACE, scene('old'))
    await records.create('ada', scene('mine'))

    await records.adopt(DEVICE_NAMESPACE, 'ada')

    expect(await names(records, 'ada')).toEqual(['mine'])
  })
})
