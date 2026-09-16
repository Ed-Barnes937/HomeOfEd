import { describe, expect, it } from 'vitest'

import type { StoredBoop } from '../../persistence/saveFormat.ts'
import { loadSaveDocument, saveBoop } from '../../persistence/storage.ts'
import { FakeStorage } from '../../persistence/testing/fakeStorage.ts'
import { quickSaveBoop } from './quickSaveBoop.ts'

function boopNamed(name: string): StoredBoop {
  return {
    name,
    kitId: 'launch',
    tempo: 120,
    patterns: [{ rows: [{ instrumentId: 'kick', steps: '1000100010001000' }] }],
  }
}

describe('quickSaveBoop', () => {
  it('saves the working boop under the first free automatic name', () => {
    const storage = new FakeStorage()

    expect(quickSaveBoop(storage, boopNamed)).toBe('Boop 1')

    expect(loadSaveDocument(storage).creations).toEqual([boopNamed('Boop 1')])
  })

  it('takes the next free name, so a second one-tap save never overwrites the first', () => {
    const storage = new FakeStorage()

    quickSaveBoop(storage, boopNamed)
    expect(quickSaveBoop(storage, boopNamed)).toBe('Boop 2')

    expect(loadSaveDocument(storage).creations.map((boop) => boop.name)).toEqual([
      'Boop 1',
      'Boop 2',
    ])
  })

  it('reads the names off disk, not off a stale list, and appends to what is there', () => {
    const storage = new FakeStorage()
    saveBoop(storage, boopNamed('Boop 1'))

    expect(quickSaveBoop(storage, boopNamed)).toBe('Boop 2')

    expect(loadSaveDocument(storage).creations.map((boop) => boop.name)).toEqual([
      'Boop 1',
      'Boop 2',
    ])
  })
})
