import { describe, expect, it } from 'vitest'

import { EMPTY_DOCUMENT, SAVE_FORMAT_VERSION, type StoredBoop } from './saveFormat.ts'
import {
  deleteBoop,
  loadSaveDocument,
  renameBoop,
  SAVE_KEY,
  saveBoop,
  writeWorkingBoop,
} from './storage.ts'
import { FakeStorage } from './testing/fakeStorage.ts'

const creation: StoredBoop = {
  name: '',
  kitId: 'launch',
  tempo: 120,
  patterns: [{ rows: [{ instrumentId: 'kick', steps: '1000100010001000' }] }],
}

describe('writeWorkingBoop', () => {
  it('writes the working creation under the save key', () => {
    const storage = new FakeStorage()

    writeWorkingBoop(storage, creation)

    expect(loadSaveDocument(storage)).toEqual({
      version: SAVE_FORMAT_VERSION,
      working: creation,
      creations: [],
    })
  })

  it('leaves the saved creations list alone', () => {
    const storage = new FakeStorage()
    const saved: StoredBoop = { ...creation, name: 'Boop 1' }
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: SAVE_FORMAT_VERSION, working: null, creations: [saved] }),
    )

    writeWorkingBoop(storage, creation)

    expect(loadSaveDocument(storage).creations).toEqual([saved])
  })

  it('swallows a storage that refuses to write', () => {
    const storage = new FakeStorage()
    storage.unavailable = true

    expect(() => writeWorkingBoop(storage, creation)).not.toThrow()
  })
})

describe('saveBoop', () => {
  it('appends to the creations list, keeping the working grid intact', () => {
    const storage = new FakeStorage()
    writeWorkingBoop(storage, creation)
    const boop: StoredBoop = { ...creation, name: 'Boop 1' }

    saveBoop(storage, boop)

    expect(loadSaveDocument(storage)).toEqual({
      version: SAVE_FORMAT_VERSION,
      working: creation,
      creations: [boop],
    })
  })

  it('never caps the list', () => {
    const storage = new FakeStorage()
    for (let i = 0; i < 30; i++) {
      saveBoop(storage, { ...creation, name: `Boop ${i}` })
    }

    expect(loadSaveDocument(storage).creations).toHaveLength(30)
  })
})

describe('renameBoop', () => {
  it('renames the creation at the given index, leaving the others alone', () => {
    const storage = new FakeStorage()
    const first: StoredBoop = { ...creation, name: 'Boop 1' }
    const second: StoredBoop = { ...creation, name: 'Boop 2' }
    saveBoop(storage, first)
    saveBoop(storage, second)

    renameBoop(storage, 1, 'My Beat')

    expect(loadSaveDocument(storage).creations).toEqual([first, { ...second, name: 'My Beat' }])
  })

  it('trims the new name', () => {
    const storage = new FakeStorage()
    saveBoop(storage, { ...creation, name: 'Boop 1' })

    renameBoop(storage, 0, '  My Beat  ')

    expect(loadSaveDocument(storage).creations[0]!.name).toBe('My Beat')
  })

  it('is a no-op when the new name is blank — rename is optional, never a gate', () => {
    const storage = new FakeStorage()
    saveBoop(storage, { ...creation, name: 'Boop 1' })

    renameBoop(storage, 0, '   ')

    expect(loadSaveDocument(storage).creations[0]!.name).toBe('Boop 1')
  })

  it('is a no-op for an index out of range', () => {
    const storage = new FakeStorage()
    saveBoop(storage, { ...creation, name: 'Boop 1' })

    expect(() => renameBoop(storage, 5, 'My Beat')).not.toThrow()
    expect(loadSaveDocument(storage).creations).toHaveLength(1)
  })
})

describe('deleteBoop', () => {
  it('removes the creation at the given index, leaving the others alone', () => {
    const storage = new FakeStorage()
    const first: StoredBoop = { ...creation, name: 'Boop 1' }
    const second: StoredBoop = { ...creation, name: 'Boop 2' }
    saveBoop(storage, first)
    saveBoop(storage, second)

    deleteBoop(storage, 0)

    expect(loadSaveDocument(storage).creations).toEqual([second])
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
