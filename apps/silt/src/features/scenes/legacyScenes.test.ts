import { describe, expect, it } from 'vitest'

import { LEGACY_INDEX_KEY, moveLegacyScenes, type LegacyStorage } from './legacyScenes.ts'
import { DEVICE_NAMESPACE, MemorySceneRecords, type SceneRecords } from './sceneRecords.ts'
import { unpackScene } from './storedScene.ts'

/** A localStorage stand-in that can die after a given number of removals. */
class FakeLocalStorage implements LegacyStorage {
  readonly items = new Map<string, string>()
  removalsBeforeCrash = Number.POSITIVE_INFINITY

  get length(): number {
    return this.items.size
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }
  removeItem(key: string): void {
    if (this.removalsBeforeCrash <= 0) throw new Error('the page went away')
    this.removalsBeforeCrash--
    this.items.delete(key)
  }
}

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const scene = (n: number) => JSON.stringify({ version: 1, species: btoa(`s${n}`), ra: '', rb: '' })

function deviceWithScenes(): FakeLocalStorage {
  const device = new FakeLocalStorage()
  device.items.set(
    LEGACY_INDEX_KEY,
    JSON.stringify([
      { id: 'b', name: 'dunes', updatedAt: 20 },
      { id: 'a', name: 'pond', updatedAt: 10 },
      { id: 'gone', name: 'dangling', updatedAt: 5 },
    ]),
  )
  device.items.set('silt:scene:a', scene(1))
  device.items.set('silt:scene:b', scene(2))
  device.items.set('silt:thumb:a', PNG)
  device.items.set('silt:thumb:orphan', PNG)
  device.items.set('silt:scene:lost', 'not json')
  device.items.set('silt:seen', '1')
  device.items.set('silt:fieldNotes', '{"version":1,"edges":[],"reviewed":0}')
  device.items.set('boop:save', '{}')
  return device
}

async function deviceScenes(records: SceneRecords) {
  const rows = await records.list(DEVICE_NAMESPACE)
  return Promise.all(
    rows.map(async (row) => {
      const stored = await records.read(DEVICE_NAMESPACE, row.id)
      return { id: row.id, name: row.name, json: unpackScene(stored!.body), thumb: !!row.thumbnail }
    }),
  )
}

const MOVED = [
  { id: 'b', name: 'dunes', json: scene(2), thumb: false },
  { id: 'a', name: 'pond', json: scene(1), thumb: true },
  { id: 'lost', name: 'recovered scene', json: 'not json', thumb: false },
]
const LEFT_BEHIND = ['silt:seen', 'silt:fieldNotes', 'boop:save']

describe('moving the device’s scenes out of localStorage', () => {
  it('moves every scene into the device namespace, in order, then frees their keys', async () => {
    const device = deviceWithScenes()
    const records = new MemorySceneRecords()

    await moveLegacyScenes(records, device, () => 99)

    expect(await deviceScenes(records)).toEqual(MOVED)
    expect([...device.items.keys()]).toEqual(LEFT_BEHIND)
  })

  it('leaves profile-scoped keys alone', async () => {
    const device = new FakeLocalStorage()
    device.items.set('silt:scenes@ada', '[]')
    device.items.set('silt:scene:x@ada', scene(1))

    await moveLegacyScenes(new MemorySceneRecords(), device, () => 1)

    expect(device.items.size).toBe(2)
  })

  it('removes nothing when the move does not fit, and finishes on a later open', async () => {
    const device = deviceWithScenes()
    const before = new Map(device.items)

    await expect(
      moveLegacyScenes(new MemorySceneRecords({ quotaBytes: 10 }), device, () => 99),
    ).rejects.toThrow()
    expect(device.items).toEqual(before)

    const records = new MemorySceneRecords()
    await moveLegacyScenes(records, device, () => 99)
    expect(await deviceScenes(records)).toEqual(MOVED)
  })

  // Six keys go (three blobs, two thumbnails, the index): every point the page could die at.
  it.each([0, 1, 2, 3, 4, 5])(
    'can be interrupted after %i removals and run again with nothing lost or doubled',
    async (removals) => {
      const device = deviceWithScenes()
      const records = new MemorySceneRecords()
      device.removalsBeforeCrash = removals

      await expect(moveLegacyScenes(records, device, () => 99)).rejects.toThrow('went away')
      device.removalsBeforeCrash = Number.POSITIVE_INFINITY
      await moveLegacyScenes(records, device, () => 99)

      expect(await deviceScenes(records)).toEqual(MOVED)
      expect([...device.items.keys()]).toEqual(LEFT_BEHIND)
    },
  )

  it('does not bring back the device’s old version of a scene already moved', async () => {
    const device = deviceWithScenes()
    const records = new MemorySceneRecords()
    device.removalsBeforeCrash = 0
    await expect(moveLegacyScenes(records, device, () => 99)).rejects.toThrow()
    await records.rename(DEVICE_NAMESPACE, 'a', 'pond, renamed', 100)

    device.removalsBeforeCrash = Number.POSITIVE_INFINITY
    await moveLegacyScenes(records, device, () => 99)

    expect((await records.list(DEVICE_NAMESPACE)).map((row) => row.name)).toContain('pond, renamed')
  })
})
