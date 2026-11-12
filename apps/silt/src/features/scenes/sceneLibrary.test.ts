import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import { openIndexedDbSceneRecords } from './indexedDbSceneRecords.ts'
import { LEGACY_INDEX_KEY, type LegacyStorage } from './legacyScenes.ts'
import {
  CLOSED_MESSAGE,
  NO_STORAGE_MESSAGE,
  QUOTA_MESSAGE,
  SceneLibrary,
  SceneStorageError,
} from './sceneLibrary.ts'
import {
  DEVICE_NAMESPACE,
  MemorySceneRecords,
  SceneRecordsClosedError,
  type SceneRecords,
} from './sceneRecords.ts'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const JSON_A = '{"version":1,"species":"AQ==","ra":"AA==","rb":"AA=="}'
const JSON_B = '{"version":1,"species":"Ag==","ra":"AA==","rb":"AA=="}'

let clock = 0
let ids = 0
function library(records: SceneRecords, namespace: string, legacy?: LegacyStorage) {
  return new SceneLibrary(() => Promise.resolve(records), namespace, {
    legacy: legacy ?? null,
    now: () => ++clock,
    newId: () => `id-${++ids}`,
  })
}

const OLD_SCENE = {
  id: 'old',
  name: 'old',
  updatedAt: 1,
  order: 1,
  body: { kind: 'json' as const, json: 'x'.repeat(200) },
  thumbnail: null,
}

function localStorageWith(
  entries: Record<string, string>,
): LegacyStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(entries))
  return {
    items,
    get length() {
      return items.size
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    removeItem: (key) => void items.delete(key),
  }
}

describe('SceneLibrary', () => {
  it('saves, lists with a picture, and reads back the scene it was given', async () => {
    const scenes = library(new MemorySceneRecords(), 'ada')

    const meta = await scenes.save('scene 1', JSON_A, PNG)

    expect(await scenes.list()).toEqual([{ ...meta, thumbnail: PNG }])
    expect(JSON.parse(await scenes.read(meta.id))).toEqual(JSON.parse(JSON_A))
  })

  it('updates a scene in place, and updating one that is gone writes nothing', async () => {
    const scenes = library(new MemorySceneRecords(), 'ada')
    const meta = await scenes.save('scene 1', JSON_A, PNG)

    await scenes.update(meta.id, JSON_B, null)
    await scenes.update('gone', JSON_B, PNG)

    const listed = await scenes.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]!.updatedAt).toBeGreaterThan(meta.updatedAt)
    expect(listed[0]!.thumbnail).toBeNull()
    expect(JSON.parse(await scenes.read(meta.id))).toEqual(JSON.parse(JSON_B))
  })

  it('reports a full quota as something to act on, and keeps every scene it had', async () => {
    const records = new MemorySceneRecords({ quotaBytes: 400 })
    const scenes = library(records, 'ada')
    const meta = await scenes.save('scene 1', JSON_A, null)

    const big = JSON.stringify({ version: 1, species: btoa('x'.repeat(600)), ra: '', rb: '' })
    await expect(scenes.save('scene 2', big, null)).rejects.toThrow(QUOTA_MESSAGE)
    await expect(scenes.update(meta.id, big, null)).rejects.toThrow(QUOTA_MESSAGE)

    expect((await scenes.list()).map((scene) => scene.name)).toEqual(['scene 1'])
    expect(JSON.parse(await scenes.read(meta.id))).toEqual(JSON.parse(JSON_A))
  })

  it('keeps the scene when only its picture will not fit', async () => {
    const scenes = library(new MemorySceneRecords({ quotaBytes: 200 }), 'ada')
    const picture = `data:image/png;base64,${btoa('p'.repeat(300))}`

    await scenes.save('scene 1', JSON_A, picture)

    expect(await scenes.list()).toMatchObject([{ name: 'scene 1', thumbnail: null }])
  })

  it('copies, renames and deletes', async () => {
    const scenes = library(new MemorySceneRecords(), 'ada')
    const meta = await scenes.save('dunes', JSON_A, PNG)

    const copy = await scenes.duplicate(meta.id, 'dunes copy')
    await scenes.rename(meta.id, 'the dunes')
    await scenes.remove(copy.id)

    expect(await scenes.list()).toMatchObject([{ id: meta.id, name: 'the dunes', thumbnail: PNG }])
    await expect(scenes.read(copy.id)).rejects.toThrow('this scene’s data is missing from storage')
  })

  it('moves the device’s localStorage scenes, then each profile adopts them and keeps its own', async () => {
    const records = new MemorySceneRecords()
    const device = localStorageWith({
      [LEGACY_INDEX_KEY]: JSON.stringify([{ id: 'old', name: 'from before', updatedAt: 1 }]),
      'silt:scene:old': JSON_A,
    })

    const ada = library(records, 'ada', device)
    await ada.save('ada’s own', JSON_B, null)
    const bo = library(records, 'bo', device)

    expect((await ada.list()).map((scene) => scene.name)).toEqual(['from before', 'ada’s own'])
    expect((await bo.list()).map((scene) => scene.name)).toEqual(['from before'])
    expect((await records.list(DEVICE_NAMESPACE)).map((scene) => scene.name)).toEqual([
      'from before',
    ])
    expect(device.items.size).toBe(0)
  })

  it('signed out, the scenes are the device’s, as before', async () => {
    const records = new MemorySceneRecords()
    const scenes = library(records, DEVICE_NAMESPACE)

    await scenes.save('scene 1', JSON_A, null)

    expect(await records.list(DEVICE_NAMESPACE)).toMatchObject([{ name: 'scene 1' }])
  })

  it('opens empty rather than failing when a profile’s copy does not fit, and tries again next time', async () => {
    const records = new MemorySceneRecords({ quotaBytes: 300 })
    await records.create(DEVICE_NAMESPACE, OLD_SCENE)

    expect(await library(records, 'ada').list()).toEqual([])

    records.quotaBytes = Number.POSITIVE_INFINITY
    expect((await library(records, 'ada').list()).map((scene) => scene.name)).toEqual(['old'])
  })

  it('a profile that saved while its copy did not fit still gets the device’s scenes later', async () => {
    const records = new MemorySceneRecords()
    await records.create(DEVICE_NAMESPACE, OLD_SCENE)
    records.quotaBytes = records.usedBytes() + 100

    await library(records, 'ada').save('scene 1', JSON_A, null)
    records.quotaBytes = Number.POSITIVE_INFINITY

    const names = (await library(records, 'ada').list()).map((scene) => scene.name)
    expect(names.sort()).toEqual(['old', 'scene 1'])
  })

  it('a profile does not adopt on an open where the move did not finish, and does on the next', async () => {
    const records = new MemorySceneRecords({ quotaBytes: 10 })
    const device = localStorageWith({
      [LEGACY_INDEX_KEY]: JSON.stringify([{ id: 'old', name: 'from before', updatedAt: 1 }]),
      'silt:scene:old': JSON_A,
    })

    expect(await library(records, 'ada', device).list()).toEqual([])
    records.quotaBytes = Number.POSITIVE_INFINITY

    const names = (await library(records, 'ada', device).list()).map((scene) => scene.name)
    expect(names).toEqual(['from before'])
    expect(device.items.size).toBe(0)
  })

  it('without IndexedDB, says scenes cannot be saved and never falls back to localStorage', async () => {
    const device = localStorageWith({ 'silt:seen': '1' })
    const denied = () => Promise.reject(new DOMException('no', 'SecurityError'))
    const scenes = new SceneLibrary(denied, 'ada', {
      legacy: device,
    })

    await expect(scenes.list()).rejects.toThrow(NO_STORAGE_MESSAGE)
    await expect(scenes.save('scene 1', JSON_A, PNG)).rejects.toThrow(NO_STORAGE_MESSAGE)
    await expect(scenes.save('scene 1', JSON_A, PNG)).rejects.toBeInstanceOf(SceneStorageError)
    expect([...device.items.keys()]).toEqual(['silt:seen'])
  })

  it('once another tab has upgraded the store, asks for a reload', async () => {
    const records = new MemorySceneRecords()
    records.list = () => Promise.reject(new SceneRecordsClosedError())

    await expect(library(records, 'ada').list()).rejects.toThrow(CLOSED_MESSAGE)
  })
})

