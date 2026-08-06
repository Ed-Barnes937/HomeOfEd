import { describe, expect, it } from 'vitest'

import { EMPTY_DOCUMENT, SAVE_FORMAT_VERSION, type StoredCreation } from './saveFormat.ts'
import { loadSaveDocument, SAVE_KEY, writeWorkingCreation } from './storage.ts'
import { FakeStorage } from './testing/fakeStorage.ts'

const creation: StoredCreation = {
  name: '',
  kitId: 'launch',
  tempo: 120,
  patterns: [{ rows: [{ instrumentId: 'kick', steps: '1000100010001000' }] }],
}

describe('writeWorkingCreation', () => {
  it('writes the working creation under the save key', () => {
    const storage = new FakeStorage()

    writeWorkingCreation(storage, creation)

    expect(loadSaveDocument(storage)).toEqual({
      version: SAVE_FORMAT_VERSION,
      working: creation,
      creations: [],
    })
  })

  it('leaves the saved creations list alone', () => {
    const storage = new FakeStorage()
    const saved: StoredCreation = { ...creation, name: 'Groove 1' }
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: SAVE_FORMAT_VERSION, working: null, creations: [saved] }),
    )

    writeWorkingCreation(storage, creation)

    expect(loadSaveDocument(storage).creations).toEqual([saved])
  })

  it('swallows a storage that refuses to write', () => {
    const storage = new FakeStorage()
    storage.unavailable = true

    expect(() => writeWorkingCreation(storage, creation)).not.toThrow()
  })
})

describe('loadSaveDocument', () => {
  it('is empty when nothing has been stored', () => {
    expect(loadSaveDocument(new FakeStorage())).toEqual(EMPTY_DOCUMENT)
  })

  it('is empty when the stored document is corrupt', () => {
    const storage = new FakeStorage()
    storage.setItem(SAVE_KEY, '{"version":1,"working":{"name":42}}')

    expect(loadSaveDocument(storage)).toEqual(EMPTY_DOCUMENT)
  })

  it('is empty when storage cannot be read at all', () => {
    const storage = new FakeStorage()
    storage.unavailable = true

    expect(loadSaveDocument(storage)).toEqual(EMPTY_DOCUMENT)
  })
})
