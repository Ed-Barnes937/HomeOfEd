import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { SceneStore, type SceneStorage } from '../scenes/sceneStore.ts'
import {
  FieldNotesStore,
  PROGRESS_KEY,
  PROGRESS_VERSION,
  type FieldNotesStorage,
} from './fieldNotesStore.ts'

/** A localStorage stand-in that records every write, for both stores' interfaces. */
class FakeStorage implements FieldNotesStorage, SceneStorage {
  readonly items = new Map<string, string>()
  readonly writes: string[] = []

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
    this.writes.push(key)
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

let storage: FakeStorage
let store: FieldNotesStore

beforeEach(() => {
  storage = new FakeStorage()
  store = new FieldNotesStore(storage)
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** The blob as it sits on disk, for the tests that care about the format. */
function stored(): unknown {
  return JSON.parse(storage.getItem(PROGRESS_KEY) ?? 'null')
}

describe('FieldNotesStore', () => {
  test('reads back what it witnessed, under its own versioned key', () => {
    store.witness(['react:lava+water'])
    store.witness(['decay:fire'])

    expect(stored()).toEqual({
      version: PROGRESS_VERSION,
      edges: ['react:lava+water', 'decay:fire'],
      reviewed: 0,
    })
    // A reload is a fresh store over the same bytes.
    expect(new FieldNotesStore(storage).progress).toEqual({
      edges: ['react:lava+water', 'decay:fire'],
      reviewed: 0,
    })
  })

  test('starts empty, and an empty store writes nothing at all', () => {
    expect(store.progress).toEqual({ edges: [], reviewed: 0 })
    expect(storage.writes).toEqual([])
  })

  test('a re-reported first is a no-op that never touches storage', () => {
    store.witness(['react:lava+water'])
    storage.writes.length = 0

    expect(store.witness(['react:lava+water'])).toBe(false)
    expect(storage.writes).toEqual([])

    // A batch that is only partly new still writes once, and appends only the new.
    expect(store.witness(['react:lava+water', 'decay:fire'])).toBe(true)
    expect(storage.writes).toEqual([PROGRESS_KEY])
    expect(store.progress.edges).toEqual(['react:lava+water', 'decay:fire'])
  })

  test('a corrupt blob reads as empty, with a warning, and is not thrown away', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    storage.items.set(PROGRESS_KEY, 'not json')

    expect(new FieldNotesStore(storage).progress).toEqual({ edges: [], reviewed: 0 })
    expect(warn).toHaveBeenCalledTimes(1)
    // Never destructive on read: the next write is what replaces the bytes.
    expect(storage.getItem(PROGRESS_KEY)).toBe('not json')
  })

  test('a blob of the wrong shape or version reads as empty rather than half-trusted', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    for (const blob of [
      JSON.stringify(null),
      JSON.stringify(['react:lava+water']),
      JSON.stringify({ version: PROGRESS_VERSION, edges: 'react:lava+water' }),
      JSON.stringify({ version: PROGRESS_VERSION, edges: [1, 2] }),
      JSON.stringify({ version: 99, edges: ['react:lava+water'] }),
    ]) {
      storage.items.set(PROGRESS_KEY, blob)
      expect(new FieldNotesStore(storage).progress).toEqual({ edges: [], reviewed: 0 })
    }

    expect(warn).toHaveBeenCalledTimes(5)
  })

  test('an edge key this roster does not know survives a save and load cycle', () => {
    // Forward-compat (spec §5): a blob written by a later roster loses nothing
    // by being read here. The derivations ignore what they cannot resolve.
    storage.items.set(
      PROGRESS_KEY,
      JSON.stringify({ version: PROGRESS_VERSION, edges: ['react:unobtanium+water'], reviewed: 1 }),
    )

    const reloaded = new FieldNotesStore(storage)
    reloaded.witness(['decay:fire'])

    expect(new FieldNotesStore(storage).progress).toEqual({
      edges: ['react:unobtanium+water', 'decay:fire'],
      reviewed: 1,
    })
  })

  test('the panel closing marks what it showed as no longer new, once', () => {
    store.witness(['react:lava+water'])

    expect(store.markReviewed()).toBe(true)
    expect(store.progress).toEqual({ edges: ['react:lava+water'], reviewed: 1 })

    storage.writes.length = 0
    expect(store.markReviewed()).toBe(false)
    expect(storage.writes).toEqual([])
  })

  test('a watermark past the end of the timeline is clamped, not trusted', () => {
    storage.items.set(
      PROGRESS_KEY,
      JSON.stringify({ version: PROGRESS_VERSION, edges: ['decay:fire'], reviewed: 9 }),
    )

    expect(new FieldNotesStore(storage).progress).toEqual({ edges: ['decay:fire'], reviewed: 1 })
  })

  test('reset forgets everything, leaving no key behind', () => {
    store.witness(['react:lava+water'])
    store.markReviewed()

    store.reset()

    expect(store.progress).toEqual({ edges: [], reviewed: 0 })
    expect(storage.getItem(PROGRESS_KEY)).toBeNull()
    expect(new FieldNotesStore(storage).progress).toEqual({ edges: [], reviewed: 0 })
  })

  test('progress keeps its identity until something changes', () => {
    // The hook re-renders off this identity, so a no-op witness must not
    // produce a new snapshot.
    const before = store.progress
    store.witness([])
    expect(store.progress).toBe(before)

    store.witness(['decay:fire'])
    expect(store.progress).not.toBe(before)
  })
})

describe('progression is nobody else’s business', () => {
  test('scene operations never touch the field notes key', () => {
    // Discovery is global, scenes are not (spec §5): saving, loading and
    // deleting worlds must leave the one key alone, and a reset of the
    // discoveries must leave the scenes alone.
    store.witness(['react:lava+water'])
    const scenes = new SceneStore(storage, { now: () => 1000, newId: () => 'id-1' })

    const meta = scenes.save('dunes', '{"scene":1}', 'data:image/png;base64,AA')
    scenes.update(meta.id, '{"scene":2}', null)
    scenes.read(meta.id)
    scenes.rename(meta.id, 'the dunes')
    scenes.reconcile()
    scenes.remove(meta.id)

    expect(storage.writes.filter((key) => key === PROGRESS_KEY)).toEqual([PROGRESS_KEY])
    expect(new FieldNotesStore(storage).progress.edges).toEqual(['react:lava+water'])

    store.reset()
    expect(scenes.list()).toEqual([])
    expect(storage.getItem(PROGRESS_KEY)).toBeNull()
  })
})