/** A device's localStorage as the old build leaves it after saving `id`. */
function oldBuildSaves(device: { items: Map<string, string> }, id: string, name: string): void {
  device.items.set(LEGACY_INDEX_KEY, JSON.stringify([{ id, name, updatedAt: 1 }]))
  device.items.set(`silt:scene:${id}`, JSON_A)
}

const sceneNames = async (scenes: SceneLibrary) => (await scenes.list()).map((scene) => scene.name)

describe.each([
  ['the in-memory fake', (): Promise<SceneRecords> => Promise.resolve(new MemorySceneRecords())],
  [
    'IndexedDB',
    (): Promise<SceneRecords> => openIndexedDbSceneRecords({ factory: new IDBFactory() }),
  ],
])('scenes moved after a profile adopted, over %s', (_, openRecords) => {
  it('reach the profile on its next open', async () => {
    const records = await openRecords()
    const device = localStorageWith({})
    oldBuildSaves(device, 'old', 'from before')
    expect(await sceneNames(library(records, 'ada', device))).toEqual(['from before'])

    oldBuildSaves(device, 'rolled-back', 'saved during a rollback')

    const ada = library(records, 'ada', device)
    expect(await sceneNames(ada)).toEqual(['from before', 'saved during a rollback'])
    expect(device.items.size).toBe(0)
  })

  it('leave a scene the profile deleted deleted', async () => {
    const records = await openRecords()
    const device = localStorageWith({})
    oldBuildSaves(device, 'old', 'from before')
    await library(records, 'ada', device).remove('old')

    oldBuildSaves(device, 'rolled-back', 'saved during a rollback')

    expect(await sceneNames(library(records, 'ada', device))).toEqual(['saved during a rollback'])
  })

  it('never refill a profile that deleted every scene', async () => {
    const records = await openRecords()
    const device = localStorageWith({})
    oldBuildSaves(device, 'old', 'from before')
    const ada = library(records, 'ada', device)
    for (const scene of await ada.list()) await ada.remove(scene.id)

    expect(await sceneNames(library(records, 'ada', device))).toEqual([])
  })
})
