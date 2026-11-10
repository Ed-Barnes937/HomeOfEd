import { memoryStorage, profileStorage, type StorageLike } from '@hoe/accounts'
import { describe, expect, it } from 'vitest'

import { PROGRESS_KEY } from '../fieldNotes/fieldNotesStore.ts'
import { blobKey, INDEX_KEY, thumbKey } from '../scenes/sceneStore.ts'
import { PROFILE_KEYS } from './profileKeys.ts'

const ID = '0b9e8a2c-7f43-4d1e-9a51-3c2b6d8e4f10'

function storedNameOf(key: string): string | null {
  const device = memoryStorage()
  profileStorage(device, 'ada', PROFILE_KEYS).setItem(key, 'x')
  return device.key(0)
}

describe('silt’s profile keys', () => {
  it.each([INDEX_KEY, blobKey(ID), thumbKey(ID), PROGRESS_KEY])(
    '%s belongs to the player',
    (key) => {
      expect(storedNameOf(key)).toBe(`${key}@ada`)
    },
  )

  it('the first-visit hint belongs to the device', () => {
    expect(storedNameOf('silt:seen')).toBe('silt:seen')
  })

  it('adopts the index and its blobs together, or neither', () => {
    const device = memoryStorage()
    device.setItem(INDEX_KEY, `[{"id":"${ID}","name":"dunes","updatedAt":1}]`)
    device.setItem(blobKey(ID), '{}')
    // The device fills up on the blob's copy.
    const full: StorageLike = {
      getItem: (key) => device.getItem(key),
      setItem: (key, value) => {
        if (key === `${blobKey(ID)}@ada`) throw new DOMException('full', 'QuotaExceededError')
        device.setItem(key, value)
      },
      removeItem: (key) => device.removeItem(key),
      key: (index) => device.key(index),
      get length() {
        return device.length
      },
      clear: () => device.clear(),
    }

    const storage = profileStorage(full, 'ada', PROFILE_KEYS)

    expect(storage.getItem(INDEX_KEY)).toBeNull()
    expect(storage.getItem(blobKey(ID))).toBeNull()
  })
})
