import { memoryStorage, profileStorage } from '@hoe/accounts'
import { describe, expect, it } from 'vitest'

import { PROGRESS_KEY } from '../fieldNotes/fieldNotesStore.ts'
import { PROFILE_KEYS } from './profileKeys.ts'

function storedNameOf(key: string): string | null {
  const device = memoryStorage()
  profileStorage(device, 'ada', PROFILE_KEYS).setItem(key, 'x')
  return device.key(0)
}

describe('silt’s profile keys in localStorage', () => {
  it('field notes belong to the player', () => {
    expect(storedNameOf(PROGRESS_KEY)).toBe(`${PROGRESS_KEY}@ada`)
  })

  it('the first-visit hint belongs to the device', () => {
    expect(storedNameOf('silt:seen')).toBe('silt:seen')
  })
})
