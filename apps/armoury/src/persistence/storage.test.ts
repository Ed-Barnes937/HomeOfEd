import { describe, expect, it } from 'vitest'

import { defaults, normalise } from '../engine/schema.ts'
import type { StoredItem } from '../items/item.ts'
import { fakeSword } from '../items/testing/fakeItem.ts'
import { wandItem } from '../wand/item.ts'
import { wandSchema } from '../wand/wandSchema.ts'
import {
  keepItem,
  loadSaveDocument,
  removeItem,
  renameItem,
  SAVE_KEY,
  SWORD_SAVE_KEY,
  writeWorking,
} from './storage.ts'
import { FakeStorage } from './testing/fakeStorage.ts'

const oak: StoredItem = { params: normalise(wandSchema, { wood: 'oak' }) }
const maple: StoredItem = { params: normalise(wandSchema, { wood: 'maple' }) }

describe('storage', () => {
  it('keeps wands on the shelf without touching the working wand', () => {
    const storage = new FakeStorage()
    writeWorking(storage, wandItem, oak)
    keepItem(storage, wandItem, maple)
    keepItem(storage, wandItem, oak)
    const doc = loadSaveDocument(storage, wandItem)
    expect(doc.working).toEqual(oak)
    expect(doc.shelf).toEqual([maple, oak])
  })

  it('renames a shelf wand, ignoring a blank name', () => {
    const storage = new FakeStorage()
    keepItem(storage, wandItem, oak)
    renameItem(storage, wandItem, 0, '  Acorn ')
    renameItem(storage, wandItem, 0, '   ')
    expect(loadSaveDocument(storage, wandItem).shelf[0]?.name).toBe('Acorn')
  })

  it('removes a shelf wand', () => {
    const storage = new FakeStorage()
    keepItem(storage, wandItem, oak)
    keepItem(storage, wandItem, maple)
    removeItem(storage, wandItem, 0)
    expect(loadSaveDocument(storage, wandItem).shelf).toEqual([maple])
  })

  it('never throws when storage is unavailable', () => {
    const storage = new FakeStorage()
    storage.unavailable = true
    expect(() => keepItem(storage, wandItem, oak)).not.toThrow()
    expect(loadSaveDocument(storage, wandItem).shelf).toEqual([])
  })

  it('stores everything under the one key', () => {
    const storage = new FakeStorage()
    writeWorking(storage, wandItem, { params: defaults(wandSchema) })
    expect([...storage.store.keys()]).toEqual([SAVE_KEY])
  })
})

describe('storage, a document per kind', () => {
  const dagger: StoredItem = { params: fakeSword.firstVisit() }
  const rapier: StoredItem = { params: { ...dagger.params, guard: 'ring' }, name: 'Needle' }

  it('keeps wands under the key they have always had, and swords under their own', () => {
    expect(SAVE_KEY).toBe('armoury:save')
    expect(SWORD_SAVE_KEY).toBe('armoury:save:sword')
    expect(wandItem.storageKey).toBe(SAVE_KEY)
    expect(fakeSword.storageKey).toBe(SWORD_SAVE_KEY)
  })

  it('writes each kind to its own document and leaves the other alone', () => {
    const storage = new FakeStorage()
    writeWorking(storage, wandItem, oak)
    keepItem(storage, wandItem, maple)
    const wands = storage.getItem(SAVE_KEY)

    writeWorking(storage, fakeSword, dagger)
    keepItem(storage, fakeSword, rapier)
    keepItem(storage, fakeSword, dagger)
    renameItem(storage, fakeSword, 1, 'Pip')
    removeItem(storage, fakeSword, 0)

    expect(storage.getItem(SAVE_KEY)).toBe(wands)
    expect([...storage.store.keys()]).toEqual([SAVE_KEY, SWORD_SAVE_KEY])
    expect(loadSaveDocument(storage, fakeSword)).toEqual({
      version: 1,
      working: dagger,
      shelf: [{ ...dagger, name: 'Pip' }],
    })
    expect(loadSaveDocument(storage, wandItem)).toEqual({
      version: 1,
      working: oak,
      shelf: [maple],
    })
  })

  it('leaves a version 1 wand document as it was written, byte for byte', () => {
    const written = JSON.stringify({
      version: 1,
      working: { params: oak.params, name: 'Acorn' },
      shelf: [maple, { params: defaults(wandSchema), name: 'Twiggy' }],
    })
    const storage = new FakeStorage()
    storage.store.set(SAVE_KEY, written)

    const doc = loadSaveDocument(storage, wandItem)
    writeWorking(storage, wandItem, doc.working!)
    expect(storage.getItem(SAVE_KEY)).toBe(written)

    keepItem(storage, wandItem, oak)
    removeItem(storage, wandItem, 2)
    expect(storage.getItem(SAVE_KEY)).toBe(written)
    expect([...storage.store.keys()]).toEqual([SAVE_KEY])
  })

  it('reads a kind with nothing saved as empty, whatever the other has', () => {
    const storage = new FakeStorage()
    keepItem(storage, wandItem, oak)
    expect(loadSaveDocument(storage, fakeSword)).toEqual({ version: 1, working: null, shelf: [] })
  })
})
