import { describe, expect, it } from 'vitest'

import { persistWithoutPrompt, type PersistenceApi } from './storagePersistence.ts'

/** A browser's two persistence APIs, recording whether `persist()` was asked. */
function browser(state: string | Error): PersistenceApi & { persisted: number } {
  const fake = {
    persisted: 0,
    permissions: {
      query: () => (state instanceof Error ? Promise.reject(state) : Promise.resolve({ state })),
    },
    storage: {
      persist: () => {
        fake.persisted++
        return Promise.resolve(true)
      },
    },
  }
  return fake
}

describe('persistWithoutPrompt', () => {
  it.each(['granted', 'denied'])(
    'asks when the permission is already %s, so no prompt can show',
    async (state) => {
      const api = browser(state)

      await persistWithoutPrompt(api)

      expect(api.persisted).toBe(1)
    },
  )

  it('never asks while asking could show a child a prompt', async () => {
    const api = browser('prompt')

    await persistWithoutPrompt(api)

    expect(api.persisted).toBe(0)
  })

  it('does nothing where the browser cannot say, or lacks either API', async () => {
    const unknownPermission = browser(new TypeError('persistent-storage is not a permission here'))
    await persistWithoutPrompt(unknownPermission)
    expect(unknownPermission.persisted).toBe(0)

    await expect(persistWithoutPrompt({})).resolves.toBeUndefined()
    await expect(
      persistWithoutPrompt({ permissions: browser('granted').permissions }),
    ).resolves.toBeUndefined()
  })
})
