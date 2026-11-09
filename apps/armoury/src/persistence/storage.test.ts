import { describe, expect, it } from 'vitest'

import { defaults, normalise } from '../engine/schema.ts'
import { wandSchema } from '../wand/wandSchema.ts'
import type { StoredWand } from './saveFormat.ts'
import {
  keepWand,
  loadSaveDocument,
  removeWand,
  renameWand,
  SAVE_KEY,
  writeWorkingWand,
} from './storage.ts'
import { FakeStorage } from './testing/fakeStorage.ts'

const oak: StoredWand = { params: normalise(wandSchema, { wood: 'oak' }) }
const maple: StoredWand = { params: normalise(wandSchema, { wood: 'maple' }) }

describe('storage', () => {
  it('keeps wands on the shelf without touching the working wand', () => {
    const storage = new FakeStorage()
    writeWorkingWand(storage, oak)
    keepWand(storage, maple)
    keepWand(storage, oak)
    const doc = loadSaveDocument(storage)
    expect(doc.working).toEqual(oak)
    expect(doc.shelf).toEqual([maple, oak])
  })

  it('renames a shelf wand, ignoring a blank name', () => {
    const storage = new FakeStorage()
    keepWand(storage, oak)
    renameWand(storage, 0, '  Acorn ')
    renameWand(storage, 0, '   ')
    expect(loadSaveDocument(storage).shelf[0]?.name).toBe('Acorn')
  })

  it('removes a shelf wand', () => {
    const storage = new FakeStorage()
    keepWand(storage, oak)
    keepWand(storage, maple)
    removeWand(storage, 0)
    expect(loadSaveDocument(storage).shelf).toEqual([maple])
  })

  it('never throws when storage is unavailable', () => {
    const storage = new FakeStorage()
    storage.unavailable = true
    expect(() => keepWand(storage, oak)).not.toThrow()
    expect(loadSaveDocument(storage).shelf).toEqual([])
  })

  it('stores everything under the one key', () => {
    const storage = new FakeStorage()
    writeWorkingWand(storage, { params: defaults(wandSchema) })
    expect([...storage.store.keys()]).toEqual([SAVE_KEY])
  })
})
