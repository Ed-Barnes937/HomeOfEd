import { beforeEach, describe, expect, it } from 'vitest'

import {
  blobKey,
  INDEX_KEY,
  SceneStore,
  SceneStorageError,
  thumbKey,
  type SceneStorage,
} from './sceneStore.ts'

/** A localStorage stand-in that can be told to run out of room. */
class FakeStorage implements SceneStorage {
  readonly items = new Map<string, string>()
  readonly writes: string[] = []
  /** Keys whose writes throw the browser's quota error. */
  full: (key: string) => boolean = () => false

  get length(): number {
    return this.items.size
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.full(key)) {
      const error = new Error('quota') as Error & { name: string }
      error.name = 'QuotaExceededError'
      throw error
    }
    this.writes.push(key)
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

let storage: FakeStorage
let ids: number
let store: SceneStore

beforeEach(() => {
  storage = new FakeStorage()
  ids = 0
  store = new SceneStore(storage, { now: () => 1000, newId: () => `id-${++ids}` })
})

describe('SceneStore', () => {
  it('writes the blob before the index, and lists what it saved', () => {
    const meta = store.save('dunes', '{"scene":1}', 'data:image/png;base64,AA')

    expect(meta).toEqual({ id: 'id-1', name: 'dunes', updatedAt: 1000 })
    expect(storage.writes.indexOf(blobKey('id-1'))).toBeLessThan(storage.writes.indexOf(INDEX_KEY))
    expect(store.read('id-1')).toBe('{"scene":1}')
    expect(store.thumbnail('id-1')).toBe('data:image/png;base64,AA')
    expect(store.list()).toEqual([meta])
  })

  it('reports a full quota as something the user can act on, and writes nothing', () => {
    storage.full = (key) => key.startsWith(blobKey(''))

    expect(() => store.save('dunes', '{}', null)).toThrow(SceneStorageError)
    expect(() => store.save('dunes', '{}', null)).toThrow(/storage full/)
    expect(storage.getItem(INDEX_KEY)).toBeNull()
  })

  it('keeps the scene when only its thumbnail will not fit', () => {
    storage.full = (key) => key.startsWith(thumbKey(''))

    const meta = store.save('dunes', '{}', 'data:image/png;base64,AA')

    expect(store.list()).toEqual([meta])
    expect(store.thumbnail('id-1')).toBeNull()
  })

  it('renames and deletes, taking the blob and thumbnail with the row', () => {
    store.save('dunes', '{}', 'data:image/png;base64,AA')

    store.rename('id-1', 'the dunes')
    expect(store.list()[0]?.name).toBe('the dunes')

    store.remove('id-1')
    expect(store.list()).toEqual([])
    expect(storage.getItem(blobKey('id-1'))).toBeNull()
    expect(storage.getItem(thumbKey('id-1'))).toBeNull()
  })

  it('frees the blob before rewriting the index, so a full quota can still be escaped', () => {
    store.save('dunes', '{}', 'data:image/png;base64,AA')
    storage.writes.length = 0
    // The index write is the one that needs room; the removals must not be
    // waiting behind it.
    storage.full = (key) => key === INDEX_KEY

    expect(() => store.remove('id-1')).toThrow(/storage full/)
    expect(storage.getItem(blobKey('id-1'))).toBeNull()
    expect(storage.getItem(thumbKey('id-1'))).toBeNull()
  })

  it('leaves the index alone when there is nothing to reconcile', () => {
    store.save('dunes', '{}', null)
    storage.writes.length = 0

    store.reconcile()

    expect(storage.writes).toEqual([])
  })

  it('frees a thumbnail whose scene is gone', () => {
    storage.items.set(thumbKey('ghost'), 'data:image/png;base64,AA')

    store.reconcile()

    expect(storage.getItem(thumbKey('ghost'))).toBeNull()
  })

  it('reconciles a dangling index row away and adopts an orphan blob', () => {
    store.save('dunes', '{}', null)
    store.save('caves', '{}', null)
    // A blob that vanished under the index, and one the index never learned of
    // (a save that died between the two writes).
    storage.removeItem(blobKey('id-1'))
    storage.items.set(blobKey('orphan'), '{}')

    const scenes = store.reconcile()

    expect(scenes.map((scene) => scene.id)).toEqual(['id-2', 'orphan'])
    expect(store.list().map((scene) => scene.id)).toEqual(['id-2', 'orphan'])
  })

  it('survives an index that is not the JSON it should be', () => {
    storage.items.set(INDEX_KEY, 'not json')
    storage.items.set(blobKey('orphan'), '{}')

    expect(store.reconcile().map((scene) => scene.id)).toEqual(['orphan'])
  })

  it('refuses to read a scene whose blob is gone rather than pretending it is empty', () => {
    store.save('dunes', '{}', null)
    storage.removeItem(blobKey('id-1'))

    expect(() => store.read('id-1')).toThrow(SceneStorageError)
    // Never destructive: the row stays listed so the popover can flag it.
    expect(store.list().map((scene) => scene.id)).toEqual(['id-1'])
  })
})
