import { describe, expect, it } from 'vitest'

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
function library(
  records: SceneRecords,
  namespace: string,
  legacy?: LegacyStorage,
  keepStorage?: () => Promise<void>,
) {
  return new SceneLibrary(() => Promise.resolve(records), namespace, {
    legacy: legacy ?? null,
    now: () => ++clock,
    newId: () => `id-${++ids}`,
    keepStorage,
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

  it('asks to keep its storage once, after the first save that lands, and a refusal changes nothing', async () => {
    let asked = 0
    const keepStorage = () => {
      asked++
      return Promise.reject(new Error('not allowed'))
    }
    const records = new MemorySceneRecords({ quotaBytes: 10 })
    const scenes = library(records, 'ada', undefined, keepStorage)

    await expect(scenes.save('scene 1', JSON_A, null)).rejects.toThrow(QUOTA_MESSAGE)
    expect(asked).toBe(0)

    records.quotaBytes = Number.POSITIVE_INFINITY
    const meta = await scenes.save('scene 1', JSON_A, null)
    await scenes.update(meta.id, JSON_B, null)
    await scenes.save('scene 2', JSON_B, null)

    expect(asked).toBe(1)
    expect(await scenes.list()).toHaveLength(2)
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
